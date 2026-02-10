/**
 * @module @dreamer/test/browser/dependencies
 *
 * @fileoverview 浏览器测试依赖管理
 * 提供 Playwright 和 @dreamer/esbuild 的静态导入
 */

/**
 * 导入 Playwright（静态导入）
 */
import playwright from "playwright";

/**
 * 导入 @dreamer/esbuild 的 buildBundle 函数
 */
import {
  buildBundle,
  type BundleOptions,
  type BundleResult,
} from "@dreamer/esbuild";

/**
 * 获取 Playwright 模块（含 chromium / firefox / webkit）
 *
 * @returns Playwright 模块
 */
export function getPlaywright(): typeof playwright {
  return playwright;
}

/**
 * 获取 Playwright 的 Chromium 浏览器对象，用于 launch
 *
 * @returns Playwright Chromium 对象
 */
export function getChromium(): typeof playwright.chromium {
  return playwright.chromium;
}

/**
 * 获取 buildBundle 函数
 *
 * @returns buildBundle 函数
 */
export function getBuildBundle(): typeof buildBundle {
  return buildBundle;
}

// 重新导出类型
export type { BundleOptions, BundleResult };
