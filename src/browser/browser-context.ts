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
import { $t } from "../i18n.ts";
import type { BrowserTestConfig } from "../types.ts";
import { buildClientBundle } from "./bundle.ts";
import { getPlaywright } from "./dependencies.ts";
import { createTestPage, DEFAULT_TEMPLATE_IIFE } from "./page.ts";
import { findChromePath } from "./chrome.ts";

/** 关闭浏览器时等待的最长时间（毫秒），超时则放弃等待，避免卡住 */
const BROWSER_CLOSE_TIMEOUT_MS = 8000;

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
      () => reject(new Error($t("browser.closeTimeout"))),
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
 * 创建浏览器测试上下文
 *
 * 根据配置创建 Playwright 浏览器实例，如果配置了 entryPoint，
 * 会自动打包客户端代码并创建测试页面。
 * browserType 可选 "chromium" | "firefox" | "webkit"；browserSource 仅对 chromium 有效。
 *
 * @param config - 浏览器测试配置
 * @returns 浏览器测试上下文
 */
export async function createBrowserContext(
  config: BrowserTestConfig,
): Promise<BrowserContext> {
  const playwright = getPlaywright();
  const engine = config.browserType ?? "chromium";
  const browserName = engine === "chromium"
    ? "Chromium"
    : engine === "firefox"
    ? "Firefox"
    : "WebKit";

  const wantSystem = engine === "chromium" && config.browserSource === "test"
    ? false
    : (config.browserSource === "system" ||
      config.preferSystemChrome !== false);
  const executablePath = engine === "chromium"
    ? (config.executablePath ?? (wantSystem ? findChromePath() : undefined))
    : undefined;

  if (
    engine === "chromium" &&
    config.browserSource === "system" &&
    !executablePath
  ) {
    throw new Error($t("browser.noSystemChrome"));
  }

  // 显式指定 executablePath 时先检查文件是否存在，避免 Windows 上长时间超时后才报错
  if (executablePath && !existsSync(executablePath)) {
    throw new Error(
      $t("browser.executableNotFound", {
        path: executablePath,
        engine,
      }),
    );
  }

  const launchTimeout = config.protocolTimeout ?? 120000;
  const dumpio = config.dumpio === true;
  // CI 下（尤其 Windows）启动较慢，允许更长超时
  const effectiveLaunchTimeout = getEnv("CI") === "true"
    ? Math.max(120000, launchTimeout)
    : Math.min(90000, launchTimeout);

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
    const rawArgs = config.args?.length
      ? [...requiredArgs, ...config.args]
      : defaultArgs;
    const args = rawArgs.filter((a) => !["--single-process"].includes(a));
    launchOptions = {
      headless: config.headless !== false,
      ...(executablePath ? { executablePath } : {}),
      args,
      timeout: effectiveLaunchTimeout,
      ...(dumpio ? { stdio: "pipe" as const } : {}),
    };
  } else {
    launchOptions = {
      headless: config.headless !== false,
      timeout: effectiveLaunchTimeout,
      ...(dumpio ? { stdio: "pipe" as const } : {}),
    };
  }

  if (dumpio) {
    const exeInfo = engine === "chromium" && executablePath
      ? `executablePath=${executablePath}`
      : engine;
    writeStderrSync(
      new TextEncoder().encode(
        `[dreamer/test] Launching ${browserName} (${exeInfo})…\n`,
      ),
    );
  }

  // CI（尤其 Windows runner）下启动较慢，延长超时避免误报
  const baseTimeoutMs = engine === "chromium"
    ? (config.browserSource === "test" ? 60000 : 45000)
    : 60000;
  const launchTimeoutMs = getEnv("CI") === "true"
    ? Math.max(baseTimeoutMs, 120000)
    : baseTimeoutMs;

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
                $t("browser.launchTimedOutHint", {
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
    const msg = err instanceof Error ? err.message : String(err);
    const needHint = msg.includes("Executable doesn't exist") ||
      msg.includes("browserType.launch") ||
      msg.includes(engine);
    const hint = needHint ? $t("browser.launchFixHint", { engine }) : "";
    throw new Error($t("browser.launchFailed", { message: msg, hint }));
  }

  let page;
  let htmlPath: string = "";

  try {
    page = await browser.newPage();

    if (config.entryPoint) {
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
        entryPoint: config.entryPoint,
        globalName: config.globalName,
        browserMode: config.browserMode,
      });

      htmlPath = await createTestPage({
        bundleCode: bundle,
        bodyContent: config.bodyContent,
        template: config.htmlTemplate ??
          (config.browserMode === false ? DEFAULT_TEMPLATE_IIFE : undefined),
      });

      const loadTimeout = (config.moduleLoadTimeout || 10000) + 10000;
      await page.goto(`file://${htmlPath}`, {
        waitUntil: "domcontentloaded",
        timeout: loadTimeout,
      });

      const moduleLoadTimeout = config.moduleLoadTimeout || 10000;
      const globalName = config.globalName;
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
              $t("browser.moduleLoadTimeout", {
                globalName,
                entry: config.entryPoint,
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
            $t("browser.moduleLoadTimeoutTestReady", {
              entry: config.entryPoint,
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
