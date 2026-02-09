/**
 * @module @dreamer/test/browser/browser-context
 *
 * @fileoverview 浏览器测试上下文管理
 * 创建和管理 Puppeteer 浏览器实例和页面
 */

import {
  existsSync,
  getEnv,
  join,
  removeSync,
  writeStderrSync,
} from "@dreamer/runtime-adapter";
import {
  Browser,
  computeExecutablePath,
  detectBrowserPlatform,
  getDownloadUrl,
  install,
} from "@puppeteer/browsers";
import type { BrowserTestConfig } from "../types.ts";
import { buildClientBundle } from "./bundle.ts";
import { getPuppeteer } from "./dependencies.ts";
import { createTestPage } from "./page.ts";

/**
 * 浏览器测试上下文
 */
export interface BrowserContext {
  /** Puppeteer Browser 实例 */
  browser: any;
  /** Puppeteer Page 实例 */
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

/** ANSI 绿色 */
const GREEN = "\x1b[32m";
/** ANSI 黄色 */
const YELLOW = "\x1b[33m";
/** ANSI 红色 */
const RED = "\x1b[31m";
/** ANSI 重置 */
const RESET = "\x1b[0m";

/**
 * 下载进度引用，用于 install 的 downloadProgressCallback 与 spinner 共享
 */
interface ProgressRef {
  downloaded: number;
  total: number;
}

/**
 * 在终端中显示旋转的 loading 动画并执行异步任务
 * 使用 stderr 输出，test 仅于命令行运行
 * @param message - 显示文案
 * @param fn - 要执行的异步函数
 * @param progressRef - 可选，install 下载进度引用，有值时显示下载百分比
 */
async function runWithSpinner<T>(
  message: string,
  fn: () => Promise<T>,
  progressRef?: ProgressRef,
): Promise<T> {
  const encoder = new TextEncoder();
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = setInterval(() => {
    const frame = frames[i % frames.length];
    let text = message;
    if (progressRef && progressRef.total > 0) {
      const pct = Math.round(
        (100 * progressRef.downloaded) / progressRef.total,
      );
      text = `${message} ${pct}%`;
    }
    writeStderrSync(
      encoder.encode(
        `\r[dreamer/test] ${GREEN}${frame}${RESET} ${YELLOW}${text}${RESET}    `,
      ),
    );
    i += 1;
  }, 50);
  try {
    const result = await fn();
    clearInterval(interval);
    const finalMsg = progressRef && progressRef.total > 0
      ? `${message} 100%`
      : message;
    writeStderrSync(
      encoder.encode(
        `\r[dreamer/test] ${GREEN}✓${RESET} ${YELLOW}${finalMsg}${RESET}\n`,
      ),
    );
    return result;
  } catch (e) {
    clearInterval(interval);
    writeStderrSync(
      encoder.encode(
        `\r[dreamer/test] ${RED}✗${RESET} ${YELLOW}${message}${RESET}\n`,
      ),
    );
    throw e;
  }
}

/**
 * 格式化 Chrome 安装失败/超时时的提示信息
 * 包含下载链接、版本号、缓存目录，便于用户手动下载或排查
 * @param buildId - Chrome 版本（如 131.0.6778.85 或 stable）
 * @param cacheDir - 缓存目录路径
 * @returns 多行提示文本
 */
function formatChromeInstallHint(buildId: string, cacheDir: string): string {
  const lines: string[] = [
    "Chrome for Testing download failed or timed out.",
    `  Version: ${buildId}`,
    `  Cache dir: ${cacheDir}`,
    "  Manual install: npx @puppeteer/browsers install chrome@" + buildId,
  ];
  // 仅当 buildId 为具体版本号时能生成下载 URL（stable 需 resolve，无法直接给 URL）
  const isVersion = /^\d+\.\d+\.\d+\.\d+$/.test(buildId);
  if (isVersion) {
    try {
      const platform = detectBrowserPlatform();
      if (platform) {
        const url = getDownloadUrl(Browser.CHROME, platform, buildId);
        lines.splice(2, 0, `  Download: ${url.toString()}`);
      }
    } catch {
      // 忽略 getDownloadUrl 失败
    }
  }
  return lines.join("\n");
}

/**
 * 输出 Chrome 安装失败/超时提示到 stderr
 */
function outputChromeInstallHint(buildId: string, cacheDir: string): void {
  const hint = formatChromeInstallHint(buildId, cacheDir);
  writeStderrSync(
    new TextEncoder().encode(`\n[dreamer/test] ${GREEN}${hint}${RESET}\n\n`),
  );
}

/**
 * 创建浏览器测试上下文
 *
 * 根据配置创建 Puppeteer 浏览器实例，如果配置了 entryPoint，
 * 会自动打包客户端代码并创建测试页面。
 *
 * @param config - 浏览器测试配置
 * @returns 浏览器测试上下文
 */
export async function createBrowserContext(
  config: BrowserTestConfig,
): Promise<BrowserContext> {
  const puppeteer = getPuppeteer();

  // 优先使用 config.executablePath；不传则用 Puppeteer 自带的 Chrome for Testing
  const executablePath = config.executablePath;

  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-extensions",
  ];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: config.headless !== false,
      ...(executablePath ? { executablePath } : {}),
      args: config.args || defaultArgs,
      timeout: 60000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const needAutoInstall = !executablePath &&
      (msg.includes("Could not find Chrome") ||
        msg.includes("executable is missing"));
    if (needAutoInstall) {
      const home = getEnv("HOME") ?? getEnv("USERPROFILE") ?? "";
      const cacheDir = getEnv("PUPPETEER_CACHE_DIR") ??
        (home ? join(home, ".cache", "puppeteer") : "");
      const verMatch = msg.match(/ver\.\s*([\d.]+)/);
      const buildId = verMatch ? verMatch[1] : "stable";
      try {
        if (cacheDir) {
          const chromeDir = join(cacheDir, "chrome");
          const exePath = computeExecutablePath({
            browser: Browser.CHROME,
            buildId,
            cacheDir,
          });
          if (existsSync(exePath)) {
            // Chrome 已安装（解压完成），直接 launch，避免 install() 卡住不退出
            browser = await puppeteer.launch({
              headless: config.headless !== false,
              args: config.args || defaultArgs,
              timeout: 60000,
            });
          } else {
            try {
              removeSync(chromeDir, { recursive: true });
            } catch {
              // 忽略删除失败（可能不存在）
            }
            const progressRef: ProgressRef = { downloaded: 0, total: 0 };
            const INSTALL_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟，install 解压阶段可能卡住
            await runWithSpinner(
              `Installing Chrome for Testing (${buildId})`,
              async () => {
                const installPromise = install({
                  browser: Browser.CHROME,
                  buildId,
                  cacheDir,
                  downloadProgressCallback: (downloaded, total) => {
                    progressRef.downloaded = downloaded;
                    progressRef.total = total;
                  },
                });
                const timeoutPromise = new Promise<never>((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Install timeout (5min)...")),
                    INSTALL_TIMEOUT_MS,
                  )
                );
                try {
                  await Promise.race([installPromise, timeoutPromise]);
                } catch (e) {
                  outputChromeInstallHint(buildId, cacheDir);
                  if (
                    e instanceof Error &&
                    e.message.includes("Install timeout")
                  ) {
                    // 解压阶段可能卡住但 chrome 已就绪，继续尝试 launch
                    writeStderrSync(
                      new TextEncoder().encode(
                        `\r[dreamer/test] Install timeout, trying launch anyway...\n`,
                      ),
                    );
                  } else {
                    throw e;
                  }
                }
              },
              progressRef,
            );
            browser = await puppeteer.launch({
              headless: config.headless !== false,
              args: config.args || defaultArgs,
              timeout: 60000,
            });
          }
        } else {
          throw new Error(
            `${msg}\n\nFix: Run \`npx puppeteer browsers install chrome\` or set HOME.`,
          );
        }
      } catch (installErr) {
        outputChromeInstallHint(buildId, cacheDir);
        const hint = "\n\nFix: Run `npx @puppeteer/browsers install chrome@" +
          buildId +
          "` or see the hint above.";
        throw new Error(
          `${msg}${
            installErr instanceof Error ? ` (${installErr.message})` : ""
          }${hint}`,
        );
      }
    } else {
      const hint = msg.includes("Could not find Chrome")
        ? "\n\nFix: Run `npx puppeteer browsers install chrome`."
        : "";
      throw new Error(`${msg}${hint}`);
    }
  }

  let page;
  let htmlPath: string = "";

  try {
    page = await browser.newPage();

    // 如果配置了 entryPoint，自动打包和创建页面
    if (config.entryPoint) {
      // 在页面加载前设置错误监听器，以便捕获所有运行时错误
      const consoleErrors: string[] = [];
      page.on("console", (msg: any) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (error: any) => {
        consoleErrors.push(error.message);
      });

      // 打包客户端代码（browserMode: false 时会把 JSR 打进去，避免浏览器里 require() 报错）
      const bundle = await buildClientBundle({
        entryPoint: config.entryPoint,
        globalName: config.globalName,
        browserMode: config.browserMode,
      });

      // 创建测试页面
      htmlPath = await createTestPage({
        bundleCode: bundle,
        bodyContent: config.bodyContent,
        template: config.htmlTemplate,
      });

      // 加载页面
      await page.goto(`file://${htmlPath}`, {
        waitUntil: "networkidle0",
      });

      // 等待模块加载
      const moduleLoadTimeout = config.moduleLoadTimeout || 10000;
      const globalName = config.globalName;
      if (globalName) {
        // 等待全局变量存在且 testReady 标记已设置
        try {
          await page.waitForFunction(
            (name: string) => {
              return typeof (globalThis as any).window[name] !== "undefined" &&
                (globalThis as any).window.testReady === true;
            },
            { timeout: moduleLoadTimeout },
            globalName,
          );
        } catch (_error) {
          // 如果超时，尝试只检查全局变量（可能 testReady 设置失败）
          try {
            await page.waitForFunction(
              (name: string) =>
                typeof (globalThis as any).window[name] !== "undefined",
              { timeout: 2000 },
              globalName,
            );
          } catch (_retryError) {
            // 如果仍然失败，抛出更详细的错误信息
            const errorDetails = consoleErrors.length > 0
              ? `\nBrowser console errors: ${consoleErrors.join("\n")}`
              : "";
            throw new Error(
              `Module load timeout: cannot find global "${globalName}" or testReady not set. ` +
                `Entry file: ${config.entryPoint}${errorDetails}`,
            );
          }
        }
      } else {
        // 如果没有 globalName，只等待 testReady 标记
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
            `Module load timeout: testReady not set. ` +
              `Entry file: ${config.entryPoint}${errorDetails}`,
          );
        }
      }
    }
  } catch (error) {
    // 如果创建页面或加载失败，确保关闭浏览器
    try {
      await browser.close();
    } catch {
      // 忽略关闭错误
    }
    throw error;
  }

  // 保存当前页面引用，以便在复用浏览器时更新
  const currentPage = page!;

  const context: BrowserContext = {
    browser,
    page: currentPage,
    htmlPath,
    async evaluate<T>(fn: () => T | Promise<T>): Promise<T> {
      return await context.page.evaluate(fn);
    },
    async goto(url: string): Promise<void> {
      await context.page.goto(url, { waitUntil: "networkidle0" });
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
        // 忽略关闭错误
      }
      try {
        await browser.close();
      } catch {
        // 忽略关闭错误
      }
      // 清理临时 HTML 文件
      if (context.htmlPath) {
        try {
          removeSync(context.htmlPath);
        } catch {
          // 忽略删除错误
        }
      }
    },
  };

  return context;
}
