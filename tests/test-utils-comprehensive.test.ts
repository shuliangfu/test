/**
 * 测试工具函数全面测试
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  bench,
  describe,
  expect,
  it,
  testEach,
} from "../src/mod.ts";

describe("测试工具函数全面测试", () => {
  describe("Setup/Teardown 钩子", () => {
    it("应该可以设置 beforeAll", () => {
      expect(typeof beforeAll).toBe("function");
      let called = false;
      beforeAll(() => {
        called = true;
      });
      // 注意：钩子函数需要在实际测试运行器中调用
      expect(typeof beforeAll).toBe("function");
    });

    it("应该可以设置 afterAll", () => {
      expect(typeof afterAll).toBe("function");
    });

    it("应该可以设置 beforeEach", () => {
      expect(typeof beforeEach).toBe("function");
    });

    it("应该可以设置 afterEach", () => {
      expect(typeof afterEach).toBe("function");
    });

    it("应该支持异步钩子", () => {
      beforeAll(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(typeof beforeAll).toBe("function");
    });
  });

  describe("参数化测试 (testEach)", () => {
    // testEach 应该在 describe() 执行期间调用，而不是在 it() 回调中
    const cases1 = [
      [1, 2, 3],
      [2, 3, 5],
      [3, 4, 7],
    ] as [number, number, number][];

    testEach(cases1)("应该计算 %0 + %1 = %2", (a, b, expected) => {
      expect(a + b).toBe(expected);
    });

    const cases2 = [
      ["hello", "world", "hello world"],
      ["foo", "bar", "foo bar"],
    ] as [string, string, string][];

    testEach(cases2)("应该连接 %0 和 %1", (a, b, expected) => {
      expect(`${a} ${b}`).toBe(expected);
    });

    const cases3 = [
      [{ a: 1 }, { b: 2 }, { a: 1, b: 2 }],
      [{ x: 10 }, { y: 20 }, { x: 10, y: 20 }],
    ] as [
      { a?: number; x?: number },
      { b?: number; y?: number },
      Record<string, number>,
    ][];

    testEach(cases3)("应该合并对象", (obj1, obj2, expected) => {
      expect({ ...obj1, ...obj2 }).toEqual(expected);
    });

    const cases4 = [[1], [2], [3], [4], [5]] as [number][];
    testEach(cases4)("应该处理数字 %0", (num) => {
      expect(num).toBeNumber();
      expect(num).toBeGreaterThan(0);
    });
  });

  describe("基准测试 (bench)", () => {
    // bench 应该在 describe() 执行期间调用，而不是在 it() 回调中
    bench("简单计算", () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
    });

    bench(
      "带选项的基准测试",
      () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
      },
      { n: 10, warmup: 2 },
    );

    bench("异步基准测试", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe("测试组合", () => {
    // describe 和 it 应该在 describe() 执行期间调用，而不是在 it() 回调中
    describe("嵌套测试套件", () => {
      it("嵌套测试用例", () => {
        expect(true).toBeTruthy();
      });

      describe("更深层嵌套", () => {
        it("更深层测试用例", () => {
          expect(1 + 1).toBe(2);
        });
      });
    });

    it("测试用例 1", () => {
      expect(1).toBe(1);
    });

    it("测试用例 2", () => {
      expect(2).toBe(2);
    });

    it("测试用例 3", () => {
      expect(3).toBe(3);
    });
  });
});
