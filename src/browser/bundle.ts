/**
 * @module @dreamer/test/browser/bundle
 *
 * @fileoverview 客户端代码打包工具
 * 使用 @dreamer/esbuild 将客户端代码打包为浏览器兼容格式
 */

import { statSync } from "@dreamer/runtime-adapter";
import {
  type BundleOptions as EsbuildBundleOptions,
  getBuildBundle,
} from "./dependencies.ts";

/**
 * 打包结果缓存
 * key: entryPoint + globalName + platform + target + minify
 * value: 打包后的代码
 */
const bundleCache = new Map<string, { code: string; mtime: number }>();

/**
 * 客户端代码打包选项
 */
export interface BundleOptions {
  /** 入口文件路径 */
  entryPoint: string;
  /** 全局变量名（IIFE 格式） */
  globalName?: string;
  /** 目标平台（默认：browser） */
  platform?: "browser" | "node";
  /** 目标 ES 版本（默认：es2020） */
  target?: string;
  /** 是否压缩（默认：false） */
  minify?: boolean;
}

/**
 * 生成缓存键
 *
 * @param options - 打包选项
 * @returns 缓存键字符串
 */
function getCacheKey(options: BundleOptions): string {
  return `${options.entryPoint}:${options.globalName || ""}:${
    options.platform || "browser"
  }:${options.target || "es2020"}:${options.minify || false}`;
}

/**
 * 检查文件是否已修改
 *
 * @param filePath - 文件路径
 * @param cachedMtime - 缓存的修改时间
 * @returns 是否已修改
 */
function isFileModified(filePath: string, cachedMtime: number): boolean {
  try {
    const stat = statSync(filePath);
    return stat.mtime?.getTime() !== cachedMtime;
  } catch {
    return true; // 如果无法读取，认为已修改
  }
}

/**
 * 执行打包（带重试逻辑）
 * 使用 @dreamer/esbuild 的 buildBundle 函数
 * 当 esbuild 服务停止时，会尝试重新初始化
 *
 * @param options - 打包选项
 * @param retryCount - 重试次数（内部使用）
 * @returns 打包后的代码字符串
 */
async function executeBuild(
  options: BundleOptions,
  retryCount = 0,
): Promise<string> {
  const buildBundle = getBuildBundle();

  try {
    // 转换选项格式，适配 @dreamer/esbuild 的 BundleOptions
    // 如果指定了 globalName，使用 IIFE 格式；否则使用 ESM 格式
    const bundleOptions: EsbuildBundleOptions = {
      entryPoint: options.entryPoint,
      globalName: options.globalName,
      platform: options.platform || "browser",
      target: options.target || "es2020",
      minify: options.minify || false,
      format: options.globalName ? "iife" : "esm",
      sourcemap: false,
    };

    const result = await buildBundle(bundleOptions);
    return result.code;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 检测 esbuild 服务停止的错误，尝试重试
    if (
      errorMessage.includes("service is no longer running") ||
      errorMessage.includes("service was stopped")
    ) {
      if (retryCount < 2) {
        // 等待一小段时间后重试，让 esbuild 重新初始化
        await new Promise((resolve) => setTimeout(resolve, 100));
        return executeBuild(options, retryCount + 1);
      }
    }

    throw error;
  }
}

/**
 * 将客户端代码打包为浏览器兼容格式
 *
 * 使用 @dreamer/esbuild 将 TypeScript/JavaScript 代码打包为 IIFE 格式，
 * 可以在浏览器中直接使用。
 *
 * @param options - 打包选项
 * @returns 打包后的代码字符串
 *
 * @example
 * ```typescript
 * import { buildClientBundle } from "@dreamer/test/browser";
 *
 * const bundle = await buildClientBundle({
 *   entryPoint: "./src/client/mod.ts",
 *   globalName: "MyClient",
 * });
 * ```
 */
export async function buildClientBundle(
  options: BundleOptions,
): Promise<string> {
  // 检查缓存
  const cacheKey = getCacheKey(options);
  const cached = bundleCache.get(cacheKey);

  if (cached) {
    // 检查文件是否已修改
    if (!isFileModified(options.entryPoint, cached.mtime)) {
      return cached.code;
    }
  }

  try {
    const code = await executeBuild(options);

    // 更新缓存
    try {
      const stat = statSync(options.entryPoint);
      bundleCache.set(cacheKey, {
        code,
        mtime: stat.mtime?.getTime() || Date.now(),
      });
    } catch {
      // 如果无法获取文件信息，不缓存
    }

    return code;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `打包失败：${errorMessage}。入口文件: ${options.entryPoint}`,
    );
  }
}

/**
 * 清除打包缓存
 */
export function clearBundleCache(): void {
  bundleCache.clear();
}
