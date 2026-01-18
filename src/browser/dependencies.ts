/**
 * @module @dreamer/test/browser/dependencies
 *
 * @fileoverview 浏览器测试依赖管理
 * 提供 Puppeteer 和 @dreamer/esbuild 的静态导入
 */

/**
 * 导入 Puppeteer（静态导入）
 */
import puppeteer from "puppeteer";

/**
 * 导入 @dreamer/esbuild 的 buildBundle 函数
 */
import {
  buildBundle,
  type BundleOptions,
  type BundleResult,
} from "@dreamer/esbuild";

/**
 * 获取 Puppeteer 模块
 *
 * @returns Puppeteer 模块
 */
export function getPuppeteer(): typeof puppeteer {
  return puppeteer;
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
