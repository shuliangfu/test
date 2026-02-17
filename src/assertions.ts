/**
 * 断言工具函数模块
 * 提供各种断言辅助函数
 */

import { $t } from "./i18n.ts";

/**
 * 深度相等比较函数
 */
function deepEqual(a: unknown, b: unknown): boolean {
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
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * 断言异步函数抛出错误
 * @param fn 异步函数
 * @param ErrorClass 错误类型（可选）
 * @param msgIncludes 错误消息包含的字符串或正则表达式（可选）
 */
export async function assertRejects(
  fn: () => Promise<unknown>,
  ErrorClass?: new (...args: any[]) => Error,
  msgIncludes?: string | RegExp,
): Promise<void> {
  try {
    await fn();
    throw new Error($t("assert.expectedFunctionToThrow"));
  } catch (error) {
    if (ErrorClass && !(error instanceof ErrorClass)) {
      const threw = error instanceof Error
        ? error.constructor.name
        : typeof error;
      throw new Error(
        $t("assert.expectedToThrowThrew", {
          expected: ErrorClass.name,
          threw,
        }),
      );
    }

    if (msgIncludes) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (typeof msgIncludes === "string") {
        if (!errorMsg.includes(msgIncludes)) {
          throw new Error(
            $t("assert.expectedErrorContainReceived", {
              expected: msgIncludes,
              received: errorMsg,
            }),
          );
        }
      } else if (msgIncludes instanceof RegExp) {
        if (!msgIncludes.test(errorMsg)) {
          throw new Error(
            $t("assert.expectedErrorMatchReceived", {
              pattern: String(msgIncludes),
              received: errorMsg,
            }),
          );
        }
      }
    }
  }
}

/**
 * 断言异步函数成功执行
 * @param fn 异步函数
 * @param expected 期望返回值（可选）
 */
export async function assertResolves(
  fn: () => Promise<unknown>,
  expected?: unknown,
): Promise<void> {
  try {
    const result = await fn();
    if (expected !== undefined) {
      if (!deepEqual(result, expected)) {
        throw new Error(
          $t("assert.expectedReturnReceived", {
            expected: JSON.stringify(expected),
            received: JSON.stringify(result),
          }),
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error($t("assert.expectedSucceedButThrew", { message }));
  }
}

/**
 * 断言深度相等
 * @param actual 实际值
 * @param expected 期望值
 * @param msg 错误消息（可选）
 */
export function assertDeepEqual(
  actual: unknown,
  expected: unknown,
  msg?: string,
): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(
      msg ??
        $t("assert.expectedReceived", {
          expected: JSON.stringify(expected),
          received: JSON.stringify(actual),
        }),
    );
  }
}

/**
 * 断言实例类型
 * @param actual 实际值
 * @param expected 期望类型
 * @param msg 错误消息（可选）
 */
export function assertInstanceOf(
  actual: unknown,
  expected: new (...args: any[]) => any,
  msg?: string,
): void {
  if (!(actual instanceof expected)) {
    throw new Error(
      msg ??
        $t("assert.expectedInstanceReceived", {
          name: expected.name,
          received: JSON.stringify(actual),
        }),
    );
  }
}

/**
 * 断言匹配正则表达式
 * @param actual 实际值
 * @param regex 正则表达式
 * @param msg 错误消息（可选）
 */
export function assertMatch(
  actual: unknown,
  regex: RegExp | string,
  msg?: string,
): void {
  const str = String(actual);
  const pattern = typeof regex === "string" ? new RegExp(regex) : regex;
  if (!pattern.test(str)) {
    throw new Error(
      msg ??
        $t("assert.expectedMatchReceived", {
          pattern: String(pattern),
          received: JSON.stringify(actual),
        }),
    );
  }
}
