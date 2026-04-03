/**
 * @module @dreamer/test
 *
 * 测试工具库：Jest 风格的 `describe` / `it`、断言、Mock、浏览器（Playwright）与打包校验（`bundleOnly`）。
 *
 * 功能特性：
 * - Mock：函数 / 模块 / HTTP / 时间
 * - 断言与快照
 * - 钩子：`beforeAll` / `afterEach` 等（见 `test-utils`）
 * - 参数化：`testEach`（与 `it` 共用同一套钩子与超时逻辑）
 * - 基准：`bench`（简单循环计时输出）
 * - 浏览器测试：`browser: { enabled: true, entryPoint }`；**仅校验 bundle** 时用 `bundleOnly: true`（不启动 Playwright，见 `TestContext.browserBundle`）
 *
 * **代码覆盖率**：请使用运行器自带能力（如 `deno test --coverage`），本包不内置覆盖率收集。
 *
 * @example
 * ```typescript
 * import { describe, it, expect } from "@dreamer/test";
 *
 * describe("套件", () => {
 *   it("应通过", () => {
 *     expect(1 + 1).toBe(2);
 *   });
 * });
 * ```
 */

// i18n 仅包内使用，不对外导出

export { describe, it, test } from "./test-runner.ts";
export type { DescribeOptions, TestContext } from "./types.ts";

export { expectMock, MockExpect, mockFn } from "./mock.ts";
export type { MockFunction } from "./types.ts";

export { expect } from "./expect.ts";
export type { ExpectFunction } from "./types.ts";

export {
  assertDeepEqual,
  assertInstanceOf,
  assertMatch,
  assertRejects,
  assertResolves,
} from "./assertions.ts";

export { assertSnapshot } from "./snapshot.ts";

export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  bench,
  testEach,
} from "./test-utils.ts";

export { mockFetch } from "./mock-fetch.ts";
export type { MockFetchFunction, MockFetchOptions } from "./types.ts";

export { createCookieDocument } from "./mock-document.ts";

export { cleanupAllBrowsers, cleanupSuiteBrowser } from "./test-runner.ts";
export type { BrowserBundleArtifact, BrowserTestConfig } from "./types.ts";
