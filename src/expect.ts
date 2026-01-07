/**
 * Expect 断言模块
 * 提供期望值匹配器和断言功能
 */

import type { ExpectFunction } from "./types.ts";

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
 * 创建期望值函数
 * @param actual 实际值
 * @returns Expect 实例
 */
function expectFn(actual: unknown): Expect {
  return new Expect(actual);
}

/**
 * 使测试失败
 * @param message 失败消息
 */
expectFn.fail = function (message?: string): never {
  throw new Error(message || "测试失败");
};

/**
 * 导出 expect 函数
 */
export const expect: ExpectFunction = expectFn as ExpectFunction;

// expectMock 在 mock.ts 中定义，这里不需要重复导出
