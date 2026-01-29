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
   * 具有指定属性
   * @param path 属性路径（支持点号分隔的嵌套路径，如 "user.name"）
   * @param value 可选，如果提供，还会检查属性值是否匹配
   */
  toHaveProperty(path: string, value?: unknown): void {
    if (typeof this.actual !== "object" || this.actual === null) {
      throw new Error(
        `期望值为对象，实际值: ${JSON.stringify(this.actual)}`,
      );
    }

    const keys = path.split(".").filter((k) => k.length > 0);
    if (keys.length === 0) {
      throw new Error("属性路径不能为空");
    }

    let current: any = this.actual;

    // 遍历路径
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!; // 已经过滤空字符串，所以不会是 undefined
      if (!(key in current)) {
        throw new Error(
          `期望对象具有属性 "${path}"，但缺少 "${key}"。实际值: ${
            JSON.stringify(this.actual)
          }`,
        );
      }
      if (i < keys.length - 1) {
        // 不是最后一个键，继续深入
        if (typeof current[key] !== "object" || current[key] === null) {
          throw new Error(
            `期望对象路径 "${
              keys.slice(0, i + 1).join(".")
            }" 指向对象，但实际为: ${JSON.stringify(current[key])}`,
          );
        }
        current = current[key];
      } else {
        // 最后一个键，检查值（如果提供）
        if (value !== undefined) {
          if (!this.deepEqual(current[key], value)) {
            throw new Error(
              `期望对象属性 "${path}" 的值为 ${
                JSON.stringify(value)
              }，实际值: ${JSON.stringify(current[key])}`,
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
        `toBeCloseTo 只能用于数字，实际值: ${JSON.stringify(this.actual)}`,
      );
    }

    const multiplier = Math.pow(10, numDigits);
    const actualRounded = Math.round(this.actual * multiplier) / multiplier;
    const expectedRounded = Math.round(expected * multiplier) / multiplier;

    if (actualRounded !== expectedRounded) {
      throw new Error(
        `期望值约等于 ${expected}（精度 ${numDigits} 位小数），实际值: ${this.actual}`,
      );
    }
  }

  /**
   * 是否为 NaN
   */
  toBeNaN(): void {
    if (!Number.isNaN(this.actual)) {
      throw new Error(
        `期望值为 NaN，实际值: ${JSON.stringify(this.actual)}`,
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
        `toHaveLength 只能用于数组、字符串或具有 length 属性的对象，实际值: ${
          JSON.stringify(this.actual)
        }`,
      );
    }

    if (length !== expected) {
      throw new Error(
        `期望长度为 ${expected}，实际长度: ${length}`,
      );
    }
  }

  /**
   * 是否为数组
   */
  toBeArray(): void {
    if (!Array.isArray(this.actual)) {
      throw new Error(
        `期望值为数组，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 是否为字符串
   */
  toBeString(): void {
    if (typeof this.actual !== "string") {
      throw new Error(
        `期望值为字符串，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 是否为数字
   */
  toBeNumber(): void {
    if (typeof this.actual !== "number" || Number.isNaN(this.actual)) {
      throw new Error(
        `期望值为数字，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 是否为布尔值
   */
  toBeBoolean(): void {
    if (typeof this.actual !== "boolean") {
      throw new Error(
        `期望值为布尔值，实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 是否为函数
   */
  toBeFunction(): void {
    if (typeof this.actual !== "function") {
      throw new Error(
        `期望值为函数，实际值: ${JSON.stringify(this.actual)}`,
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
          `期望数组为空，实际长度: ${this.actual.length}`,
        );
      }
    } else if (typeof this.actual === "string") {
      if (this.actual.length !== 0) {
        throw new Error(
          `期望字符串为空，实际长度: ${this.actual.length}`,
        );
      }
    } else if (this.actual && typeof this.actual === "object") {
      const keys = Object.keys(this.actual);
      if (keys.length !== 0) {
        throw new Error(
          `期望对象为空，实际有 ${keys.length} 个属性`,
        );
      }
    } else {
      throw new Error(
        `toBeEmpty 只能用于数组、字符串或对象，实际值: ${
          JSON.stringify(this.actual)
        }`,
      );
    }
  }

  /**
   * 严格深度相等（考虑 undefined、symbol 等，比 toEqual 更严格）
   */
  toStrictEqual(expected: unknown): void {
    if (!this.strictDeepEqual(this.actual, expected)) {
      throw new Error(
        `期望值（严格相等）: ${JSON.stringify(expected)}, 实际值: ${
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
      throw new Error(
        `期望对象不具有属性 "${path}"${
          value !== undefined ? ` 或值不等于 ${JSON.stringify(value)}` : ""
        }，但实际具有该属性。实际值: ${JSON.stringify(this.actual)}`,
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
        `期望值不约等于 ${expected}（精度 ${numDigits} 位小数），但实际值相等: ${this.actual}`,
      );
    }
  }

  /**
   * 是否为 NaN（反向）
   */
  override toBeNaN(): void {
    if (Number.isNaN(this.actual)) {
      throw new Error(`期望值不为 NaN，但实际值为 NaN`);
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
        `期望长度不等于 ${expected}，但实际长度相等: ${length}`,
      );
    }
  }

  /**
   * 是否为数组（反向）
   */
  override toBeArray(): void {
    if (Array.isArray(this.actual)) {
      throw new Error(`期望值不为数组，但实际值为数组`);
    }
  }

  /**
   * 是否为字符串（反向）
   */
  override toBeString(): void {
    if (typeof this.actual === "string") {
      throw new Error(`期望值不为字符串，但实际值为字符串`);
    }
  }

  /**
   * 是否为数字（反向）
   */
  override toBeNumber(): void {
    if (typeof this.actual === "number" && !Number.isNaN(this.actual)) {
      throw new Error(`期望值不为数字，但实际值为数字`);
    }
  }

  /**
   * 是否为布尔值（反向）
   */
  override toBeBoolean(): void {
    if (typeof this.actual === "boolean") {
      throw new Error(`期望值不为布尔值，但实际值为布尔值`);
    }
  }

  /**
   * 是否为函数（反向）
   */
  override toBeFunction(): void {
    if (typeof this.actual === "function") {
      throw new Error(`期望值不为函数，但实际值为函数`);
    }
  }

  /**
   * 是否为空（反向）
   */
  override toBeEmpty(): void {
    if (Array.isArray(this.actual)) {
      if (this.actual.length === 0) {
        throw new Error(`期望值不为空，但实际为空数组`);
      }
    } else if (typeof this.actual === "string") {
      if (this.actual.length === 0) {
        throw new Error(`期望值不为空，但实际为空字符串`);
      }
    } else if (this.actual && typeof this.actual === "object") {
      const keys = Object.keys(this.actual);
      if (keys.length === 0) {
        throw new Error(`期望值不为空，但实际为空对象`);
      }
    }
  }

  /**
   * 严格深度相等（反向）
   */
  override toStrictEqual(expected: unknown): void {
    if (this.strictDeepEqual(this.actual, expected)) {
      throw new Error(
        `期望值（严格相等）不等于 ${JSON.stringify(expected)}，但实际值相等`,
      );
    }
  }

  /**
   * 大于（反向）
   */
  override toBeGreaterThan(expected: number): void {
    if (typeof this.actual === "number" && this.actual > expected) {
      throw new Error(
        `期望值不大于 ${expected}，但实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 大于等于（反向）
   */
  override toBeGreaterThanOrEqual(expected: number): void {
    if (typeof this.actual === "number" && this.actual >= expected) {
      throw new Error(
        `期望值不大于等于 ${expected}，但实际值: ${
          JSON.stringify(this.actual)
        }`,
      );
    }
  }

  /**
   * 小于（反向）
   */
  override toBeLessThan(expected: number): void {
    if (typeof this.actual === "number" && this.actual < expected) {
      throw new Error(
        `期望值不小于 ${expected}，但实际值: ${JSON.stringify(this.actual)}`,
      );
    }
  }

  /**
   * 小于等于（反向）
   */
  override toBeLessThanOrEqual(expected: number): void {
    if (typeof this.actual === "number" && this.actual <= expected) {
      throw new Error(
        `期望值不小于等于 ${expected}，但实际值: ${
          JSON.stringify(this.actual)
        }`,
      );
    }
  }

  /**
   * 为指定类型的实例（反向）
   */
  override toBeInstanceOf(expected: new (...args: any[]) => any): void {
    if (this.actual instanceof expected) {
      throw new Error(
        `期望值不为 ${expected.name} 的实例，但实际值是实例。实际值: ${
          JSON.stringify(this.actual)
        }`,
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
