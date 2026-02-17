/**
 * @fileoverview Test 库自测试
 *
 * 使用 @dreamer/test 库自己来测试自己的功能
 */

import { logger } from "../src/logger.ts";
import {
  $t,
  afterAll,
  afterEach,
  assertDeepEqual,
  assertInstanceOf,
  assertMatch,
  assertRejects,
  assertResolves,
  assertSnapshot,
  beforeAll,
  beforeEach,
  bench,
  describe,
  expect,
  expectMock,
  it,
  mockFetch,
  mockFn,
  testEach,
} from "../src/mod.ts";

describe("@dreamer/test 自测试", () => {
  describe("基础测试 API", () => {
    it("describe 和 it 应该正常工作", () => {
      expect(true).toBeTruthy();
    });
  });

  describe("Expect 断言", () => {
    describe("toBe", () => {
      it("应该通过相等比较", () => {
        expect(1).toBe(1);
        expect("hello").toBe("hello");
        expect(null).toBe(null);
        expect(undefined).toBe(undefined);
      });

      it("应该抛出错误当值不相等", async () => {
        await assertRejects(
          () => Promise.resolve(expect(1).toBe(2)),
          Error,
          $t("expect.expectedReceived", { expected: "2", received: "1" }),
        );
      });
    });

    describe("toEqual", () => {
      it("应该通过深度相等比较", () => {
        expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 2 });
        expect([1, 2, 3]).toEqual([1, 2, 3]);
        expect({ a: { b: { c: 1 } } }).toEqual({ a: { b: { c: 1 } } });
      });

      it("应该抛出错误当值不相等", async () => {
        await assertRejects(
          () => Promise.resolve(expect({ a: 1 }).toEqual({ a: 2 })),
          Error,
          $t("expect.expectedReceived", {
            expected: '{"a":2}',
            received: '{"a":1}',
          }),
        );
      });
    });

    describe("toBeTruthy", () => {
      it("应该通过真值检查", () => {
        expect(1).toBeTruthy();
        expect("hello").toBeTruthy();
        expect(true).toBeTruthy();
        expect({}).toBeTruthy();
        expect([]).toBeTruthy();
      });

      it("应该抛出错误当值为假", async () => {
        await assertRejects(
          () => Promise.resolve(expect(false).toBeTruthy()),
          Error,
          $t("expect.expectedTruthyReceived", { received: "false" }),
        );
      });
    });

    describe("toBeFalsy", () => {
      it("应该通过假值检查", () => {
        expect(false).toBeFalsy();
        expect(0).toBeFalsy();
        expect("").toBeFalsy();
        expect(null).toBeFalsy();
        expect(undefined).toBeFalsy();
      });

      it("应该抛出错误当值为真", async () => {
        await assertRejects(
          () => Promise.resolve(expect(true).toBeFalsy()),
          Error,
          $t("expect.expectedFalsyReceived", { received: "true" }),
        );
      });
    });

    describe("toBeNull", () => {
      it("应该通过 null 检查", () => {
        expect(null).toBeNull();
      });

      it("应该抛出错误当值不是 null", async () => {
        await assertRejects(
          () => Promise.resolve(expect(undefined).toBeNull()),
          Error,
          $t("expect.expectedNullReceived", { received: "undefined" }),
        );
      });
    });

    describe("toBeUndefined", () => {
      it("应该通过 undefined 检查", () => {
        expect(undefined).toBeUndefined();
      });

      it("应该抛出错误当值不是 undefined", async () => {
        await assertRejects(
          () => Promise.resolve(expect(null).toBeUndefined()),
          Error,
          $t("expect.expectedUndefinedReceived", { received: "null" }),
        );
      });
    });

    describe("toBeDefined", () => {
      it("应该通过已定义检查", () => {
        expect(1).toBeDefined();
        expect("hello").toBeDefined();
        expect(null).toBeDefined();
      });

      it("应该抛出错误当值为 undefined", async () => {
        await assertRejects(
          () => Promise.resolve(expect(undefined).toBeDefined()),
          Error,
          $t("expect.expectedDefinedReceivedUndefined"),
        );
      });
    });

    describe("toMatch", () => {
      it("应该通过正则匹配", () => {
        expect("hello world").toMatch(/world/);
        expect("hello world").toMatch("world");
        expect("123").toMatch(/^\d+$/);
      });

      it("应该抛出错误当不匹配", async () => {
        await assertRejects(
          () => Promise.resolve(expect("hello").toMatch(/world/)),
          Error,
          $t("expect.expectedMatchReceived", {
            pattern: "/world/",
            received: '"hello"',
          }),
        );
      });
    });

    describe("toContain", () => {
      it("应该通过数组包含检查", () => {
        expect([1, 2, 3]).toContain(2);
        expect(["a", "b", "c"]).toContain("b");
      });

      it("应该通过字符串包含检查", () => {
        expect("hello world").toContain("world");
      });

      it("应该抛出错误当不包含", async () => {
        await assertRejects(
          () => Promise.resolve(expect([1, 2, 3]).toContain(4)),
          Error,
          $t("expect.expectedArrayContainReceived", {
            item: "4",
            received: "[1,2,3]",
          }),
        );
      });
    });

    describe("toBeGreaterThan", () => {
      it("应该通过大于比较", () => {
        expect(5).toBeGreaterThan(3);
        expect(10).toBeGreaterThan(5);
      });

      it("应该抛出错误当不大于", async () => {
        await assertRejects(
          () => Promise.resolve(expect(3).toBeGreaterThan(5)),
          Error,
          $t("expect.expectedGreaterThanReceived", {
            expected: "5",
            received: "3",
          }),
        );
      });
    });

    describe("toBeGreaterThanOrEqual", () => {
      it("应该通过大于等于比较", () => {
        expect(5).toBeGreaterThanOrEqual(5);
        expect(10).toBeGreaterThanOrEqual(5);
      });

      it("应该抛出错误当小于", async () => {
        await assertRejects(
          () => Promise.resolve(expect(3).toBeGreaterThanOrEqual(5)),
          Error,
          $t("expect.expectedGreaterThanOrEqualReceived", {
            expected: "5",
            received: "3",
          }),
        );
      });
    });

    describe("toBeLessThan", () => {
      it("应该通过小于比较", () => {
        expect(3).toBeLessThan(5);
        expect(5).toBeLessThan(10);
      });

      it("应该抛出错误当不小于", async () => {
        await assertRejects(
          () => Promise.resolve(expect(5).toBeLessThan(3)),
          Error,
          $t("expect.expectedLessThanReceived", {
            expected: "3",
            received: "5",
          }),
        );
      });
    });

    describe("toBeLessThanOrEqual", () => {
      it("应该通过小于等于比较", () => {
        expect(5).toBeLessThanOrEqual(5);
        expect(3).toBeLessThanOrEqual(5);
      });

      it("应该抛出错误当大于", async () => {
        await assertRejects(
          () => Promise.resolve(expect(5).toBeLessThanOrEqual(3)),
          Error,
          $t("expect.expectedLessThanOrEqualReceived", {
            expected: "3",
            received: "5",
          }),
        );
      });
    });

    describe("toBeInstanceOf", () => {
      it("应该通过实例类型检查", () => {
        expect(new Date()).toBeInstanceOf(Date);
        expect([]).toBeInstanceOf(Array);
        expect({}).toBeInstanceOf(Object);
      });

      it("应该抛出错误当不是实例", async () => {
        await assertRejects(
          () => Promise.resolve(expect({}).toBeInstanceOf(Date)),
          Error,
          $t("expect.expectedInstanceReceived", {
            name: "Date",
            received: "{}",
          }),
        );
      });
    });

    describe("toHaveProperty", () => {
      it("应该检查对象属性", () => {
        const obj = { name: "John", age: 30 };
        expect(obj).toHaveProperty("name");
        expect(obj).toHaveProperty("age", 30);
      });

      it("应该检查嵌套属性", () => {
        const obj = { user: { name: "John" } };
        expect(obj).toHaveProperty("user.name", "John");
      });
    });

    describe("toBeCloseTo", () => {
      it("应该通过浮点数近似相等检查", () => {
        expect(0.1 + 0.2).toBeCloseTo(0.3);
      });
    });

    describe("toBeNaN", () => {
      it("应该通过 NaN 检查", () => {
        expect(NaN).toBeNaN();
      });
    });

    describe("toHaveLength", () => {
      it("应该检查数组长度", () => {
        expect([1, 2, 3]).toHaveLength(3);
      });

      it("应该检查字符串长度", () => {
        expect("hello").toHaveLength(5);
      });
    });

    describe("类型检查", () => {
      it("应该检查数组", () => {
        expect([]).toBeArray();
      });

      it("应该检查字符串", () => {
        expect("hello").toBeString();
      });

      it("应该检查数字", () => {
        expect(123).toBeNumber();
      });

      it("应该检查布尔值", () => {
        expect(true).toBeBoolean();
      });

      it("应该检查函数", () => {
        expect(() => {}).toBeFunction();
      });
    });

    describe("toBeEmpty", () => {
      it("应该检查空数组", () => {
        expect([]).toBeEmpty();
      });

      it("应该检查空字符串", () => {
        expect("").toBeEmpty();
      });

      it("应该检查空对象", () => {
        expect({}).toBeEmpty();
      });
    });

    describe("toStrictEqual", () => {
      it("应该通过严格深度相等检查", () => {
        expect({ a: 1, b: 2 }).toStrictEqual({ a: 1, b: 2 });
      });
    });
  });

  describe("Mock 函数", () => {
    it("应该创建 Mock 函数", () => {
      const mock = mockFn();
      expect(mock.calls).toEqual([]);
      expect(mock.implementation).toBeUndefined();
    });

    it("应该记录函数调用", () => {
      const mock = mockFn();
      mock(1, 2, 3);
      expect(mock.calls.length).toBe(1);
      expect(mock.calls[0].args).toEqual([1, 2, 3]);
    });

    it("应该执行实现函数", () => {
      const mock = mockFn((a: number, b: number) => a + b);
      const result = mock(1, 2);
      expect(result).toBe(3);
      expect(mock.calls.length).toBe(1);
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
  });

  describe("MockExpect", () => {
    it("应该检查函数是否被调用", () => {
      const mock = mockFn();
      mock();
      expectMock(mock).toHaveBeenCalled();
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
  });

  describe("assertRejects", () => {
    it("应该通过错误断言", async () => {
      await assertRejects(async () => {
        throw new Error("test error");
      });
    });

    it("应该检查错误类型", async () => {
      await assertRejects(
        async () => {
          throw new TypeError("test error");
        },
        TypeError,
      );
    });

    it("应该检查错误消息", async () => {
      await assertRejects(
        async () => {
          throw new Error("test error message");
        },
        Error,
        "test error",
      );
    });

    it("应该抛出错误当函数不抛出", async () => {
      await assertRejects(
        async () => {
          await assertRejects(async () => {
            // 不抛出错误
          });
        },
        Error,
        $t("assert.expectedFunctionToThrow"),
      );
    });
  });

  describe("assertResolves", () => {
    it("应该通过成功断言", async () => {
      await assertResolves(async () => {
        return 42;
      });
    });

    it("应该检查返回值", async () => {
      await assertResolves(
        async () => {
          return 42;
        },
        42,
      );
    });

    it("应该抛出错误当函数失败", async () => {
      await assertRejects(
        async () => {
          await assertResolves(async () => {
            throw new Error("test error");
          });
        },
        Error,
        $t("assert.expectedSucceedButThrew", { message: "test error" }),
      );
    });
  });

  describe("assertDeepEqual", () => {
    it("应该通过深度相等断言", () => {
      assertDeepEqual({ a: 1, b: 2 }, { a: 1, b: 2 });
      assertDeepEqual([1, 2, 3], [1, 2, 3]);
    });

    it("应该抛出错误当不相等", async () => {
      await assertRejects(
        () => Promise.resolve(assertDeepEqual({ a: 1 }, { a: 2 })),
        Error,
        $t("assert.expectedReceived", {
          expected: '{"a":2}',
          received: '{"a":1}',
        }),
      );
    });
  });

  describe("assertInstanceOf", () => {
    it("应该通过实例类型断言", () => {
      assertInstanceOf(new Date(), Date);
      assertInstanceOf([], Array);
    });

    it("应该抛出错误当不是实例", async () => {
      await assertRejects(
        () => Promise.resolve(assertInstanceOf({}, Date)),
        Error,
        $t("assert.expectedInstanceReceived", { name: "Date", received: "{}" }),
      );
    });
  });

  describe("assertMatch", () => {
    it("应该通过正则匹配断言", () => {
      assertMatch("hello world", /world/);
      assertMatch("123", /^\d+$/);
    });

    it("应该抛出错误当不匹配", async () => {
      await assertRejects(
        () => Promise.resolve(assertMatch("hello", /world/)),
        Error,
        $t("assert.expectedMatchReceived", {
          pattern: "/world/",
          received: '"hello"',
        }),
      );
    });
  });

  describe("assertSnapshot", () => {
    it("应该创建和验证快照", async (t) => {
      // 注意：此测试需要 --allow-write 权限
      // 运行: deno test --allow-write tests/mod.test.ts
      const value = { a: 1, b: 2, c: [3, 4, 5] };
      try {
        await assertSnapshot(t, value, "test-snapshot");
        // 第二次运行应该通过
        await assertSnapshot(t, value, "test-snapshot");
      } catch (error) {
        if (error instanceof Error && error.message.includes("write access")) {
          // 如果没有写入权限，跳过此测试
          logger.info("跳过快照测试：需要 --allow-write 权限");
          return;
        }
        throw error;
      }
    });
  });

  describe("测试钩子", () => {
    it("应该可以设置 beforeAll 钩子", () => {
      let called = false;
      beforeAll(() => {
        called = true;
      });
      // 注意：当前实现中，钩子需要手动调用
      // 这里只测试钩子函数可以被设置
      expect(typeof beforeAll).toBe("function");
    });

    it("应该可以设置 afterAll 钩子", () => {
      expect(typeof afterAll).toBe("function");
    });

    it("应该可以设置 beforeEach 钩子", () => {
      expect(typeof beforeEach).toBe("function");
    });

    it("应该可以设置 afterEach 钩子", () => {
      expect(typeof afterEach).toBe("function");
    });
  });

  describe("参数化测试", () => {
    const cases = [
      [1, 2, 3],
      [2, 3, 5],
      [3, 4, 7],
    ] as [number, number, number][];

    testEach(cases)("应该计算 %0 + %1 = %2", (a, b, expected) => {
      expect(a + b).toBe(expected);
    });
  });

  describe("基准测试", () => {
    bench("简单计算", () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
    }, { n: 10, warmup: 2 });
  });

  describe("HTTP Mock", () => {
    it("应该 Mock fetch 请求", async () => {
      const mock = mockFetch("https://api.example.com/users", {
        response: {
          status: 200,
          body: { id: 1, name: "Alice" },
        },
      });

      try {
        const response = await fetch("https://api.example.com/users");
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ id: 1, name: "Alice" });
        expect(mock.calls.length).toBe(1);
        expect(mock.calls[0].url).toBe("https://api.example.com/users");
      } finally {
        mock.restore();
      }
    });

    it("应该支持正则表达式 URL 匹配", async () => {
      const mock = mockFetch(/\/users\/\d+$/, {
        response: {
          status: 200,
          body: { id: 123 },
        },
      });

      try {
        const response = await fetch("https://api.example.com/users/123");
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ id: 123 });
      } finally {
        mock.restore();
      }
    });

    it("应该支持方法匹配", async () => {
      const mock = mockFetch("https://api.example.com/users", {
        method: "POST",
        response: {
          status: 201,
          body: { id: 1 },
        },
      });

      try {
        const response = await fetch("https://api.example.com/users", {
          method: "POST",
        });
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data).toEqual({ id: 1 });
      } finally {
        mock.restore();
      }
    });
  });

  describe("test.skipIf 和 it.skipIf", () => {
    it("应该验证 skipIf 方法存在", () => {
      // 验证 skipIf 方法存在
      expect(typeof it.skipIf).toBe("function");
      expect(typeof it.skipIf).toBe("function");
    });

    // 注意：在 Bun 环境下，不能在测试执行期间调用 test() 函数
    // 所以这些测试用例在 describe() 执行期间直接调用 skipIf
    // 而不是在 it() 回调内部调用

    // skipIf(true) 应该跳过测试 - 在 describe 块内直接调用
    it.skipIf(true, "被跳过的测试（skipIf true）", () => {
      // 这个测试会被跳过，不会执行
      expect(true).toBeTruthy();
    });

    // skipIf(false) 应该执行测试 - 在 describe 块内直接调用
    it.skipIf(false, "正常执行的测试（skipIf false）", () => {
      // 这个测试会正常执行
      expect(true).toBeTruthy();
    });

    // 应该支持复杂条件 - 在 describe 块内直接调用
    const condition1 = true;
    const condition2 = false;
    const shouldSkip = condition1 && condition2;
    it.skipIf(shouldSkip, "条件跳过的测试（复杂条件）", () => {
      // 如果 shouldSkip 为 true，这个测试会被跳过
      // 如果 shouldSkip 为 false，这个测试会正常执行
      expect(true).toBeTruthy();
    });
  });
});
