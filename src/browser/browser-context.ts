/**
 * @module @dreamer/test/browser/browser-context
 *
 * @fileoverview 浏览器测试上下文管理
 * 创建和管理 Playwright 浏览器实例和页面
 */

import {
  existsSync,
  getEnv,
  IS_BUN,
  IS_DENO,
  IS_NODE,
  removeSync,
  writeStderrSync,
} from "@dreamer/runtime-adapter";
import { $tr } from "../i18n.ts";
import type { BrowserTestConfig } from "../types.ts";
import { buildClientBundle } from "./bundle.ts";
import { getPlaywright } from "./dependencies.ts";
import { createTestPage, DEFAULT_TEMPLATE_IIFE } from "./page.ts";
import { findChromePath } from "./chrome.ts";

/**
 * 关闭浏览器时等待的最长时间（毫秒）。
 * 超时后 forceKill；过长会在半死 CDP 路径上把整文件拖成「假死」。
 */
const BROWSER_CLOSE_TIMEOUT_MS = 4_000;

/**
 * `browser.newPage()` 宿主侧上限。
 * Bun/Node 上连续 launch→close→launch 时，第二次 launch 可能“成功”但 CDP 已死，
 * `newPage()` 永不 resolve 且不跑 Playwright 自身 timeout（0% CPU、无子进程）。
 */
const NEW_PAGE_HOST_TIMEOUT_MS = 10_000;

/**
 * close 后略等，降低「profile/CDP 端口未释放」导致的下一次 newPage 挂死。
 * Bun 与 Node 均需要；Deno 路径较少出现半死 CDP。
 */
const POST_CLOSE_COOLDOWN_MS = 80;

/**
 * 标记「已尝试过 headed 回退」，避免 launch 失败时无限递归。
 * 运行时挂在 `BrowserTestConfig` 的 Symbol 属性上（不纳入公开类型）。
 */
const HEADED_LAUNCH_FALLBACK_TRIED = Symbol.for(
  "@dreamer/test:headedChromiumLaunchFallbackTried",
);

/**
 * 标记「create 失败后已整轮重试过一次」（newPage / entryPoint goto 等），避免无限递归。
 */
const CREATE_RETRY_TRIED = Symbol.for(
  "@dreamer/test:createBrowserContextRetryTried",
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
 * 尽力销毁管道并 SIGKILL Playwright 持有的浏览器子进程。
 *
 * 【Why】Playwright 的 browser.close() 在 Chrome 挂起时不返回也不超时；
 * Bun 上 close 常“成功”但留下半死 CDP/子进程，下一次 `newPage` 永久挂起。
 * 若 `stdio: 'pipe'` 后 SIGKILL 而不 destroy stdout/stderr，事件环还会假死。
 * 禁止关闭 `browser._connection`（多次 launch 可能复用连接）。
 */
function forceKillBrowserProcess(
  browser: { close(): Promise<void> },
): void {
  try {
    const b = browser as Record<string, unknown>;
    /**
     * 只杀本 Browser 的子进程与 stdio 管道。
     * 禁止碰 `browser._connection`：Playwright 在多次 launch 间可能复用连接，
     * 关掉会污染后续 launch（报 Target page/context/browser has been closed）。
     */
    const proc = (b._process ??
      (typeof b.process === "function"
        ? (b.process as () => unknown)()
        : undefined)) as {
        kill?: (signal?: string) => void;
        unref?: () => void;
        stdout?: { destroy?: () => void };
        stderr?: { destroy?: () => void };
        stdin?: { destroy?: () => void };
      } | undefined;
    if (!proc) return;
    try {
      proc.stdout?.destroy?.();
    } catch { /* ignore */ }
    try {
      proc.stderr?.destroy?.();
    } catch { /* ignore */ }
    try {
      proc.stdin?.destroy?.();
    } catch { /* ignore */ }
    try {
      proc.unref?.();
    } catch { /* ignore */ }
    if (typeof proc.kill === "function") {
      proc.kill("SIGKILL");
    }
  } catch {
    // ignore — 尽力而为
  }
}

async function closeBrowserWithTimeout(
  browser: { close(): Promise<void> },
): Promise<void> {
  const closePromise = browser.close();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeoutPromise = new Promise<void>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new Error($tr("browser.closeTimeout")));
    }, BROWSER_CLOSE_TIMEOUT_MS);
  });
  try {
    await Promise.race([closePromise, timeoutPromise]);
  } catch (_err) {
    /** 超时后忽略 close 后续的 rejection，避免未处理的 Promise */
    void closePromise.catch(() => {});
    /**
     * 不再向上抛：afterEach/afterAll 关浏览器超时已处理进程，
     * 再抛会导致钩子失败并连锁误杀后续套件。关闭目标已达成。
     */
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    /**
     * 掐 Playwright 连接 + 销毁管道 + 必要时 SIGKILL。
     * 否则 Bun 事件环可能永不退出；下一次 newPage 也可能永久挂起。
     * `timedOut` 仅用于语义记录（force 路径不区分）。
     */
    void timedOut;
    forceKillBrowserProcess(browser);
  }
  if ((IS_BUN || IS_NODE) && POST_CLOSE_COOLDOWN_MS > 0) {
    await new Promise<void>((r) => setTimeout(r, POST_CLOSE_COOLDOWN_MS));
  }
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
 * 宿主侧 `Promise.race` 超时：Playwright 部分 API（evaluate / newPage / close）在
 * CDP 半死时永不 resolve，且不遵守 `setDefaultTimeout`。
 *
 * @param promise - 可能挂死的 Playwright Promise
 * @param ms - 超时毫秒
 * @param errorMessage - 超时错误文案
 */
async function withBrowserHostTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(errorMessage));
        }, ms);
      }),
    ]);
  } catch (err) {
    /** 超时先返回时忽略原 Promise 后续 rejection，避免未处理的 Promise */
    void promise.catch(() => {});
    throw err;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/**
 * Playwright 的 `page.evaluate` 在页面 JS 长时间占用主线程或 CDP 卡住时可能永不 resolve。
 *
 * @param evaluatePromise - `page.evaluate(...)` 返回的 Promise
 * @param ms - 超时毫秒数（通常与 `protocolTimeout` 一致）
 */
function evaluateWithHostTimeout<T>(
  evaluatePromise: Promise<T>,
  ms: number,
): Promise<T> {
  return withBrowserHostTimeout(
    evaluatePromise,
    ms,
    $tr("browser.evaluateHostTimeout", { ms: String(ms) }),
  );
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

  const playwright = await getPlaywright();
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

  /**
   * 页面级默认超时（毫秒）：与常见 `protocolTimeout: 60_000` 对齐。
   * `page.evaluate` 另在宿主侧用 {@link evaluateWithHostTimeout} 兜底，避免永不 resolve。
   */
  const defaultPageOpTimeoutMs = effectiveConfig.protocolTimeout ?? 60_000;

  const launchTimeout = effectiveConfig.protocolTimeout ?? 120000;
  /**
   * 为 true 时把 Chromium 的 stdout/stderr 接到 Playwright，便于看子进程是否报
   * `Remote debugging` 被策略拦截等。测试里可设 `dumpio: true`；本机排错也可设
   * 环境变量 `DREAMER_TEST_BROWSER_DUMP_IO=1` 而不用改每个用例。
   */
  const dumpio = effectiveConfig.dumpio === true ||
    getEnv("DREAMER_TEST_BROWSER_DUMP_IO") === "1";
  /**
   * Playwright `launch({ timeout })` 上限。
   * 非 CI 默认 cap 45s：避免 bundled → system → headed 各等 120s+ 叠到 295s，
   * 把整条用例拖到 PLAYWRIGHT_BROWSER_IT_TIMEOUT_MS（300s）假死。
   * CI 仍给足 120s+ 预算。
   */
  const maxLaunchMs = getEnv("CI") === "true" ? 180_000 : 45_000;
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
    /** 禁止 --user-data-dir：Playwright 要求走 launchPersistentContext */
    const args = rawArgs.filter((a) =>
      !["--single-process"].includes(a) && !a.startsWith("--user-data-dir")
    );
    /**
     * Deno：强制 `stdio: 'pipe'`，避免继承测试进程 stdio 导致 CDP 握手卡住。
     * Bun/Node：不要默认 pipe——pipe + 后续 SIGKILL 会留下未读 stdout/stderr，
     * 事件环永不排空，表现为用例已 pass 后进程仍假死、整 suite「等很久」。
     * `dumpio: true` 时仍用 pipe 以便 Playwright 转发日志。
     */
    const useStdioPipe = dumpio || IS_DENO;
    const launchBase: Parameters<typeof playwright.chromium.launch>[0] = {
      headless: effectiveConfig.headless !== false,
      args,
      timeout: effectiveLaunchTimeout,
      ...(useStdioPipe ? { stdio: "pipe" as const } : {}),
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
    : effectiveLaunchTimeout + 5_000;

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
     * 仍无头超时：默认 **不再** 自动 headed 重试（再叠一轮 45s+ 易把用例拖到 5 分钟）。
     * 需要时设 `DREAMER_TEST_BROWSER_HEADED_FALLBACK=1` 显式开启。
     */
    const configWithFlags = effectiveConfig as
      & BrowserTestConfig
      & Record<symbol, boolean | undefined>;
    const shouldRetryHeaded = engine === "chromium" &&
      getEnv("CI") !== "true" &&
      getEnv("DREAMER_TEST_BROWSER_HEADED_FALLBACK") === "1" &&
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
    /**
     * Bun 串行 create/close 复现：第二次 launch 日志已 “launched” 但进程已死，
     * `newPage()` 无限挂起（sample 显示 kevent 空等、无 chromium 子进程）。
     * 必须宿主 timeout + 强杀，并允许整轮重试一次。
     */
    if (
      typeof (browser as { isConnected?: () => boolean }).isConnected ===
        "function" &&
      !(browser as { isConnected: () => boolean }).isConnected()
    ) {
      throw new Error($tr("browser.browserDisconnectedAfterLaunch"));
    }

    try {
      page = await withBrowserHostTimeout(
        browser.newPage(),
        NEW_PAGE_HOST_TIMEOUT_MS,
        $tr("browser.newPageHostTimeout", {
          ms: String(NEW_PAGE_HOST_TIMEOUT_MS),
        }),
      );
    } catch (newPageErr) {
      await closeBrowserWithTimeout(browser);
      const cfgFlags = effectiveConfig as
        & BrowserTestConfig
        & Record<symbol, boolean | undefined>;
      if (cfgFlags[CREATE_RETRY_TRIED] !== true) {
        return createBrowserContextInternal(
          Object.assign({}, effectiveConfig, {
            [CREATE_RETRY_TRIED]: true,
          }) as BrowserTestConfig,
          ignoreEnvOverride,
        );
      }
      throw newPageErr;
    }

    /** 多数 Playwright API 与此一致；evaluate hanging 场景仍依赖宿主 race */
    page.setDefaultTimeout(defaultPageOpTimeoutMs);
    page.setDefaultNavigationTimeout(defaultPageOpTimeoutMs);

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
      // 宿主 race 略大于 Playwright 超时：CDP/waitForFunction 在 Bun 上偶发不按时 resolve
      const hostWaitMs = moduleLoadTimeout + 2000;
      const globalName = effectiveConfig.globalName;

      // goto 后立即探测：已就绪则跳过 waitForFunction（避免 Playwright 永不返回）
      const readyProbe = globalName
        ? await page.evaluate((name: string) => ({
          hasGlobal: typeof (window as any)[name] !== "undefined",
          hasTestReady: (window as any).testReady === true,
        }), globalName).catch(() => ({ hasGlobal: false, hasTestReady: false }))
        : await page.evaluate(() => ({
          hasGlobal: true,
          hasTestReady: (window as any).testReady === true,
        })).catch(() => ({ hasGlobal: true, hasTestReady: false }));

      if (globalName) {
        if (!(readyProbe.hasGlobal && readyProbe.hasTestReady)) {
          try {
            await evaluateWithHostTimeout(
              page.waitForFunction(
                (name: string) => {
                  return (
                    typeof (window as any)[name] !== "undefined" &&
                    (window as any).testReady === true
                  );
                },
                globalName,
                { timeout: moduleLoadTimeout },
              ),
              hostWaitMs,
            );
          } catch (_error) {
            try {
              await evaluateWithHostTimeout(
                page.waitForFunction(
                  (name: string) =>
                    typeof (window as any)[name] !== "undefined",
                  globalName,
                  { timeout: 2000 },
                ),
                3000,
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
        }
      } else if (!readyProbe.hasTestReady) {
        try {
          await evaluateWithHostTimeout(
            page.waitForFunction(
              () => (window as any).testReady === true,
              { timeout: moduleLoadTimeout },
            ),
            hostWaitMs,
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
    await closeBrowserWithTimeout(browser).catch(() => {});
    /**
     * entryPoint 的 `page.goto(file://…)` 在 Bun 串行用例中偶发 20s 超时；
     * 与 newPage 半死类似，整轮重试一次通常即可恢复。
     */
    const cfgFlags = effectiveConfig as
      & BrowserTestConfig
      & Record<symbol, boolean | undefined>;
    if (cfgFlags[CREATE_RETRY_TRIED] !== true) {
      return createBrowserContextInternal(
        Object.assign({}, effectiveConfig, {
          [CREATE_RETRY_TRIED]: true,
        }) as BrowserTestConfig,
        ignoreEnvOverride,
      );
    }
    throw error;
  }

  const currentPage = page!;

  const context: BrowserContext = {
    browser,
    page: currentPage,
    htmlPath,
    async evaluate<T>(fn: () => T | Promise<T>): Promise<T> {
      return await evaluateWithHostTimeout(
        context.page.evaluate(fn),
        defaultPageOpTimeoutMs,
      );
    },
    async goto(url: string): Promise<void> {
      return await evaluateWithHostTimeout(
        context.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: defaultPageOpTimeoutMs,
        }),
        defaultPageOpTimeoutMs,
      );
    },
    async waitFor(
      fn: () => boolean,
      options?: { timeout?: number },
    ): Promise<void> {
      const timeoutMs = options?.timeout || 10000;
      return await evaluateWithHostTimeout(
        context.page.waitForFunction(fn, { timeout: timeoutMs }),
        timeoutMs,
      );
    },
    async close(): Promise<void> {
      try {
        // page.close 与 browser.close 一样可能永不返回；限时避免 afterAll 卡死
        const pageClose = context.page.close().catch(() => {});
        await Promise.race([
          pageClose,
          new Promise<void>((r) => setTimeout(r, BROWSER_CLOSE_TIMEOUT_MS)),
        ]);
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
