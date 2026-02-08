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
  protected mock: MockFunction;

  constructor(mock: MockFunction) {
    this.mock = mock;
  }

  /**
   * 被调用
   */
  toHaveBeenCalled(): void {
    if (this.mock.calls.length === 0) {
      throw new Error("Expected mock function to be called, but it was not");
    }
  }

  /**
   * 被调用指定次数
   */
  toHaveBeenCalledTimes(times: number): void {
    if (this.mock.calls.length !== times) {
      throw new Error(
        `Expected mock to be called ${times} times, but was called ${this.mock.calls.length} times`,
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
        `Expected mock to be called with ${
          JSON.stringify(args)
        }, but no matching call found`,
      );
    }
  }

  /**
   * 最后一次调用使用指定参数
   */
  toHaveBeenLastCalledWith(...args: unknown[]): void {
    if (this.mock.calls.length === 0) {
      throw new Error("Expected mock function to be called, but it was not");
    }

    const lastCall = this.mock.calls[this.mock.calls.length - 1];
    if (!lastCall) {
      throw new Error("Cannot get last call");
    }
    if (!this.deepEqual(lastCall.args, args)) {
      throw new Error(
        `Expected last call with args ${JSON.stringify(args)}, actual: ${
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
        `Expected call #${n}, but only ${this.mock.calls.length} calls`,
      );
    }

    const nthCall = this.mock.calls[n - 1];
    if (!nthCall) {
      throw new Error(`Cannot get call #${n}`);
    }
    if (!this.deepEqual(nthCall.args, args)) {
      throw new Error(
        `Expected call #${n} with args ${JSON.stringify(args)}, actual: ${
          JSON.stringify(nthCall.args)
        }`,
      );
    }
  }

  /**
   * 返回了指定值
   */
  toHaveReturnedWith(expected: unknown): void {
    const found = this.mock.calls.some((call) => {
      return this.deepEqual(call.result, expected);
    });

    if (!found) {
      throw new Error(
        `Expected mock to return ${
          JSON.stringify(expected)
        }, but no matching return found`,
      );
    }
  }

  /**
   * 返回了值（任意值）
   */
  toHaveReturned(): void {
    const hasReturned = this.mock.calls.some((call) => {
      return call.result !== undefined;
    });

    if (!hasReturned) {
      throw new Error("Expected mock to return a value, but it did not");
    }
  }

  /**
   * 抛出了错误
   */
  toHaveThrown(): void {
    // 注意：当前实现中，如果函数抛出错误，调用会失败
    // 这个方法主要用于检查函数是否应该抛出错误
    // 实际实现可能需要特殊处理
    throw new Error(
      "toHaveThrown requires special implementation, not supported in current version",
    );
  }

  /**
   * 反向匹配器
   */
  get not(): MockNotExpect {
    return new MockNotExpect(this.mock);
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
 * Mock 函数反向期望值匹配器
 */
class MockNotExpect extends MockExpect {
  constructor(mock: MockFunction) {
    super(mock);
  }

  /**
   * 被调用（反向）
   */
  override toHaveBeenCalled(): void {
    if (this.mock.calls.length > 0) {
      throw new Error(
        `Expected mock not to be called, but was called ${this.mock.calls.length} times`,
      );
    }
  }

  /**
   * 被调用指定次数（反向）
   */
  override toHaveBeenCalledTimes(times: number): void {
    if (this.mock.calls.length === times) {
      throw new Error(
        `Expected mock not to be called ${times} times, but was called ${this.mock.calls.length} times`,
      );
    }
  }

  /**
   * 使用指定参数被调用（反向）
   */
  override toHaveBeenCalledWith(...args: unknown[]): void {
    const found = this.mock.calls.some((call) => {
      return this.deepEqual(call.args, args);
    });

    if (found) {
      throw new Error(
        `Expected mock not to be called with ${
          JSON.stringify(args)
        }, but matching call found`,
      );
    }
  }

  /**
   * 最后一次调用使用指定参数（反向）
   */
  override toHaveBeenLastCalledWith(...args: unknown[]): void {
    if (this.mock.calls.length > 0) {
      const lastCall = this.mock.calls[this.mock.calls.length - 1];
      if (lastCall && this.deepEqual(lastCall.args, args)) {
        throw new Error(
          `Expected last call not to use args ${
            JSON.stringify(args)
          }, but it did`,
        );
      }
    }
  }

  /**
   * 第 N 次调用使用指定参数（反向）
   */
  override toHaveBeenNthCalledWith(n: number, ...args: unknown[]): void {
    if (n >= 1 && n <= this.mock.calls.length) {
      const nthCall = this.mock.calls[n - 1];
      if (nthCall && this.deepEqual(nthCall.args, args)) {
        throw new Error(
          `Expected call #${n} not to use args ${
            JSON.stringify(args)
          }, but it did`,
        );
      }
    }
  }

  /**
   * 返回了指定值（反向）
   */
  override toHaveReturnedWith(expected: unknown): void {
    const found = this.mock.calls.some((call) => {
      return this.deepEqual(call.result, expected);
    });

    if (found) {
      throw new Error(
        `Expected mock not to return ${
          JSON.stringify(expected)
        }, but matching return found`,
      );
    }
  }

  /**
   * 返回了值（反向）
   */
  override toHaveReturned(): void {
    const hasReturned = this.mock.calls.some((call) => {
      return call.result !== undefined;
    });

    if (hasReturned) {
      throw new Error("Expected mock not to return a value, but it did");
    }
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
