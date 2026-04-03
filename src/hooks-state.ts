/**
 * @module hooks-state
 * @description 套件级钩子暂存区，供 `beforeAll` / `test-utils` 与 `test-runner` 同步到 `currentSuite`，
 * 避免 `test-runner` ↔ `test-utils` 循环依赖（runner 不再 import test-utils 仅为了 clear）。
 */

import type { TestHooks } from "./types.ts";

/** 当前 `describe` 回调执行期间，由 `beforeAll` 等写入的钩子草稿 */
export const pendingSuiteHooks: TestHooks = {};

/**
 * 在 `describe` 的 `finally` 中调用，防止钩子泄漏到兄弟套件。
 */
export function clearPendingSuiteHooks(): void {
  pendingSuiteHooks.beforeAll = undefined;
  pendingSuiteHooks.afterAll = undefined;
  pendingSuiteHooks.beforeEach = undefined;
  pendingSuiteHooks.afterEach = undefined;
  pendingSuiteHooks.options = undefined;
}
