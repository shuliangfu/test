/**
 * Mock 功能模块
 * 提供函数 Mock 和 Mock 期望值匹配器
 */

import type { MockCall, MockFunction } from "./types.ts";

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
 * 为 Mock 函数创建期望值
 * @param mock Mock 函数
 * @returns MockExpect 实例
 */
export function expectMock(mock: MockFunction): MockExpect {
  return new MockExpect(mock);
}
