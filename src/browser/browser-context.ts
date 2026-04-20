/**
 * @module @dreamer/test/browser/browser-context
 *
 * @fileoverview 浏览器测试上下文管理
 * 创建和管理 Playwright 浏览器实例和页面
 */

import {
  existsSync,
  getEnv,
  removeSync,
  writeStderrSync,
} from "@dreamer/runtime-adapter";
import { $tr } from "../i18n.ts";
import type { BrowserTestConfig } from "../types.ts";
import { buildClientBundle } from "./bundle.ts";
import { getPlaywright } from "./dependencies.ts";
import { createTestPage, DEFAULT_TEMPLATE_IIFE } from "./page.ts";
import { findChromePath } from "./chrome.ts";

/** 关闭浏览器时等待的最长时间（毫秒），超时则放弃等待，避免卡住 */
const BROWSER_CLOSE_TIMEOUT_MS = 8000;

/**
 * 标记「已尝试过 headed 回退」，避免 launch 失败时无限递归。
 * 运行时挂在 `BrowserTestConfig` 的 Symbol 属性上（不纳入公开类型）。
 */
const HEADED_LAUNCH_FALLBACK_TRIED = Symbol.for(
  "@dreamer/test:headedChromiumLaunchFallbackTried",
);

/**
 * 是否为「稳定版 Google Chrome」路径：此类场景优先用 Playwright 的 `channel: 'chrome'`
 * （见官方 BrowserType.launch channel 选项），避免仅传 `executablePath` 时在部分 macOS 上
 * CDP 长时间无响应。
 *
 * @param executablePath - `findChromePath()` 或用户显式传入
 */
function shouldLaunchGoogleChromeViaChannel(
  executablePath: string | undefined,
): boolean {
  if (!executablePath) return false;
  const p = executablePath.replace(/\\/g, "/");
  return (
    p.includes("Google Chrome.app") ||
    p.endsWith("/google-chrome") ||
    p.includes("/Google/Chrome/Application/chrome.exe")
  );
}

/**
 * 关闭浏览器：先正常 close，超时则拒绝，避免无限等待
 * Playwright 的 Browser 无 process()，不做进程 kill
 * @param browser - Playwright Browser 实例
 */
async function closeBrowserWithTimeout(
  browser: { close(): Promise<void> },
): Promise<void> {
  const closePromise = browser.close();
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(
      () => reject(new Error($tr("browser.closeTimeout"))),
      BROWSER_CLOSE_TIMEOUT_MS,
    )
  );
  await Promise.race([closePromise, timeoutPromise]);
}

/**
 * 浏览器测试上下文
 */
export interface BrowserContext {
  /** Playwright Browser 实例 */
  browser: any;
  /** Playwright Page 实例 */
  page: any;
  /** HTML 文件路径 */
  htmlPath: string;
  /**
   * 在浏览器中执行代码
   * @param fn - 要在浏览器中执行的函数
   * @returns 执行结果
   */
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  /**
   * 导航到指定 URL
   * @param url - 目标 URL
   */
  goto(url: string): Promise<void>;
  /**
   * 等待页面中的条件满足
   * @param fn - 条件函数
   * @param options - 等待选项
   */
  waitFor(fn: () => boolean, options?: { timeout?: number }): Promise<void>;
  /**
   * 关闭浏览器和页面
   */
  close(): Promise<void>;
}

/**
 * Playwright 把子进程 stderr 打进错误信息时，可据此追加网络/SSL 排查说明。
 *
 * @param msg - 完整错误文本
 */
function appendSslOrProxyHint(msg: string): string {
  if (/handshake failed|ssl_client_socket/i.test(msg)) {
    return $tr("browser.launchFixHintSslHandshake");
  }
  return "";
}

/**
 * 判断是否为「Playwright 已拉起进程但长时间连不上 CDP」类超时（常见于自带 Chromium 与宿主机不兼容）。
 *
 * @param err - launch 阶段抛出的原始错误
 */
function isLikelyBundledLaunchTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Timeout \d+ms exceeded/i.test(msg) ||
    (/browserType\.launch/i.test(msg) && /\b[Tt]imeout\b/i.test(msg)) ||
    msg.includes("browser.launch: Timeout") ||
    // 外层 Promise.race 包装的文案（中英）
    msg.includes("启动超时") ||
    (/timed out/i.test(msg) && /launch/i.test(msg))
  );
}

/**
 * 内部实现：`ignoreEnvOverride` 为 true 时不读取 `DREAMER_TEST_BROWSER_SOURCE`，
 * 避免「自带 Chromium 超时后改用系统 Chrome」的重入被环境变量再次强制为 test。
 *
 * @param config - 浏览器测试配置
 * @param ignoreEnvOverride - 是否忽略环境变量中的 browserSource
 */
async function createBrowserContextInternal(
  config: BrowserTestConfig,
  ignoreEnvOverride: boolean,
): Promise<BrowserContext> {
  /**
   * 允许仅用环境变量切换浏览器来源，无需改每个测试文件：
   * `DREAMER_TEST_BROWSER_SOURCE=system` — 强制系统 Chrome/Chromium；
   * `DREAMER_TEST_BROWSER_SOURCE=test` — 强制 Playwright 自带浏览器。
   */
  const envBrowserSource = ignoreEnvOverride
    ? undefined
    : getEnv("DREAMER_TEST_BROWSER_SOURCE")?.trim();
  const effectiveConfig: BrowserTestConfig =
    envBrowserSource === "system" || envBrowserSource === "test"
      ? { ...config, browserSource: envBrowserSource }
      : config;

  const playwright = getPlaywright();
  const engine = effectiveConfig.browserType ?? "chromium";
  const browserName = engine === "chromium"
    ? "Chromium"
    : engine === "firefox"
    ? "Firefox"
    : "WebKit";

  const wantSystem = engine === "chromium" &&
      effectiveConfig.browserSource === "test"
    ? false
    : (effectiveConfig.browserSource === "system" ||
      effectiveConfig.preferSystemChrome !== false);
  const executablePath = engine === "chromium"
    ? (effectiveConfig.executablePath ??
      (wantSystem ? findChromePath() : undefined))
    : undefined;

  if (
    engine === "chromium" &&
    effectiveConfig.browserSource === "system" &&
    !executablePath
  ) {
    throw new Error($tr("browser.noSystemChrome"));
  }

  // 显式指定 executablePath 时先检查文件是否存在，避免 Windows 上长时间超时后才报错
  if (executablePath && !existsSync(executablePath)) {
    throw new Error(
      $tr("browser.executableNotFound", {
        path: executablePath,
        engine,
      }),
    );
  }

  const launchTimeout = effectiveConfig.protocolTimeout ?? 120000;
  /**
   * 为 true 时把 Chromium 的 stdout/stderr 接到 Playwright，便于看子进程是否报
   * `Remote debugging` 被策略拦截等。测试里可设 `dumpio: true`；本机排错也可设
   * 环境变量 `DREAMER_TEST_BROWSER_DUMP_IO=1` 而不用改每个用例。
   */
  const dumpio = effectiveConfig.dumpio === true ||
    getEnv("DREAMER_TEST_BROWSER_DUMP_IO") === "1";
  /**
   * Playwright `launch({ timeout })` 上限：取自 `protocolTimeout`（默认 120s），
   * 非 CI 再 `min(180s, …)`。曾用 `min(90s, …)` 与默认 120s 矛盾，易误报 90s 超时。
   */
  const maxLaunchMs = 180_000;
  const effectiveLaunchTimeout = getEnv("CI") === "true"
    ? Math.max(120_000, Math.min(maxLaunchMs, launchTimeout))
    : Math.min(maxLaunchMs, launchTimeout);

  let launchOptions: Parameters<typeof playwright.chromium.launch>[0];
  if (engine === "chromium") {
    const requiredArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--proxy-server=direct://",
      "--proxy-bypass-list=*",
      "--disable-features=HttpsFirstBalancedModeAutoEnable,TranslateUI",
    ];
    const defaultArgs = [
      ...requiredArgs,
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-translate",
      "--disable-breakpad",
      "--mute-audio",
    ];
    const rawArgs = effectiveConfig.args?.length
      ? [...requiredArgs, ...effectiveConfig.args]
      : defaultArgs;
    const args = rawArgs.filter((a) => !["--single-process"].includes(a));
    /**
     * 始终 `stdio: 'pipe'`：避免浏览器子进程继承 Deno 测试进程的 stdio，
     * 在少数环境下会引发 CDP 握手长时间不返回（表现卡在 `launcher.launch`）。
     * `dumpio: true` 时同样走 pipe，由 Playwright 转发日志。
     */
    const launchBase = {
      headless: effectiveConfig.headless !== false,
      args,
      timeout: effectiveLaunchTimeout,
      stdio: "pipe" as const,
    };
    if (shouldLaunchGoogleChromeViaChannel(executablePath)) {
      launchOptions = {
        ...launchBase,
        channel: "chrome",
      };
    } else {
      /**
       * Playwright 默认在未指定 `channel` 的 **headless** 下使用独立的 `chromium-headless-shell`；
       * 在部分 macOS 环境会出现子进程已起但 CDP 长时间无法握手（表现卡在 `launch`）。
       *
       * 策略（按优先级）：
       * 1. **无自定义路径**且已安装自带 Chromium：使用 `chromium.executablePath()` 指向缓存中的
       *    「Chrome for Testing」**完整二进制**显式启动（比单独依赖 `channel: 'chromium'` 在少数宿主机上更稳定）。
       * 2. 否则若仍为无路径 headless：回退 `channel: 'chromium'`（New Headless），见
       *    https://playwright.dev/docs/browsers#chromium-new-headless-mode
       * 3. 其他情况：`executablePath` 仅来自用户/系统探测。
       */
      const bundledChromeForTestingPath =
        typeof playwright.chromium.executablePath === "function"
          ? playwright.chromium.executablePath()
          : undefined;

      const useExplicitBundledExe = effectiveConfig.headless !== false &&
        executablePath === undefined &&
        Boolean(
          bundledChromeForTestingPath &&
            existsSync(bundledChromeForTestingPath),
        );

      if (useExplicitBundledExe && bundledChromeForTestingPath) {
        launchOptions = {
          ...launchBase,
          executablePath: bundledChromeForTestingPath,
        };
      } else {
        const usePlaywrightNewHeadless = effectiveConfig.headless !== false &&
          executablePath === undefined;

        launchOptions = {
          ...launchBase,
          ...(executablePath ? { executablePath } : {}),
          ...(usePlaywrightNewHeadless ? { channel: "chromium" as const } : {}),
        };
      }
    }
  } else {
    launchOptions = {
      headless: effectiveConfig.headless !== false,
      timeout: effectiveLaunchTimeout,
    };
  }

  if (dumpio) {
    const exeInfo = engine === "chromium" &&
        shouldLaunchGoogleChromeViaChannel(executablePath)
      ? "channel=chrome"
      : engine === "chromium" && executablePath
      ? `executablePath=${executablePath}`
      : engine;
    writeStderrSync(
      new TextEncoder().encode(
        `[dreamer/test] Launching ${browserName} (${exeInfo})…\n`,
      ),
    );
  }

  /**
   * 外层 `Promise.race` 必须 **不短于** 上面传给 `launch({ timeout })` 的
   * `effectiveLaunchTimeout`。否则外圈先触发会误报「浏览器启动超时」。
   */
  const launchTimeoutMs = getEnv("CI") === "true"
    ? Math.max(120_000, effectiveLaunchTimeout + 15_000)
    : effectiveLaunchTimeout + 15_000;

  const launcher = engine === "chromium"
    ? playwright.chromium
    : engine === "firefox"
    ? playwright.firefox
    : playwright.webkit;

  let browser;
  try {
    browser = await Promise.race([
      launcher.launch(launchOptions),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                $tr("browser.launchTimedOutHint", {
                  seconds: String(launchTimeoutMs / 1000),
                  engine,
                }),
              ),
            ),
          launchTimeoutMs,
        )
      ),
    ]);

    if (dumpio) {
      writeStderrSync(
        new TextEncoder().encode(
          `[dreamer/test] ${browserName} launched.\n`,
        ),
      );
    }
  } catch (err) {
    const systemPath = engine === "chromium" ? findChromePath() : undefined;
    const shouldRetrySystem = engine === "chromium" &&
      effectiveConfig.browserSource === "test" &&
      Boolean(systemPath) &&
      isLikelyBundledLaunchTimeout(err);

    if (shouldRetrySystem && systemPath) {
      writeStderrSync(
        new TextEncoder().encode(
          $tr("browser.retryBundledTimeoutWithSystem") + "\n",
        ),
      );
      return createBrowserContextInternal(
        {
          ...effectiveConfig,
          browserSource: "system",
        },
        true,
      );
    }

    /**
     * 仍无头超时：在非 CI 下再用 **有头模式** 试一轮（可能短暂出现窗口）。
     * 部分 macOS / 终端组合下仅无头 CDP 会挂死，headed 可绕开。
     */
    const configWithFlags = effectiveConfig as
      & BrowserTestConfig
      & Record<symbol, boolean | undefined>;
    const shouldRetryHeaded = engine === "chromium" &&
      getEnv("CI") !== "true" &&
      effectiveConfig.headless !== false &&
      configWithFlags[HEADED_LAUNCH_FALLBACK_TRIED] !== true &&
      isLikelyBundledLaunchTimeout(err);

    if (shouldRetryHeaded) {
      console.warn(
        "[dreamer/test] 无头模式 launch 超时或连接超时，非 CI 下将用 headed 再试一次（可能短暂出现浏览器窗口）",
      );
      return createBrowserContextInternal(
        Object.assign({}, effectiveConfig, {
          headless: false,
          [HEADED_LAUNCH_FALLBACK_TRIED]: true,
        }) as BrowserTestConfig,
        ignoreEnvOverride,
      );
    }

    const msg = err instanceof Error ? err.message : String(err);
    const missingExecutable = msg.includes("Executable doesn't exist");
    const baseHint = missingExecutable
      ? $tr("browser.launchFixHint", { engine })
      : isLikelyBundledLaunchTimeout(err)
      ? $tr("browser.launchFixHintTimeoutBundled", { engine })
      : /browserType\.launch/i.test(msg) || msg.includes(engine)
      ? $tr("browser.launchFixHintGeneric", { engine })
      : "";
    const hint = baseHint + appendSslOrProxyHint(msg);
    throw new Error($tr("browser.launchFailed", { message: msg, hint }));
  }

  let page;
  let htmlPath: string = "";

  try {
    page = await browser.newPage();

    if (effectiveConfig.entryPoint) {
      const consoleErrors: string[] = [];
      page.on("console", (msg: { type: () => string; text: () => string }) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (error: { message: string }) => {
        consoleErrors.push(error.message);
      });

      const bundle = await buildClientBundle({
        entryPoint: effectiveConfig.entryPoint,
        globalName: effectiveConfig.globalName,
        browserMode: effectiveConfig.browserMode,
      });

      htmlPath = await createTestPage({
        bundleCode: bundle,
        bodyContent: effectiveConfig.bodyContent,
        template: effectiveConfig.htmlTemplate ??
          (effectiveConfig.browserMode === false
            ? DEFAULT_TEMPLATE_IIFE
            : undefined),
      });

      const loadTimeout = (effectiveConfig.moduleLoadTimeout || 10000) + 10000;
      await page.goto(`file://${htmlPath}`, {
        waitUntil: "domcontentloaded",
        timeout: loadTimeout,
      });

      const moduleLoadTimeout = effectiveConfig.moduleLoadTimeout || 10000;
      const globalName = effectiveConfig.globalName;
      if (globalName) {
        try {
          await page.waitForFunction(
            (name: string) => {
              return (
                typeof (globalThis as any).window[name] !== "undefined" &&
                (globalThis as any).window.testReady === true
              );
            },
            globalName,
            { timeout: moduleLoadTimeout },
          );
        } catch (_error) {
          try {
            await page.waitForFunction(
              (name: string) =>
                typeof (globalThis as any).window[name] !== "undefined",
              globalName,
              { timeout: 2000 },
            );
          } catch (_retryError) {
            const errorDetails = consoleErrors.length > 0
              ? `\nBrowser console errors: ${consoleErrors.join("\n")}`
              : "";
            throw new Error(
              $tr("browser.moduleLoadTimeout", {
                globalName,
                entry: effectiveConfig.entryPoint,
                details: errorDetails,
              }),
            );
          }
        }
      } else {
        try {
          await page.waitForFunction(
            () => (globalThis as any).window.testReady === true,
            { timeout: moduleLoadTimeout },
          );
        } catch (_error) {
          const errorDetails = consoleErrors.length > 0
            ? `\nBrowser console errors: ${consoleErrors.join("\n")}`
            : "";
          throw new Error(
            $tr("browser.moduleLoadTimeoutTestReady", {
              entry: effectiveConfig.entryPoint,
              details: errorDetails,
            }),
          );
        }
      }
    }
  } catch (error) {
    try {
      await browser.close();
    } catch {
      // ignore
    }
    throw error;
  }

  const currentPage = page!;

  const context: BrowserContext = {
    browser,
    page: currentPage,
    htmlPath,
    async evaluate<T>(fn: () => T | Promise<T>): Promise<T> {
      return await context.page.evaluate(fn);
    },
    async goto(url: string): Promise<void> {
      await context.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    },
    async waitFor(
      fn: () => boolean,
      options?: { timeout?: number },
    ): Promise<void> {
      await context.page.waitForFunction(fn, {
        timeout: options?.timeout || 10000,
      });
    },
    async close(): Promise<void> {
      try {
        await context.page.close();
      } catch {
        // ignore
      }
      await closeBrowserWithTimeout(browser);
      if (context.htmlPath) {
        try {
          removeSync(context.htmlPath);
        } catch {
          // ignore
        }
      }
    },
  };

  return context;
}

/**
 * 创建浏览器测试上下文
 *
 * 根据配置创建 Playwright 浏览器实例，如果配置了 entryPoint，
 * 会自动打包客户端代码并创建测试页面。
 * browserType 可选 "chromium" | "firefox" | "webkit"；browserSource 仅对 chromium 有效。
 *
 * @param config - 浏览器测试配置
 * @returns 浏览器测试上下文
 */
export function createBrowserContext(
  config: BrowserTestConfig,
): Promise<BrowserContext> {
  return createBrowserContextInternal(config, false);
}
