/**
 * Expect 断言全面测试
 * 覆盖所有断言方法，包括新添加的方法和反向断言
 */

import { assertRejects, describe, expect, it } from "../src/mod.ts";

describe("Expect 断言全面测试", () => {
  describe("toHaveProperty", () => {
    it("应该检查对象属性", () => {
      const obj = { name: "John", age: 30 };
      expect(obj).toHaveProperty("name");
      expect(obj).toHaveProperty("age");
    });

    it("应该检查嵌套属性", () => {
      const obj = { user: { name: "John", profile: { age: 30 } } };
      expect(obj).toHaveProperty("user.name");
      expect(obj).toHaveProperty("user.profile.age");
    });

    it("应该检查属性值", () => {
      const obj = { name: "John", age: 30 };
      expect(obj).toHaveProperty("name", "John");
      expect(obj).toHaveProperty("age", 30);
    });

    it("应该检查嵌套属性值", () => {
      const obj = { user: { name: "John" } };
      expect(obj).toHaveProperty("user.name", "John");
    });

    it("应该抛出错误当属性不存在", async () => {
      const obj = { name: "John" };
      await assertRejects(
        () => Promise.resolve(expect(obj).toHaveProperty("age")),
        Error,
        "Expected object to have property",
      );
    });

    it("应该抛出错误当属性值不匹配", async () => {
      const obj = { name: "John" };
      await assertRejects(
        () => Promise.resolve(expect(obj).toHaveProperty("name", "Jane")),
        Error,
        "Expected property",
      );
    });

    it("应该抛出错误当路径不存在", async () => {
      const obj = { user: { name: "John" } };
      await assertRejects(
        () => Promise.resolve(expect(obj).toHaveProperty("user.email")),
        Error,
        "Expected object to have property",
      );
    });

    it("应该支持反向断言", () => {
      const obj = { name: "John" };
      expect(obj).not.toHaveProperty("age");
    });

    it("应该支持反向断言检查值", () => {
      const obj = { name: "John" };
      expect(obj).not.toHaveProperty("name", "Jane");
    });
  });

  describe("toBeCloseTo", () => {
    it("应该通过浮点数近似相等检查", () => {
      expect(0.1 + 0.2).toBeCloseTo(0.3);
      expect(1.5 + 2.5).toBeCloseTo(4.0);
    });

    it("应该支持自定义精度", () => {
      expect(0.12345).toBeCloseTo(0.12346, 4);
      expect(0.12345).toBeCloseTo(0.12346, 3);
    });

    it("应该抛出错误当不近似相等", async () => {
      await assertRejects(
        () => Promise.resolve(expect(0.1).toBeCloseTo(0.2)),
        Error,
        "Expected ≈",
      );
    });

    it("应该抛出错误当不是数字", async () => {
      await assertRejects(
        () => Promise.resolve(expect("0.1").toBeCloseTo(0.2)),
        Error,
        "toBeCloseTo can only be used with numbers",
      );
    });

    it("应该支持反向断言", () => {
      expect(0.1).not.toBeCloseTo(0.2);
    });
  });

  describe("toBeNaN", () => {
    it("应该通过 NaN 检查", () => {
      expect(NaN).toBeNaN();
      expect(Number.NaN).toBeNaN();
      expect(0 / 0).toBeNaN();
    });

    it("应该抛出错误当不是 NaN", async () => {
      await assertRejects(
        () => Promise.resolve(expect(0).toBeNaN()),
        Error,
        "Expected NaN",
      );
    });

    it("应该支持反向断言", () => {
      expect(0).not.toBeNaN();
      expect(1).not.toBeNaN();
      expect("NaN").not.toBeNaN();
    });
  });

  describe("toHaveLength", () => {
    it("应该检查数组长度", () => {
      expect([1, 2, 3]).toHaveLength(3);
      expect([]).toHaveLength(0);
    });

    it("应该检查字符串长度", () => {
      expect("hello").toHaveLength(5);
      expect("").toHaveLength(0);
    });

    it("应该检查类数组对象长度", () => {
      const arrayLike = { length: 5, 0: "a", 1: "b" };
      expect(arrayLike).toHaveLength(5);
    });

    it("应该抛出错误当长度不匹配", async () => {
      await assertRejects(
        () => Promise.resolve(expect([1, 2, 3]).toHaveLength(5)),
        Error,
        "Expected length",
      );
    });

    it("应该抛出错误当不是数组或字符串", async () => {
      await assertRejects(
        () => Promise.resolve(expect({}).toHaveLength(0)),
        Error,
        "toHaveLength can only be used",
      );
    });

    it("应该支持反向断言", () => {
      expect([1, 2, 3]).not.toHaveLength(5);
      expect("hello").not.toHaveLength(10);
    });
  });

  describe("toBeArray", () => {
    it("应该通过数组检查", () => {
      expect([]).toBeArray();
      expect([1, 2, 3]).toBeArray();
      expect(new Array()).toBeArray();
    });

    it("应该抛出错误当不是数组", async () => {
      await assertRejects(
        () => Promise.resolve(expect({}).toBeArray()),
        Error,
        "Expected array",
      );
    });

    it("应该支持反向断言", () => {
      expect({}).not.toBeArray();
      expect("[]").not.toBeArray();
    });
  });

  describe("toBeString", () => {
    it("应该通过字符串检查", () => {
      expect("hello").toBeString();
      expect("").toBeString();
      expect(String(123)).toBeString();
    });

    it("应该抛出错误当不是字符串", async () => {
      await assertRejects(
        () => Promise.resolve(expect(123).toBeString()),
        Error,
        "Expected string",
      );
    });

    it("应该支持反向断言", () => {
      expect(123).not.toBeString();
      expect([]).not.toBeString();
    });
  });

  describe("toBeNumber", () => {
    it("应该通过数字检查", () => {
      expect(123).toBeNumber();
      expect(0).toBeNumber();
      expect(-123).toBeNumber();
      expect(3.14).toBeNumber();
    });

    it("应该抛出错误当是 NaN", async () => {
      await assertRejects(
        () => Promise.resolve(expect(NaN).toBeNumber()),
        Error,
        "Expected number",
      );
    });

    it("应该抛出错误当不是数字", async () => {
      await assertRejects(
        () => Promise.resolve(expect("123").toBeNumber()),
        Error,
        "Expected number",
      );
    });

    it("应该支持反向断言", () => {
      expect("123").not.toBeNumber();
      expect(NaN).not.toBeNumber();
    });
  });

  describe("toBeBoolean", () => {
    it("应该通过布尔值检查", () => {
      expect(true).toBeBoolean();
      expect(false).toBeBoolean();
      expect(Boolean(1)).toBeBoolean();
    });

    it("应该抛出错误当不是布尔值", async () => {
      await assertRejects(
        () => Promise.resolve(expect(1).toBeBoolean()),
        Error,
        "Expected boolean",
      );
    });

    it("应该支持反向断言", () => {
      expect(1).not.toBeBoolean();
      expect("true").not.toBeBoolean();
    });
  });

  describe("toBeFunction", () => {
    it("应该通过函数检查", () => {
      expect(() => {}).toBeFunction();
      expect(function () {}).toBeFunction();
      expect(async () => {}).toBeFunction();
    });

    it("应该抛出错误当不是函数", async () => {
      await assertRejects(
        () => Promise.resolve(expect({}).toBeFunction()),
        Error,
        "Expected function",
      );
    });

    it("应该支持反向断言", () => {
      expect({}).not.toBeFunction();
      expect("function").not.toBeFunction();
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

    it("应该抛出错误当数组不为空", async () => {
      await assertRejects(
        () => Promise.resolve(expect([1]).toBeEmpty()),
        Error,
        "Expected empty array",
      );
    });

    it("应该抛出错误当字符串不为空", async () => {
      await assertRejects(
        () => Promise.resolve(expect("hello").toBeEmpty()),
        Error,
        "Expected empty string",
      );
    });

    it("应该抛出错误当对象不为空", async () => {
      await assertRejects(
        () => Promise.resolve(expect({ a: 1 }).toBeEmpty()),
        Error,
        "Expected empty object",
      );
    });

    it("应该抛出错误当不是数组、字符串或对象", async () => {
      await assertRejects(
        () => Promise.resolve(expect(123).toBeEmpty()),
        Error,
        "toBeEmpty can only be used",
      );
    });

    it("应该支持反向断言", () => {
      expect([1]).not.toBeEmpty();
      expect("hello").not.toBeEmpty();
      expect({ a: 1 }).not.toBeEmpty();
    });
  });

  describe("toStrictEqual", () => {
    it("应该通过严格深度相等检查", () => {
      expect({ a: 1, b: 2 }).toStrictEqual({ a: 1, b: 2 });
      expect([1, 2, 3]).toStrictEqual([1, 2, 3]);
    });

    it("应该区分 undefined 和缺失属性", () => {
      const obj1 = { a: 1, b: undefined };
      const obj2 = { a: 1 };
      // obj1 有 b: undefined，obj2 没有 b 属性，应该不相等
      expect(obj1).not.toStrictEqual(obj2);
    });

    it("应该检查数组严格相等", () => {
      expect([1, 2, 3]).toStrictEqual([1, 2, 3]);
      expect([1, 2]).not.toStrictEqual([1, 2, 3]);
    });

    it("应该抛出错误当不严格相等", async () => {
      await assertRejects(
        () => Promise.resolve(expect({ a: 1 }).toStrictEqual({ a: 2 })),
        Error,
        "Expected (strict)",
      );
    });

    it("应该支持反向断言", () => {
      expect({ a: 1 }).not.toStrictEqual({ a: 2 });
    });
  });

  describe("反向断言 (.not)", () => {
    it("应该支持所有断言方法的反向", () => {
      // toBe
      expect(1).not.toBe(2);

      // toEqual
      expect({ a: 1 }).not.toEqual({ a: 2 });

      // toBeTruthy
      expect(false).not.toBeTruthy();

      // toBeFalsy
      expect(true).not.toBeFalsy();

      // toBeNull
      expect(undefined).not.toBeNull();

      // toBeUndefined
      expect(null).not.toBeUndefined();

      // toBeDefined
      expect(undefined).not.toBeDefined();

      // toMatch
      expect("hello").not.toMatch(/world/);

      // toContain
      expect([1, 2, 3]).not.toContain(4);
      expect("hello").not.toContain("world");

      // toBeGreaterThan
      expect(3).not.toBeGreaterThan(5);

      // toBeGreaterThanOrEqual
      expect(3).not.toBeGreaterThanOrEqual(5);

      // toBeLessThan
      expect(5).not.toBeLessThan(3);

      // toBeLessThanOrEqual
      expect(5).not.toBeLessThanOrEqual(3);

      // toBeInstanceOf
      expect({}).not.toBeInstanceOf(Date);
    });

    it("应该抛出错误当反向断言失败", async () => {
      await assertRejects(
        () => Promise.resolve(expect(1).not.toBe(1)),
        Error,
        "Expected value not equal",
      );
    });
  });

  describe("边界情况", () => {
    it("应该处理 null 值", () => {
      expect(null).toBeNull();
      expect(null).toBeFalsy();
      expect(null).not.toBeUndefined();
      expect(null).toBeDefined();
    });

    it("应该处理 undefined 值", () => {
      expect(undefined).toBeUndefined();
      expect(undefined).toBeFalsy();
      expect(undefined).not.toBeNull();
      expect(undefined).not.toBeDefined();
    });

    it("应该处理空值", () => {
      expect("").toBeEmpty();
      expect("").toBeFalsy();
      expect([]).toBeEmpty();
      expect({}).toBeEmpty();
    });

    it("应该处理特殊数字", () => {
      expect(0).toBe(0);
      expect(0).toBeFalsy();
      expect(-0).toBe(0);
      expect(Infinity).toBeGreaterThan(0);
      expect(-Infinity).toBeLessThan(0);
    });

    it("应该处理嵌套对象", () => {
      const obj = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3,
          },
        },
      };
      expect(obj).toHaveProperty("a", 1);
      expect(obj).toHaveProperty("b.c", 2);
      expect(obj).toHaveProperty("b.d.e", 3);
      expect(obj).toEqual({
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3,
          },
        },
      });
    });

    it("应该处理数组边界情况", () => {
      expect([]).toBeArray();
      expect([]).toBeEmpty();
      expect([]).toHaveLength(0);
      expect([1]).toHaveLength(1);
      expect([1]).toContain(1);
    });

    it("应该处理字符串边界情况", () => {
      expect("").toBeString();
      expect("").toBeEmpty();
      expect("").toHaveLength(0);
      expect("hello").toHaveLength(5);
      expect("hello").toContain("ell");
    });
  });

  describe("错误消息", () => {
    it("应该提供清晰的错误消息", async () => {
      try {
        expect(1).toBe(2);
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain("Expected");
        expect((error as Error).message).toContain("received");
      }
    });

    it("应该提供属性检查的错误消息", async () => {
      try {
        expect({ a: 1 }).toHaveProperty("b");
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain("Expected object to have property");
      }
    });
  });
});
