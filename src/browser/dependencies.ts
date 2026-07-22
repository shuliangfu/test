/**
 * @module @dreamer/test/browser/dependencies
 *
 * @fileoverview 浏览器测试依赖管理
 * 提供 Playwright 和 @dreamer/esbuild 的懒加载导入
 *
 * Why 懒加载：非浏览器测试不应加载 @dreamer/esbuild（其传递依赖的 runtime-adapter
 * 版本可能滞后）。仅当实际运行浏览器测试时才动态 import，避免无关依赖污染。
 * 类型导入（import type）在编译期擦除，零运行时成本。
 */

import type { BundleOptions, BundleResult } from "@dreamer/esbuild";

/** Playwright 模块缓存（懒加载） */
let _playwright: typeof import("playwright") | null = null;

/** buildBundle 函数缓存（懒加载） */
let _buildBundle: typeof import("@dreamer/esbuild")["buildBundle"] | null = null;

/**
 * 获取 Playwright 模块（含 chromium / firefox / webkit）
 *
 * @returns Playwright 模块
 */
export async function getPlaywright(): Promise<typeof import("playwright")> {
  if (!_playwright) {
    _playwright = await import("playwright");
  }
  return _playwright;
}

/**
 * 获取 Playwright 的 Chromium 浏览器对象，用于 launch
 *
 * @returns Playwright Chromium 对象
 */
export async function getChromium(): Promise<
  typeof import("playwright")["chromium"]
> {
  const pw = await getPlaywright();
  return pw.chromium;
}

/**
 * 获取 buildBundle 函数
 *
 * @returns buildBundle 函数
 */
export async function getBuildBundle(): Promise<
  typeof import("@dreamer/esbuild")["buildBundle"]
> {
  if (!_buildBundle) {
    const mod = await import("@dreamer/esbuild");
    _buildBundle = mod.buildBundle;
  }
  return _buildBundle;
}

// 重新导出类型
export type { BundleOptions, BundleResult };
