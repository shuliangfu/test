/**
 * @fileoverview 浏览器相关 `it` 用例的超时常量
 *
 * `createBrowserContext` / `setupBrowserTest` 内 Playwright `launch` 默认可达 120s，
 * 且 bundled Chromium 超时后会再尝试系统 Chrome 一遍；若 `it` 仅设 15s～30s，
 * 会在浏览器尚未连上 CDP 时先触发「Test timeout」，表现为假死或误报。
 */

/** 单次用例应覆盖完整启动（含一次系统 Chrome 回退），留足余量 */
export const PLAYWRIGHT_BROWSER_IT_TIMEOUT_MS = 300_000;
