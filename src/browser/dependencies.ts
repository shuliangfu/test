/**
 * @module @dreamer/test/browser/dependencies
 *
 * @fileoverview 浏览器测试依赖管理
 * 提供 Puppeteer 和 esbuild 的静态导入
 */

/**
 * 导入 Puppeteer（静态导入）
 */
import puppeteer from "puppeteer";

/**
 * 导入 esbuild（静态导入）
 */
import * as esbuild from "esbuild";

/**
 * 获取 Puppeteer 模块
 *
 * @returns Puppeteer 模块
 */
export function getPuppeteer(): typeof puppeteer {
  return puppeteer;
}

/**
 * 获取 esbuild 模块
 *
 * @returns esbuild 模块
 */
export function getEsbuild(): typeof esbuild {
  return esbuild;
}
