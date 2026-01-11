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
    if (!lastCall) {
      throw new Error("无法获取最后一次调用");
    }
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
    if (!nthCall) {
      throw new Error(`无法获取第 ${n} 次调用`);
    }
    if (!this.deepEqual(nthCall.args, args)) {
      throw new Error(
        `期望第 ${n} 次调用使用参数 ${JSON.stringify(args)}，实际参数: ${
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
        `期望 Mock 函数返回 ${JSON.stringify(expected)}，但未找到匹配的返回值`,
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
      throw new Error("期望 Mock 函数返回值，但未返回值");
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
      "toHaveThrown 需要特殊实现，当前版本暂不支持",
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
        `期望 Mock 函数不被调用，但被调用了 ${this.mock.calls.length} 次`,
      );
    }
  }

  /**
   * 被调用指定次数（反向）
   */
  override toHaveBeenCalledTimes(times: number): void {
    if (this.mock.calls.length === times) {
      throw new Error(
        `期望 Mock 函数不被调用 ${times} 次，但实际调用 ${this.mock.calls.length} 次`,
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
        `期望 Mock 函数不使用参数 ${
          JSON.stringify(args)
        } 被调用，但找到了匹配的调用`,
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
          `期望最后一次调用不使用参数 ${
            JSON.stringify(args)
          }，但实际使用了该参数`,
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
          `期望第 ${n} 次调用不使用参数 ${
            JSON.stringify(args)
          }，但实际使用了该参数`,
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
        `期望 Mock 函数不返回 ${
          JSON.stringify(expected)
        }，但找到了匹配的返回值`,
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
      throw new Error("期望 Mock 函数不返回值，但返回了值");
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
