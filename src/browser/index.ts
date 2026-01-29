/**
 * @module @dreamer/test/browser
 *
 * @fileoverview 浏览器测试模块
 * 提供浏览器测试相关的工具函数和类型
 */

export { createBrowserContext } from "./browser-context.ts";
export type { BrowserContext } from "./browser-context.ts";
export { buildClientBundle, clearBundleCache } from "./bundle.ts";
export type { BundleOptions } from "./bundle.ts";
export { findChromePath } from "./chrome.ts";
export { getBuildBundle, getPuppeteer } from "./dependencies.ts";
export { createTestPage } from "./page.ts";
export type { TestPageOptions } from "./page.ts";
