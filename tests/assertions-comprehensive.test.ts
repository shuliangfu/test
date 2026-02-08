/**
 * 断言工具函数全面测试
 */

import {
  assertDeepEqual,
  assertInstanceOf,
  assertMatch,
  assertRejects,
  assertResolves,
  describe,
  it,
} from "../src/mod.ts";

describe("断言工具函数全面测试", () => {
  describe("assertRejects", () => {
    it("应该通过错误断言", async () => {
      await assertRejects(async () => {
        throw new Error("test error");
      });
    });

    it("应该检查错误类型", async () => {
      await assertRejects(
        async () => {
          throw new TypeError("type error");
        },
        TypeError,
      );
    });

    it("应该检查错误消息（字符串）", async () => {
      await assertRejects(
        async () => {
          throw new Error("test error message");
        },
        Error,
        "test error",
      );
    });

    it("应该检查错误消息（正则表达式）", async () => {
      await assertRejects(
        async () => {
          throw new Error("test error 123");
        },
        Error,
        /error \d+/,
      );
    });

    it("应该抛出错误当函数不抛出", async () => {
      await assertRejects(
        async () => {
          await assertRejects(async () => {
            // 不抛出错误
            return 42;
          });
        },
        Error,
        "Expected function to throw",
      );
    });

    it("应该抛出错误当错误类型不匹配", async () => {
      await assertRejects(
        async () => {
          await assertRejects(
            async () => {
              throw new Error("error");
            },
            TypeError,
          );
        },
        Error,
        "Expected to throw TypeError",
      );
    });

    it("应该抛出错误当错误消息不匹配", async () => {
      await assertRejects(
        async () => {
          await assertRejects(
            async () => {
              throw new Error("different message");
            },
            Error,
            "expected message",
          );
        },
        Error,
        "Expected error message to contain",
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
          return { a: 1, b: 2 };
        },
        { a: 1, b: 2 },
      );
    });

    it("应该检查返回值（深度相等）", async () => {
      await assertResolves(
        async () => {
          return { nested: { value: 123 } };
        },
        { nested: { value: 123 } },
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
        "Expected function to succeed",
      );
    });

    it("应该抛出错误当返回值不匹配", async () => {
      await assertRejects(
        async () => {
          await assertResolves(
            async () => {
              return 42;
            },
            43,
          );
        },
        Error,
        "Expected return",
      );
    });
  });

  describe("assertDeepEqual", () => {
    it("应该通过深度相等断言", () => {
      assertDeepEqual({ a: 1, b: 2 }, { a: 1, b: 2 });
      assertDeepEqual([1, 2, 3], [1, 2, 3]);
      assertDeepEqual(
        { a: { b: { c: 1 } } },
        { a: { b: { c: 1 } } },
      );
    });

    it("应该处理嵌套对象", () => {
      assertDeepEqual(
        { a: 1, b: { c: 2, d: [3, 4] } },
        { a: 1, b: { c: 2, d: [3, 4] } },
      );
    });

    it("应该处理数组", () => {
      assertDeepEqual([1, 2, [3, 4]], [1, 2, [3, 4]]);
    });

    it("应该抛出错误当不相等", async () => {
      await assertRejects(
        () => Promise.resolve(assertDeepEqual({ a: 1 }, { a: 2 })),
        Error,
      );
    });

    it("应该抛出错误当结构不同", async () => {
      await assertRejects(
        () => Promise.resolve(assertDeepEqual({ a: 1 }, { b: 1 })),
        Error,
      );
    });
  });

  describe("assertInstanceOf", () => {
    it("应该通过实例类型断言", () => {
      assertInstanceOf(new Date(), Date);
      assertInstanceOf([], Array);
      assertInstanceOf({}, Object);
      assertInstanceOf(new String(""), String);
    });

    it("应该检查自定义类实例", () => {
      class MyClass {}
      assertInstanceOf(new MyClass(), MyClass);
    });

    it("应该抛出错误当不是实例", async () => {
      await assertRejects(
        () => Promise.resolve(assertInstanceOf({}, Date)),
        Error,
        "Expected Date instance",
      );
    });

    it("应该抛出错误当类型不匹配", async () => {
      await assertRejects(
        () => Promise.resolve(assertInstanceOf([], Date)),
        Error,
      );
    });
  });

  describe("assertMatch", () => {
    it("应该通过正则匹配断言（RegExp）", () => {
      assertMatch("hello world", /world/);
      assertMatch("123", /^\d+$/);
      assertMatch("test@example.com", /^[\w.]+@[\w.]+$/);
    });

    it("应该通过正则匹配断言（字符串）", () => {
      assertMatch("hello world", "world");
      assertMatch("123", "\\d+");
    });

    it("应该抛出错误当不匹配", async () => {
      await assertRejects(
        () => Promise.resolve(assertMatch("hello", /world/)),
        Error,
        "Expected to match",
      );
    });

    it("应该处理复杂正则表达式", () => {
      assertMatch("2024-01-01", /^\d{4}-\d{2}-\d{2}$/);
      assertMatch("test@example.com", /^[\w.-]+@[\w.-]+\.\w+$/);
    });
  });
});
