/**
 * @module @dreamer/test
 *
 * 测试工具库，基于 Deno 内置测试框架，提供 Mock 工具、断言增强、测试工具函数等高级功能。
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
 * import { describe, it, expect, mockFn } from "jsr:@dreamer/test";
 *
 * describe("测试套件", () => {
 *   it("应该通过", () => {
 *     expect(1 + 1).toBe(2);
 *   });
 * });
 * ```
 */

// 重新导出测试 API
// 注意：@std/testing 没有默认导出，需要使用子路径 ./bdd
//
// 兼容性说明：
// - Deno: 直接支持 jsr: 协议，使用 `deno add jsr:@std/testing@1.0.16/bdd`
// - Bun: 使用 `bunx jsr add @std/testing@1.0.16/bdd` 安装后即可使用
//
// 安装方法：
// - Deno: `deno add jsr:@std/testing@1.0.16/bdd`
// - Bun: `bunx jsr add @std/testing@1.0.16/bdd`
import { describe, test } from "@std/testing/bdd";
export { describe, test };

/**
 * Mock 函数调用记录
 */
interface MockCall {
  /** 调用参数 */
  args: unknown[];
  /** 返回值 */
  result?: unknown;
  /** 调用时间 */
  timestamp: number;
}

/**
 * Mock 函数类型
 */
export interface MockFunction<T extends (...args: any[]) => any = any> {
  /** 原始函数（如果有） */
  originalFn?: T;
  /** 调用记录 */
  calls: MockCall[];
  /** 实现函数 */
  implementation?: T;
  /** 调用函数 */
  (...args: Parameters<T>): ReturnType<T>;
}

/**
 * 创建 Mock 函数
 * @param implementation 实现函数（可选）
 * @returns Mock 函数
 */
export function mockFn<T extends (...args: any[]) => any = any>(
  implementation?: T,
): MockFunction<T> {
  const calls: MockCall[] = [];

  const mock = function (...args: Parameters<T>): ReturnType<T> {
    const call: MockCall = {
      args: [...args],
      timestamp: Date.now(),
    };

    let result: ReturnType<T>;

    if (implementation) {
      result = implementation(...args);
    } else {
      result = undefined as ReturnType<T>;
    }

    call.result = result;
    calls.push(call);

    return result;
  } as MockFunction<T>;

  mock.calls = calls;
  mock.implementation = implementation;

  return mock;
}

/**
 * 期望值匹配器
 */
export class Expect {
  constructor(public actual: unknown) {}

  /**
   * 严格相等
   */
  toBe(expected: unknown): void {
    if (this.actual !== expected) {
      throw new Error(
        `期望值: ${JSON.stringify(expected)}, 实际值: ${
          JSON.stringify(this.actual)
        }`,
      );
    }
  }

  /**
   * 深度相等
   */
  toEqual(expected: unknown): void {
    if (!this.deepEqual(this.actual, expected)) {
      throw new Error(
        `期望值: ${JSON.stringify(expected)}, 实际值: ${
          JSON.stringify(this.actual)
        }`,
      );
    }
  }

  /**
   * 为真值
   */
  toBeTruthy(): void {
    if (!this.actual) {
      throw new Error(`期望值为真，实际值: ${JSON.stringify(this.actual)}`);
    }
  }

  /**
   * 为假值
   */
  toBeFalsy(): void {
    if (this.actual) {
      throw new Error(`期望值为假，实际值: ${JSON.stringify(this.actual)}`);
    }
  }

  /**
   * 为 null
   */
  toBeNull(): void {
    if (this.actual !== null) {
      throw new Error(`期望值为 null，实际值: ${JSON.stringify(this.actual)}`);
    }
  }

  /**
   * 为 undefined
   */
  toBeUndefined(): void {
    if (this.actual !== undefined) {
      throw new Error(
        `期望值为 undefined，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 已定义（不为 undefined）
   */
  toBeDefined(): void {
    if (this.actual === undefined) {
      throw new Error(`期望值已定义，实际值为 undefined`);
    }
  }

  /**
   * 匹配正则表达式
   */
  toMatch(regex: RegExp | string): void {
    const str = String(this.actual);
    const pattern = typeof regex === "string" ? new RegExp(regex) : regex;
    if (!pattern.test(str)) {
      throw new Error(
        `期望值匹配 ${pattern}，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 包含子字符串或元素
   */
  toContain(item: unknown): void {
    if (Array.isArray(this.actual)) {
      if (!this.actual.includes(item as never)) {
        throw new Error(
          `期望数组包含 ${JSON.stringify(item)}，实际值: ${
            JSON.stringify(this.actual)
          }`,
        );
      }
    } else if (typeof this.actual === "string") {
      if (!this.actual.includes(String(item))) {
        throw new Error(
          `期望字符串包含 ${String(item)}，实际值: ${
            JSON.stringify(this.actual)
          }`,
        );
      }
    } else {
      throw new Error("toContain 只能用于数组或字符串");
    }
  }

  /**
   * 大于
   */
  toBeGreaterThan(expected: number): void {
    if (typeof this.actual !== "number" || this.actual <= expected) {
      throw new Error(
        `期望值大于 ${expected}，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 大于等于
   */
  toBeGreaterThanOrEqual(expected: number): void {
    if (typeof this.actual !== "number" || this.actual < expected) {
      throw new Error(
        `期望值大于等于 ${expected}，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 小于
   */
  toBeLessThan(expected: number): void {
    if (typeof this.actual !== "number" || this.actual >= expected) {
      throw new Error(
        `期望值小于 ${expected}，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 小于等于
   */
  toBeLessThanOrEqual(expected: number): void {
    if (typeof this.actual !== "number" || this.actual > expected) {
      throw new Error(
        `期望值小于等于 ${expected}，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 为指定类型的实例
   */
  toBeInstanceOf(expected: new (...args: any[]) => any): void {
    if (!(this.actual instanceof expected)) {
      throw new Error(
        `期望值为 ${expected.name} 的实例，实际值: ${
          JSON.stringify(this.actual)
        }`,
      );
    }
  }

  /**
   * 抛出错误
   */
  toThrow(
    expectedError?: string | RegExp | (new (...args: any[]) => Error),
  ): void {
    if (typeof this.actual !== "function") {
      throw new Error("toThrow 只能用于函数");
    }

    try {
      this.actual();
      throw new Error("期望函数抛出错误，但函数成功执行");
    } catch (error) {
      if (expectedError === undefined) {
        // 只要抛出错误即可
        return;
      }

      if (typeof expectedError === "string") {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes(expectedError)) {
          throw new Error(
            `期望错误消息包含 "${expectedError}"，实际消息: ${errorMsg}`,
          );
        }
      } else if (expectedError instanceof RegExp) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!expectedError.test(errorMsg)) {
          throw new Error(
            `期望错误消息匹配 ${expectedError}，实际消息: ${errorMsg}`,
          );
        }
      } else if (typeof expectedError === "function") {
        if (!(error instanceof expectedError)) {
          throw new Error(
            `期望抛出 ${expectedError.name}，实际抛出: ${
              error instanceof Error ? error.constructor.name : typeof error
            }`,
          );
        }
      }
    }
  }

  /**
   * 反向匹配器
   */
  get not(): NotExpect {
    return new NotExpect(this.actual);
  }

  /**
   * 深度相等比较
   */
  protected deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }

    if (a === null || b === null || a === undefined || b === undefined) {
      return false;
    }

    if (typeof a !== typeof b) {
      return false;
    }

    if (typeof a !== "object") {
      return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }

      if (
        !this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        )
      ) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Mock 函数期望值匹配器
 */
export class MockExpect {
  constructor(private mock: MockFunction) {}

  /**
   * 被调用
   */
  toHaveBeenCalled(): void {
    if (this.mock.calls.length === 0) {
      throw new Error("期望 Mock 函数被调用，但未被调用");
    }
  }

  /**
   * 被调用指定次数
   */
  toHaveBeenCalledTimes(times: number): void {
    if (this.mock.calls.length !== times) {
      throw new Error(
        `期望 Mock 函数被调用 ${times} 次，实际调用 ${this.mock.calls.length} 次`,
      );
    }
  }

  /**
   * 使用指定参数被调用
   */
  toHaveBeenCalledWith(...args: unknown[]): void {
    const found = this.mock.calls.some((call) => {
      return this.deepEqual(call.args, args);
    });

    if (!found) {
      throw new Error(
        `期望 Mock 函数使用参数 ${
          JSON.stringify(args)
        } 被调用，但未找到匹配的调用`,
      );
    }
  }

  /**
   * 最后一次调用使用指定参数
   */
  toHaveBeenLastCalledWith(...args: unknown[]): void {
    if (this.mock.calls.length === 0) {
      throw new Error("期望 Mock 函数被调用，但未被调用");
    }

    const lastCall = this.mock.calls[this.mock.calls.length - 1];
    if (!this.deepEqual(lastCall.args, args)) {
      throw new Error(
        `期望最后一次调用使用参数 ${JSON.stringify(args)}，实际参数: ${
          JSON.stringify(lastCall.args)
        }`,
      );
    }
  }

  /**
   * 第 N 次调用使用指定参数
   */
  toHaveBeenNthCalledWith(n: number, ...args: unknown[]): void {
    if (n < 1 || n > this.mock.calls.length) {
      throw new Error(
        `期望第 ${n} 次调用，但只有 ${this.mock.calls.length} 次调用`,
      );
    }

    const nthCall = this.mock.calls[n - 1];
    if (!this.deepEqual(nthCall.args, args)) {
      throw new Error(
        `期望第 ${n} 次调用使用参数 ${JSON.stringify(args)}，实际参数: ${
          JSON.stringify(nthCall.args)
        }`,
      );
    }
  }

  /**
   * 深度相等比较
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }

    if (a === null || b === null || a === undefined || b === undefined) {
      return false;
    }

    if (typeof a !== typeof b) {
      return false;
    }

    if (typeof a !== "object") {
      return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }

      if (
        !this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        )
      ) {
        return false;
      }
    }

    return true;
  }
}

/**
 * 反向期望值匹配器
 */
class NotExpect extends Expect {
  constructor(actual: unknown) {
    super(actual);
  }

  /**
   * 严格相等（反向）
   */
  override toBe(expected: unknown): void {
    if (this.actual === expected) {
      throw new Error(
        `期望值不等于 ${JSON.stringify(expected)}，但实际值相等`,
      );
    }
  }

  /**
   * 深度相等（反向）
   */
  override toEqual(expected: unknown): void {
    if (this.deepEqual(this.actual, expected)) {
      throw new Error(
        `期望值不等于 ${JSON.stringify(expected)}，但实际值相等`,
      );
    }
  }

  /**
   * 为真值（反向）
   */
  override toBeTruthy(): void {
    if (this.actual) {
      throw new Error(`期望值为假，实际值: ${JSON.stringify(this.actual)}`);
    }
  }

  /**
   * 为假值（反向）
   */
  override toBeFalsy(): void {
    if (!this.actual) {
      throw new Error(`期望值为真，实际值为假`);
    }
  }

  /**
   * 为 null（反向）
   */
  override toBeNull(): void {
    if (this.actual === null) {
      throw new Error(`期望值不为 null，实际值为 null`);
    }
  }

  /**
   * 为 undefined（反向）
   */
  override toBeUndefined(): void {
    if (this.actual === undefined) {
      throw new Error(`期望值不为 undefined，实际值为 undefined`);
    }
  }

  /**
   * 已定义（反向）
   */
  override toBeDefined(): void {
    if (this.actual !== undefined) {
      throw new Error(
        `期望值未定义，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 匹配正则表达式（反向）
   */
  override toMatch(regex: RegExp | string): void {
    const str = String(this.actual);
    const pattern = typeof regex === "string" ? new RegExp(regex) : regex;
    if (pattern.test(str)) {
      throw new Error(
        `期望值不匹配 ${pattern}，但实际值匹配: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 包含子字符串或元素（反向）
   */
  override toContain(item: unknown): void {
    if (Array.isArray(this.actual)) {
      if (this.actual.includes(item as never)) {
        throw new Error(
          `期望数组不包含 ${JSON.stringify(item)}，但实际包含`,
        );
      }
    } else if (typeof this.actual === "string") {
      if (this.actual.includes(String(item))) {
        throw new Error(
          `期望字符串不包含 ${String(item)}，但实际包含`,
        );
      }
    } else {
      throw new Error("toContain 只能用于数组或字符串");
    }
  }

  /**
   * 抛出错误（反向）
   * @param expectedError 如果提供，只有当抛出的错误匹配此参数时才报错
   */
  override toThrow(
    expectedError?: string | RegExp | (new (...args: any[]) => Error),
  ): void {
    if (typeof this.actual !== "function") {
      throw new Error("toThrow 只能用于函数");
    }

    try {
      this.actual();
      // 函数没有抛出错误，符合预期
    } catch (error) {
      // 函数抛出了错误，需要检查是否匹配 expectedError
      if (expectedError === undefined) {
        // 没有指定错误类型，任何错误都应该报错
        throw new Error(
          `期望函数不抛出错误，但函数抛出了: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      // 检查错误是否匹配 expectedError
      let matches = false;
      if (typeof expectedError === "string") {
        const errorMsg = error instanceof Error ? error.message : String(error);
        matches = errorMsg.includes(expectedError);
      } else if (expectedError instanceof RegExp) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        matches = expectedError.test(errorMsg);
      } else if (typeof expectedError === "function") {
        matches = error instanceof expectedError;
      }

      // 如果错误匹配 expectedError，说明确实抛出了我们期望不抛出的错误
      if (matches) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const expectedDesc = typeof expectedError === "string"
          ? `"${expectedError}"`
          : expectedError instanceof RegExp
          ? expectedError.toString()
          : expectedError.name;
        throw new Error(
          `期望函数不抛出匹配 ${expectedDesc} 的错误，但函数抛出了: ${errorMsg}`,
        );
      }
      // 如果错误不匹配 expectedError，说明抛出了其他类型的错误
      // 在反向匹配器中，这可能也是不期望的，但为了保持一致性，我们只检查匹配的情况
    }
  }

  /**
   * 深度相等比较
   */
  protected override deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }

    if (a === null || b === null || a === undefined || b === undefined) {
      return false;
    }

    if (typeof a !== typeof b) {
      return false;
    }

    if (typeof a !== "object") {
      return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }

      if (
        !this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        )
      ) {
        return false;
      }
    }

    return true;
  }
}

/**
 * 期望值函数类型
 */
export interface ExpectFunction {
  (actual: unknown): Expect;
  /**
   * 使测试失败
   * @param message 失败消息
   */
  fail(message?: string): never;
}

/**
 * 创建期望值
 * @param actual 实际值
 * @returns Expect 实例
 */
export const expect: ExpectFunction = function (actual: unknown): Expect {
  return new Expect(actual);
} as ExpectFunction;

/**
 * 使测试失败
 * @param message 失败消息
 */
expect.fail = function (message?: string): never {
  throw new Error(message || "测试失败");
};

/**
 * 为 Mock 函数创建期望值
 * @param mock Mock 函数
 * @returns MockExpect 实例
 */
export function expectMock(mock: MockFunction): MockExpect {
  return new MockExpect(mock);
}

/**
 * 断言异步函数抛出错误
 * @param fn 异步函数
 * @param ErrorClass 错误类型（可选）
 * @param msgIncludes 错误消息包含的字符串（可选）
 */
export async function assertRejects(
  fn: () => Promise<unknown>,
  ErrorClass?: new (...args: any[]) => Error,
  msgIncludes?: string,
): Promise<void> {
  try {
    await fn();
    throw new Error("期望函数抛出错误，但函数成功执行");
  } catch (error) {
    if (ErrorClass && !(error instanceof ErrorClass)) {
      throw new Error(
        `期望抛出 ${ErrorClass.name}，实际抛出: ${
          error instanceof Error ? error.constructor.name : typeof error
        }`,
      );
    }

    if (msgIncludes) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes(msgIncludes)) {
        throw new Error(
          `期望错误消息包含 "${msgIncludes}"，实际消息: ${errorMsg}`,
        );
      }
    }
  }
}

/**
 * 断言异步函数成功执行
 * @param fn 异步函数
 * @param expected 期望返回值（可选）
 */
export async function assertResolves(
  fn: () => Promise<unknown>,
  expected?: unknown,
): Promise<void> {
  try {
    const result = await fn();
    if (expected !== undefined) {
      if (result !== expected) {
        throw new Error(
          `期望返回值: ${JSON.stringify(expected)}, 实际值: ${
            JSON.stringify(result)
          }`,
        );
      }
    }
  } catch (error) {
    throw new Error(
      `期望函数成功执行，但抛出错误: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * 断言深度相等
 * @param actual 实际值
 * @param expected 期望值
 * @param msg 错误消息（可选）
 */
export function assertDeepEqual(
  actual: unknown,
  expected: unknown,
  msg?: string,
): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(
      msg ||
        `期望值: ${JSON.stringify(expected)}, 实际值: ${
          JSON.stringify(actual)
        }`,
    );
  }
}

/**
 * 深度相等比较函数
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null || a === undefined || b === undefined) {
    return false;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (typeof a !== "object") {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key)) {
      return false;
    }

    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * 断言实例类型
 * @param actual 实际值
 * @param expected 期望类型
 * @param msg 错误消息（可选）
 */
export function assertInstanceOf(
  actual: unknown,
  expected: new (...args: any[]) => any,
  msg?: string,
): void {
  if (!(actual instanceof expected)) {
    throw new Error(
      msg ||
        `期望值为 ${expected.name} 的实例，实际值: ${JSON.stringify(actual)}`,
    );
  }
}

/**
 * 断言匹配正则表达式
 * @param actual 实际值
 * @param regex 正则表达式
 * @param msg 错误消息（可选）
 */
export function assertMatch(
  actual: unknown,
  regex: RegExp | string,
  msg?: string,
): void {
  const str = String(actual);
  const pattern = typeof regex === "string" ? new RegExp(regex) : regex;
  if (!pattern.test(str)) {
    throw new Error(
      msg || `期望值匹配 ${pattern}，实际值: ${JSON.stringify(actual)}`,
    );
  }
}

/**
 * 快照测试
 * @param t 测试上下文
 * @param value 要快照的值
 * @param hint 快照提示（可选）
 */
export async function assertSnapshot(
  t: Deno.TestContext,
  value: unknown,
  hint?: string,
): Promise<void> {
  const snapshotDir = ".snapshots";
  const testFile = t.name.replace(/\s+/g, "-");
  const snapshotFile = hint ? `${testFile}-${hint}.snap` : `${testFile}.snap`;
  const snapshotPath = `${snapshotDir}/${snapshotFile}`;

  // 确保快照目录存在
  try {
    await Deno.mkdir(snapshotDir, { recursive: true });
  } catch {
    // 目录可能已存在
  }

  const serialized = JSON.stringify(value, null, 2);

  // 读取现有快照
  let existingSnapshot: string | undefined;
  try {
    existingSnapshot = await Deno.readTextFile(snapshotPath);
  } catch {
    // 快照文件不存在，创建新快照
  }

  if (existingSnapshot === undefined) {
    // 首次运行，创建快照
    await Deno.writeTextFile(snapshotPath, serialized);
    return;
  }

  // 对比快照
  if (existingSnapshot !== serialized) {
    throw new Error(
      `快照不匹配\n期望:\n${existingSnapshot}\n实际:\n${serialized}`,
    );
  }
}

/**
 * Setup/Teardown 钩子
 */
export interface TestHooks {
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
}

/**
 * 测试套件配置
 */
const currentHooks: TestHooks = {};

/**
 * 设置 beforeAll 钩子
 */
export function beforeAll(fn: () => void | Promise<void>): void {
  currentHooks.beforeAll = fn;
}

/**
 * 设置 afterAll 钩子
 */
export function afterAll(fn: () => void | Promise<void>): void {
  currentHooks.afterAll = fn;
}

/**
 * 设置 beforeEach 钩子
 */
export function beforeEach(fn: () => void | Promise<void>): void {
  currentHooks.beforeEach = fn;
}

/**
 * 设置 afterEach 钩子
 */
export function afterEach(fn: () => void | Promise<void>): void {
  currentHooks.afterEach = fn;
}

/**
 * 参数化测试
 * @param cases 测试用例数组
 * @param fn 测试函数
 */
export function testEach<T extends unknown[]>(
  cases: T[],
): (name: string, fn: (...args: T) => void | Promise<void>) => void {
  return (name: string, fn: (...args: T) => void | Promise<void>) => {
    for (const testCase of cases) {
      const caseName = name.replace(/%\w+/g, (match) => {
        const index = match.slice(1);
        // 尝试从测试用例中获取对应的值
        if (Array.isArray(testCase)) {
          const idx = parseInt(index, 10);
          if (!isNaN(idx) && idx >= 0 && idx < testCase.length) {
            return String(testCase[idx]);
          }
        }
        return match;
      });

      test(`${caseName}`, async () => {
        if (currentHooks.beforeEach) {
          await currentHooks.beforeEach();
        }

        try {
          await fn(...testCase);

          if (currentHooks.afterEach) {
            await currentHooks.afterEach();
          }
        } catch (error) {
          if (currentHooks.afterEach) {
            await currentHooks.afterEach();
          }
          throw error;
        }
      });
    }
  };
}

/**
 * 基准测试
 * @param name 测试名称
 * @param fn 测试函数
 * @param options 选项
 */
export function bench(
  name: string,
  fn: () => void | Promise<void>,
  options?: {
    /** 运行次数（默认：100） */
    n?: number;
    /** 预热次数（默认：10） */
    warmup?: number;
  },
): void {
  const n = options?.n || 100;
  const warmup = options?.warmup || 10;

  test(`bench: ${name}`, async () => {
    // 预热
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // 正式测试
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      await fn();
    }
    const end = performance.now();

    const avgTime = (end - start) / n;
    console.log(
      `基准测试 "${name}": 平均 ${avgTime.toFixed(3)}ms (${n} 次运行)`,
    );
  });
}

/**
 * HTTP Mock 配置
 */
export interface MockFetchOptions {
  /** HTTP 方法 */
  method?: string;
  /** 请求体 */
  requestBody?: unknown;
  /** 响应配置 */
  response: {
    /** 状态码 */
    status: number;
    /** 响应头 */
    headers?: Record<string, string>;
    /** 响应体 */
    body?: string | unknown;
  };
}

/**
 * HTTP Mock 函数
 */
export interface MockFetchFunction {
  /** 调用记录 */
  calls: Array<{
    url: string;
    options?: RequestInit;
  }>;
  /** 恢复原始 fetch */
  restore(): void;
}

/**
 * Mock fetch 函数
 * @param urlPattern URL 模式（字符串或正则表达式）
 * @param options Mock 配置
 * @returns Mock 函数
 */
export function mockFetch(
  urlPattern: string | RegExp,
  options: MockFetchOptions,
): MockFetchFunction {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; options?: RequestInit }> = [];

  const mockFn = function (input: string | URL | Request, init?: RequestInit) {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

    // 检查 URL 是否匹配
    const matches = typeof urlPattern === "string"
      ? url === urlPattern
      : urlPattern.test(url);

    if (!matches) {
      // 不匹配，使用原始 fetch
      return originalFetch(input, init);
    }

    // 记录调用
    calls.push({ url, options: init });

    // 检查方法是否匹配
    const method = init?.method || "GET";
    if (
      options.method && method.toUpperCase() !== options.method.toUpperCase()
    ) {
      return originalFetch(input, init);
    }

    // 检查请求体是否匹配
    if (options.requestBody !== undefined) {
      const requestBody = init?.body
        ? (typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body))
        : undefined;
      const expectedBody = typeof options.requestBody === "string"
        ? options.requestBody
        : JSON.stringify(options.requestBody);

      if (requestBody !== expectedBody) {
        return originalFetch(input, init);
      }
    }

    // 返回 Mock 响应
    const responseBody = typeof options.response.body === "string"
      ? options.response.body
      : JSON.stringify(options.response.body);

    return Promise.resolve(
      new Response(responseBody, {
        status: options.response.status,
        headers: options.response.headers,
      }),
    );
  } as typeof fetch;

  // 替换全局 fetch
  globalThis.fetch = mockFn;

  const mock: MockFetchFunction = {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };

  return mock;
}

// 导出 it 作为 test 的别名
export const it = test;
