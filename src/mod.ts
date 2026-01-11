/**
 * @module @dreamer/test
 *
 * 测试工具库，提供 Mock 工具、断言增强、测试工具函数等高级功能。
 *
 * 功能特性：
 * - Mock 工具：函数 Mock、模块 Mock、HTTP Mock、时间 Mock
 * - 断言增强：异步断言、对象断言、快照断言
 * - 测试工具函数：Setup/Teardown、参数化测试、测试分组
 * - 性能测试：基准测试、性能对比
 * - 测试覆盖率：覆盖率收集和报告生成
 *
 * @example
 * ```typescript
 * import { describe, it, expect, mockFn } from "@dreamer/test";
 *
 * describe("测试套件", () => {
 *   it("应该通过", () => {
 *     expect(1 + 1).toBe(2);
 *   });
 * });
 * ```
 */

// 导出测试运行器
export { describe, it, test } from "./test-runner.ts";
export type { DescribeOptions, TestContext } from "./types.ts";

// 导出 Mock 功能
export { expectMock, MockExpect, mockFn } from "./mock.ts";
export type { MockFunction } from "./types.ts";

// 导出 Expect 断言
export { expect } from "./expect.ts";
export type { ExpectFunction } from "./types.ts";

// 导出断言工具函数
export {
  assertDeepEqual,
  assertInstanceOf,
  assertMatch,
  assertRejects,
  assertResolves,
} from "./assertions.ts";

// 导出快照测试
export { assertSnapshot } from "./snapshot.ts";

// 导出测试工具函数
export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  bench,
  testEach,
} from "./test-utils.ts";

// 导出 HTTP Mock
export { mockFetch } from "./mock-fetch.ts";
export type { MockFetchFunction, MockFetchOptions } from "./types.ts";
