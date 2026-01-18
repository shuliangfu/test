/**
 * @module @dreamer/test/browser/browser-context
 *
 * @fileoverview 浏览器测试上下文管理
 * 创建和管理 Puppeteer 浏览器实例和页面
 */

import { removeSync } from "@dreamer/runtime-adapter";
import type { BrowserTestConfig } from "../types.ts";
import { buildClientBundle } from "./bundle.ts";
import { findChromePath } from "./chrome.ts";
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

  // 检测 Chrome 路径
  const executablePath = config.executablePath || findChromePath();

  // 启动浏览器
  const browser = await puppeteer.launch({
    headless: config.headless !== false,
    executablePath,
    args: config.args || [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

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

      // 打包客户端代码
      const bundle = await buildClientBundle({
        entryPoint: config.entryPoint,
        globalName: config.globalName,
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
              ? `\n浏览器控制台错误: ${consoleErrors.join("\n")}`
              : "";
            throw new Error(
              `模块加载超时：无法找到全局变量 "${globalName}" 或 testReady 标记未设置。` +
                `入口文件: ${config.entryPoint}${errorDetails}`,
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
            ? `\n浏览器控制台错误: ${consoleErrors.join("\n")}`
            : "";
          throw new Error(
            `模块加载超时：testReady 标记未设置。` +
              `入口文件: ${config.entryPoint}${errorDetails}`,
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
