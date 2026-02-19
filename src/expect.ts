/**
 * Expect 断言模块
 * 提供期望值匹配器和断言功能
 */

import { $tr } from "./i18n.ts";
import type { ExpectFunction } from "./types.ts";

/** 供 i18n 占位符使用：undefined 转为字符串 "undefined"，否则用 JSON.stringify */
function stringifyForI18n(v: unknown): string {
  return v === undefined ? "undefined" : JSON.stringify(v);
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
        $tr("expect.expectedReceived", {
          expected: JSON.stringify(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 深度相等
   */
  toEqual(expected: unknown): void {
    if (!this.deepEqual(this.actual, expected)) {
      throw new Error(
        $tr("expect.expectedReceived", {
          expected: JSON.stringify(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 为真值
   */
  toBeTruthy(): void {
    if (!this.actual) {
      throw new Error(
        $tr("expect.expectedTruthyReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 为假值
   */
  toBeFalsy(): void {
    if (this.actual) {
      throw new Error(
        $tr("expect.expectedFalsyReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 为 null
   */
  toBeNull(): void {
    if (this.actual !== null) {
      throw new Error(
        $tr("expect.expectedNullReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 为 undefined
   */
  toBeUndefined(): void {
    if (this.actual !== undefined) {
      throw new Error(
        $tr("expect.expectedUndefinedReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 已定义（不为 undefined）
   */
  toBeDefined(): void {
    if (this.actual === undefined) {
      throw new Error($tr("expect.expectedDefinedReceivedUndefined"));
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
        $tr("expect.expectedMatchReceived", {
          pattern: String(pattern),
          received: stringifyForI18n(this.actual),
        }),
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
          $tr("expect.expectedArrayContainReceived", {
            item: JSON.stringify(item),
            received: stringifyForI18n(this.actual),
          }),
        );
      }
    } else if (typeof this.actual === "string") {
      if (!this.actual.includes(String(item))) {
        throw new Error(
          $tr("expect.expectedStringContainReceived", {
            item: String(item),
            received: stringifyForI18n(this.actual),
          }),
        );
      }
    } else {
      throw new Error($tr("expect.toContainOnlyArraysOrStrings"));
    }
  }

  /**
   * 大于
   */
  toBeGreaterThan(expected: number): void {
    if (typeof this.actual !== "number" || this.actual <= expected) {
      throw new Error(
        $tr("expect.expectedGreaterThanReceived", {
          expected: String(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 大于等于
   */
  toBeGreaterThanOrEqual(expected: number): void {
    if (typeof this.actual !== "number" || this.actual < expected) {
      throw new Error(
        $tr("expect.expectedGreaterThanOrEqualReceived", {
          expected: String(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 小于
   */
  toBeLessThan(expected: number): void {
    if (typeof this.actual !== "number" || this.actual >= expected) {
      throw new Error(
        $tr("expect.expectedLessThanReceived", {
          expected: String(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 小于等于
   */
  toBeLessThanOrEqual(expected: number): void {
    if (typeof this.actual !== "number" || this.actual > expected) {
      throw new Error(
        $tr("expect.expectedLessThanOrEqualReceived", {
          expected: String(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 为指定类型的实例
   */
  toBeInstanceOf(expected: new (...args: any[]) => any): void {
    if (!(this.actual instanceof expected)) {
      throw new Error(
        $tr("expect.expectedInstanceReceived", {
          name: expected.name,
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 具有指定属性
   * @param path 属性路径（支持点号分隔的嵌套路径，如 "user.name"）
   * @param value 可选，如果提供，还会检查属性值是否匹配
   */
  toHaveProperty(path: string, value?: unknown): void {
    if (typeof this.actual !== "object" || this.actual === null) {
      throw new Error(
        $tr("expect.expectedObjectReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }

    const keys = path.split(".").filter((k) => k.length > 0);
    if (keys.length === 0) {
      throw new Error($tr("expect.propertyPathEmpty"));
    }

    let current: any = this.actual;

    // 遍历路径
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!; // 已经过滤空字符串，所以不会是 undefined
      if (!(key in current)) {
        throw new Error(
          $tr("expect.expectedPropertyMissing", {
            path,
            key,
            received: stringifyForI18n(this.actual),
          }),
        );
      }
      if (i < keys.length - 1) {
        // 不是最后一个键，继续深入
        if (typeof current[key] !== "object" || current[key] === null) {
          throw new Error(
            $tr("expect.expectedPathToBeObject", {
              path: keys.slice(0, i + 1).join("."),
              got: JSON.stringify(current[key]),
            }),
          );
        }
        current = current[key];
      } else {
        // 最后一个键，检查值（如果提供）
        if (value !== undefined) {
          if (!this.deepEqual(current[key], value)) {
            throw new Error(
              $tr("expect.expectedPropertyValue", {
                path,
                value: JSON.stringify(value),
                received: JSON.stringify(current[key]),
              }),
            );
          }
        }
      }
    }
  }

  /**
   * 浮点数近似相等（用于测试浮点数计算，避免精度问题）
   * @param expected 期望值
   * @param numDigits 小数位数精度（默认 2）
   */
  toBeCloseTo(expected: number, numDigits: number = 2): void {
    if (typeof this.actual !== "number" || typeof expected !== "number") {
      throw new Error(
        $tr("expect.toBeCloseToOnlyNumbers", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }

    const multiplier = Math.pow(10, numDigits);
    const actualRounded = Math.round(this.actual * multiplier) / multiplier;
    const expectedRounded = Math.round(expected * multiplier) / multiplier;

    if (actualRounded !== expectedRounded) {
      throw new Error(
        $tr("expect.expectedCloseToReceived", {
          expected: String(expected),
          numDigits: String(numDigits),
          received: String(this.actual),
        }),
      );
    }
  }

  /**
   * 是否为 NaN
   */
  toBeNaN(): void {
    if (!Number.isNaN(this.actual)) {
      throw new Error(
        $tr("expect.expectedNaNReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 具有指定长度（用于数组、字符串等）
   */
  toHaveLength(expected: number): void {
    let length: number;
    if (Array.isArray(this.actual)) {
      length = this.actual.length;
    } else if (typeof this.actual === "string") {
      length = this.actual.length;
    } else if (
      this.actual &&
      typeof this.actual === "object" &&
      "length" in this.actual &&
      typeof (this.actual as any).length === "number"
    ) {
      length = (this.actual as any).length;
    } else {
      throw new Error(
        $tr("expect.toHaveLengthOnlyArraysOrStrings", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }

    if (length !== expected) {
      throw new Error(
        $tr("expect.expectedLengthReceived", {
          expected: String(expected),
          length: String(length),
        }),
      );
    }
  }

  /**
   * 是否为数组
   */
  toBeArray(): void {
    if (!Array.isArray(this.actual)) {
      throw new Error(
        $tr("expect.expectedArrayReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 是否为字符串
   */
  toBeString(): void {
    if (typeof this.actual !== "string") {
      throw new Error(
        $tr("expect.expectedStringReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 是否为数字
   */
  toBeNumber(): void {
    if (typeof this.actual !== "number" || Number.isNaN(this.actual)) {
      throw new Error(
        $tr("expect.expectedNumberReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 是否为布尔值
   */
  toBeBoolean(): void {
    if (typeof this.actual !== "boolean") {
      throw new Error(
        $tr("expect.expectedBooleanReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 是否为函数
   */
  toBeFunction(): void {
    if (typeof this.actual !== "function") {
      throw new Error(
        $tr("expect.expectedFunctionReceived", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 是否为空（数组、对象、字符串）
   */
  toBeEmpty(): void {
    if (Array.isArray(this.actual)) {
      if (this.actual.length !== 0) {
        throw new Error(
          $tr("expect.expectedEmptyArrayReceived", {
            length: String(this.actual.length),
          }),
        );
      }
    } else if (typeof this.actual === "string") {
      if (this.actual.length !== 0) {
        throw new Error(
          $tr("expect.expectedEmptyStringReceived", {
            length: String(this.actual.length),
          }),
        );
      }
    } else if (this.actual && typeof this.actual === "object") {
      const keys = Object.keys(this.actual);
      if (keys.length !== 0) {
        throw new Error(
          $tr("expect.expectedEmptyObjectReceived", {
            count: String(keys.length),
          }),
        );
      }
    } else {
      throw new Error(
        $tr("expect.toBeEmptyOnlyArraysOrStringsOrObjects", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 严格深度相等（考虑 undefined、symbol 等，比 toEqual 更严格）
   */
  toStrictEqual(expected: unknown): void {
    if (!this.strictDeepEqual(this.actual, expected)) {
      throw new Error(
        $tr("expect.expectedStrictReceived", {
          expected: JSON.stringify(expected),
          received: stringifyForI18n(this.actual),
        }),
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
      throw new Error($tr("expect.toThrowOnlyFunctions"));
    }

    try {
      this.actual();
      throw new Error($tr("expect.expectedFunctionToThrow"));
    } catch (error) {
      if (expectedError === undefined) {
        // 只要抛出错误即可
        return;
      }

      if (typeof expectedError === "string") {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes(expectedError)) {
          throw new Error(
            $tr("expect.expectedErrorContainReceived", {
              expected: expectedError,
              received: errorMsg,
            }),
          );
        }
      } else if (expectedError instanceof RegExp) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!expectedError.test(errorMsg)) {
          throw new Error(
            $tr("expect.expectedErrorMatchReceived", {
              pattern: String(expectedError),
              received: errorMsg,
            }),
          );
        }
      } else if (typeof expectedError === "function") {
        if (!(error instanceof expectedError)) {
          const threw = error instanceof Error
            ? error.constructor.name
            : typeof error;
          throw new Error(
            $tr("expect.expectedToThrowThrew", {
              expected: expectedError.name,
              threw,
            }),
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
   * 严格深度相等比较（考虑 undefined、symbol 等）
   */
  protected strictDeepEqual(a: unknown, b: unknown): boolean {
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

    // 获取所有键（包括 symbol）
    const keysA = [
      ...Object.keys(a as Record<string, unknown>),
      ...Object.getOwnPropertySymbols(a as Record<string, unknown>),
    ];
    const keysB = [
      ...Object.keys(b as Record<string, unknown>),
      ...Object.getOwnPropertySymbols(b as Record<string, unknown>),
    ];

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key as any)) {
        return false;
      }

      const valueA = (a as any)[key];
      const valueB = (b as any)[key];

      // 严格检查 undefined
      if (valueA === undefined && valueB !== undefined) {
        return false;
      }
      if (valueA !== undefined && valueB === undefined) {
        return false;
      }

      if (!this.strictDeepEqual(valueA, valueB)) {
        return false;
      }
    }

    return true;
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
        $tr("expect.expectedNotEqualButEqual", {
          expected: JSON.stringify(expected),
        }),
      );
    }
  }

  /**
   * 深度相等（反向）
   */
  override toEqual(expected: unknown): void {
    if (this.deepEqual(this.actual, expected)) {
      throw new Error(
        $tr("expect.expectedNotEqualButEqual", {
          expected: JSON.stringify(expected),
        }),
      );
    }
  }

  /**
   * 为真值（反向）
   */
  override toBeTruthy(): void {
    if (this.actual) {
      throw new Error(
        $tr("expect.expectedFalsyReceivedTruthy", {
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 为假值（反向）
   */
  override toBeFalsy(): void {
    if (!this.actual) {
      throw new Error($tr("expect.expectedTruthyReceivedFalsy"));
    }
  }

  /**
   * 为 null（反向）
   */
  override toBeNull(): void {
    if (this.actual === null) {
      throw new Error($tr("expect.expectedValueNotNull"));
    }
  }

  /**
   * 为 undefined（反向）
   */
  override toBeUndefined(): void {
    if (this.actual === undefined) {
      throw new Error($tr("expect.expectedValueNotUndefined"));
    }
  }

  /**
   * 已定义（反向）
   */
  override toBeDefined(): void {
    if (this.actual !== undefined) {
      throw new Error(
        $tr("expect.expectedUndefinedReceived", {
          received: stringifyForI18n(this.actual),
        }),
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
        $tr("expect.expectedNotMatchReceived", {
          pattern: String(pattern),
          received: stringifyForI18n(this.actual),
        }),
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
          $tr("expect.expectedArrayNotContain", {
            item: JSON.stringify(item),
          }),
        );
      }
    } else if (typeof this.actual === "string") {
      if (this.actual.includes(String(item))) {
        throw new Error(
          $tr("expect.expectedStringNotContain", {
            item: String(item),
          }),
        );
      }
    } else {
      throw new Error($tr("expect.toContainOnlyArraysOrStrings"));
    }
  }

  /**
   * 具有指定属性（反向）
   */
  override toHaveProperty(path: string, value?: unknown): void {
    if (typeof this.actual !== "object" || this.actual === null) {
      // 如果不是对象，反向断言通过（因为确实没有属性）
      return;
    }

    const keys = path.split(".").filter((k) => k.length > 0);
    if (keys.length === 0) {
      // 空路径，反向断言通过
      return;
    }

    let current: any = this.actual;
    let hasProperty = true;

    // 检查属性是否存在
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!; // 已经过滤空字符串，所以不会是 undefined
      if (!(key in current)) {
        hasProperty = false;
        break;
      }
      if (i < keys.length - 1) {
        if (typeof current[key] !== "object" || current[key] === null) {
          hasProperty = false;
          break;
        }
        current = current[key];
      } else {
        // 最后一个键
        if (value !== undefined) {
          // 如果提供了值，检查值是否匹配
          if (this.deepEqual(current[key], value)) {
            hasProperty = true;
          } else {
            hasProperty = false;
          }
        } else {
          hasProperty = true;
        }
      }
    }

    if (hasProperty) {
      const valueHint = value !== undefined
        ? ` or value != ${JSON.stringify(value)}`
        : "";
      throw new Error(
        $tr("expect.expectedNotHaveProperty", {
          path,
          valueHint,
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 浮点数近似相等（反向）
   */
  override toBeCloseTo(expected: number, numDigits: number = 2): void {
    if (typeof this.actual !== "number" || typeof expected !== "number") {
      return; // 如果不是数字，反向断言通过
    }

    const multiplier = Math.pow(10, numDigits);
    const actualRounded = Math.round(this.actual * multiplier) / multiplier;
    const expectedRounded = Math.round(expected * multiplier) / multiplier;

    if (actualRounded === expectedRounded) {
      throw new Error(
        $tr("expect.expectedNotCloseToEqual", {
          expected: String(expected),
          numDigits: String(numDigits),
          received: String(this.actual),
        }),
      );
    }
  }

  /**
   * 是否为 NaN（反向）
   */
  override toBeNaN(): void {
    if (Number.isNaN(this.actual)) {
      throw new Error($tr("expect.expectedValueNotNaN"));
    }
  }

  /**
   * 具有指定长度（反向）
   */
  override toHaveLength(expected: number): void {
    let length: number;
    if (Array.isArray(this.actual)) {
      length = this.actual.length;
    } else if (typeof this.actual === "string") {
      length = this.actual.length;
    } else if (
      this.actual &&
      typeof this.actual === "object" &&
      "length" in this.actual &&
      typeof (this.actual as any).length === "number"
    ) {
      length = (this.actual as any).length;
    } else {
      // 如果不是数组/字符串，反向断言通过
      return;
    }

    if (length === expected) {
      throw new Error(
        $tr("expect.expectedLengthNotEqual", {
          expected: String(expected),
          length: String(length),
        }),
      );
    }
  }

  /**
   * 是否为数组（反向）
   */
  override toBeArray(): void {
    if (Array.isArray(this.actual)) {
      throw new Error($tr("expect.expectedNotArray"));
    }
  }

  /**
   * 是否为字符串（反向）
   */
  override toBeString(): void {
    if (typeof this.actual === "string") {
      throw new Error($tr("expect.expectedNotString"));
    }
  }

  /**
   * 是否为数字（反向）
   */
  override toBeNumber(): void {
    if (typeof this.actual === "number" && !Number.isNaN(this.actual)) {
      throw new Error($tr("expect.expectedNotNumber"));
    }
  }

  /**
   * 是否为布尔值（反向）
   */
  override toBeBoolean(): void {
    if (typeof this.actual === "boolean") {
      throw new Error($tr("expect.expectedNotBoolean"));
    }
  }

  /**
   * 是否为函数（反向）
   */
  override toBeFunction(): void {
    if (typeof this.actual === "function") {
      throw new Error($tr("expect.expectedNotFunction"));
    }
  }

  /**
   * 是否为空（反向）
   */
  override toBeEmpty(): void {
    if (Array.isArray(this.actual)) {
      if (this.actual.length === 0) {
        throw new Error($tr("expect.expectedNotEmptyArray"));
      }
    } else if (typeof this.actual === "string") {
      if (this.actual.length === 0) {
        throw new Error($tr("expect.expectedNotEmptyString"));
      }
    } else if (this.actual && typeof this.actual === "object") {
      const keys = Object.keys(this.actual);
      if (keys.length === 0) {
        throw new Error($tr("expect.expectedNotEmptyObject"));
      }
    }
  }

  /**
   * 严格深度相等（反向）
   */
  override toStrictEqual(expected: unknown): void {
    if (this.strictDeepEqual(this.actual, expected)) {
      throw new Error(
        $tr("expect.expectedStrictNotEqual", {
          expected: JSON.stringify(expected),
        }),
      );
    }
  }

  /**
   * 大于（反向）
   */
  override toBeGreaterThan(expected: number): void {
    if (typeof this.actual === "number" && this.actual > expected) {
      throw new Error(
        $tr("expect.expectedNotGreaterThan", {
          expected: String(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 大于等于（反向）
   */
  override toBeGreaterThanOrEqual(expected: number): void {
    if (typeof this.actual === "number" && this.actual >= expected) {
      throw new Error(
        $tr("expect.expectedNotGreaterThanOrEqual", {
          expected: String(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 小于（反向）
   */
  override toBeLessThan(expected: number): void {
    if (typeof this.actual === "number" && this.actual < expected) {
      throw new Error(
        $tr("expect.expectedNotLessThan", {
          expected: String(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 小于等于（反向）
   */
  override toBeLessThanOrEqual(expected: number): void {
    if (typeof this.actual === "number" && this.actual <= expected) {
      throw new Error(
        $tr("expect.expectedNotLessThanOrEqual", {
          expected: String(expected),
          received: stringifyForI18n(this.actual),
        }),
      );
    }
  }

  /**
   * 为指定类型的实例（反向）
   */
  override toBeInstanceOf(expected: new (...args: any[]) => any): void {
    if (this.actual instanceof expected) {
      throw new Error(
        $tr("expect.expectedNotInstance", {
          name: expected.name,
          received: stringifyForI18n(this.actual),
        }),
      );
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
      throw new Error($tr("expect.toThrowOnlyFunctions"));
    }

    try {
      this.actual();
      // 函数没有抛出错误，符合预期
    } catch (error) {
      // 函数抛出了错误，需要检查是否匹配 expectedError
      if (expectedError === undefined) {
        // 没有指定错误类型，任何错误都应该报错
        const message = error instanceof Error ? error.message : String(error);
        throw new Error($tr("expect.expectedFunctionNotToThrow", { message }));
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
          $tr("expect.expectedFunctionNotToThrowMatching", {
            expectedDesc,
            message: errorMsg,
          }),
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
  throw new Error(message || $tr("expect.testFailed"));
};

/**
 * 导出 expect 函数
 */
export const expect: ExpectFunction = expectFn as ExpectFunction;

// expectMock 在 mock.ts 中定义，这里不需要重复导出
