/**
 * Mock 功能全面测试
 */

import { describe, expect, expectMock, it, mockFn } from "../src/mod.ts";

describe("Mock 功能全面测试", () => {
  describe("mockFn 基础功能", () => {
    it("应该创建空的 Mock 函数", () => {
      const mock = mockFn();
      expect(mock.calls).toEqual([]);
      expect(mock.implementation).toBeUndefined();
    });

    it("应该创建带实现的 Mock 函数", () => {
      const mock = mockFn((a: number, b: number) => a + b);
      expect(mock.implementation).toBeDefined();
      expect(typeof mock.implementation).toBe("function");
    });

    it("应该记录函数调用", () => {
      const mock = mockFn();
      mock(1, 2, 3);
      expect(mock.calls.length).toBe(1);
      expect(mock.calls[0].args).toEqual([1, 2, 3]);
    });

    it("应该记录返回值", () => {
      const mock = mockFn((a: number, b: number) => a + b);
      const result = mock(1, 2);
      expect(result).toBe(3);
      expect(mock.calls[0].result).toBe(3);
    });

    it("应该记录多次调用", () => {
      const mock = mockFn();
      mock(1);
      mock(2);
      mock(3);
      expect(mock.calls.length).toBe(3);
      expect(mock.calls[0].args).toEqual([1]);
      expect(mock.calls[1].args).toEqual([2]);
      expect(mock.calls[2].args).toEqual([3]);
    });

    it("应该记录调用时间戳", () => {
      const mock = mockFn();
      const before = Date.now();
      mock();
      const after = Date.now();
      expect(mock.calls[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(mock.calls[0].timestamp).toBeLessThanOrEqual(after);
    });

    it("应该支持异步函数", async () => {
      const mock = mockFn(async (value: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value * 2;
      });

      const result = await mock(5);
      expect(result).toBe(10);
      expect(mock.calls.length).toBe(1);
    });
  });

  describe("expectMock 断言", () => {
    it("应该检查函数是否被调用", () => {
      const mock = mockFn();
      mock();
      expectMock(mock).toHaveBeenCalled();
    });

    it("应该检查函数未被调用", () => {
      const mock = mockFn();
      expectMock(mock).not.toHaveBeenCalled();
    });

    it("应该检查调用次数", () => {
      const mock = mockFn();
      mock();
      mock();
      mock();
      expectMock(mock).toHaveBeenCalledTimes(3);
    });

    it("应该检查调用参数", () => {
      const mock = mockFn();
      mock(1, 2, 3);
      expectMock(mock).toHaveBeenCalledWith(1, 2, 3);
    });

    it("应该检查最后一次调用参数", () => {
      const mock = mockFn();
      mock(1, 2);
      mock(3, 4);
      expectMock(mock).toHaveBeenLastCalledWith(3, 4);
    });

    it("应该检查第 N 次调用参数", () => {
      const mock = mockFn();
      mock(1);
      mock(2);
      mock(3);
      expectMock(mock).toHaveBeenNthCalledWith(2, 2);
    });

    it("应该检查返回值", () => {
      const mock = mockFn((a: number) => a * 2);
      mock(5);
      expectMock(mock).toHaveReturnedWith(10);
    });

    it("应该检查是否返回了值", () => {
      const mock = mockFn(() => 42);
      mock();
      expectMock(mock).toHaveReturned();
    });

    // 注意：toHaveThrown 需要特殊实现，当前版本暂不支持
    // it("应该检查是否抛出了错误", () => {
    //   const mock = mockFn(() => {
    //     throw new Error("test");
    //   });
    //   try {
    //     mock();
    //   } catch {
    //     // 忽略错误
    //   }
    //   expectMock(mock).toHaveThrown();
    // });
  });

  describe("Mock 函数边界情况", () => {
    it("应该处理无参数调用", () => {
      const mock = mockFn();
      mock();
      expect(mock.calls.length).toBe(1);
      expect(mock.calls[0].args).toEqual([]);
    });

    it("应该处理 undefined 参数", () => {
      const mock = mockFn();
      mock(undefined, null);
      expect(mock.calls[0].args).toEqual([undefined, null]);
    });

    it("应该处理对象和数组参数", () => {
      const mock = mockFn();
      mock({ a: 1 }, [1, 2, 3]);
      expect(mock.calls[0].args).toEqual([{ a: 1 }, [1, 2, 3]]);
    });

    it("应该处理多次调用但参数不同", () => {
      const mock = mockFn();
      mock(1);
      mock(2, 3);
      mock(4, 5, 6);
      expect(mock.calls.length).toBe(3);
      expect(mock.calls[0].args).toEqual([1]);
      expect(mock.calls[1].args).toEqual([2, 3]);
      expect(mock.calls[2].args).toEqual([4, 5, 6]);
    });
  });
});
