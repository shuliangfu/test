/**
 * @module @dreamer/test/browser/chrome
 *
 * @fileoverview Chrome 路径检测
 * 跨平台检测系统 Chrome/Chromium 可执行文件路径
 */

import { existsSync, statSync } from "@dreamer/runtime-adapter";

/**
 * Chrome 路径配置（跨平台支持）
 */
const CHROME_PATHS = {
  mac: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
  windows: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

/**
 * 检测系统 Chrome 可执行文件路径
 *
 * 按顺序检查 macOS、Linux、Windows 的常见 Chrome 安装路径。
 * 如果找到有效的可执行文件，返回其路径；否则返回 undefined。
 *
 * @returns Chrome 路径，如果未找到则返回 undefined
 *
 * @example
 * ```typescript
 * import { findChromePath } from "@dreamer/test/browser";
 *
 * const chromePath = findChromePath();
 * if (chromePath) {
 *   console.log(`找到 Chrome: ${chromePath}`);
 * }
 * ```
 */
export function findChromePath(): string | undefined {
  const allPaths = [
    ...CHROME_PATHS.mac,
    ...CHROME_PATHS.linux,
    ...CHROME_PATHS.windows,
  ];

  for (const path of allPaths) {
    try {
      if (existsSync(path)) {
        const stat = statSync(path);
        if (stat.isFile) {
          return path;
        }
      }
    } catch {
      // 继续检查下一个路径
    }
  }

  return undefined;
}
