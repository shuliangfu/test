/**
 * 测试工具函数模块
 * 提供 Setup/Teardown、参数化测试、基准测试等功能
 */

import { pendingSuiteHooks } from "./hooks-state.ts";
import { $tr } from "./i18n.ts";
import { logger } from "./logger.ts";
import { syncPendingHooksToCurrentSuite, test } from "./test-runner.ts";
import type { TestContext, TestOptions } from "./types.ts";

/**
 * 设置 beforeAll 钩子
 */
export function beforeAll(fn: () => void | Promise<void>): void {
  pendingSuiteHooks.beforeAll = fn;
  syncPendingHooksToCurrentSuite();
}

/**
 * 设置 afterAll 钩子
 */
export function afterAll(fn: () => void | Promise<void>): void {
  pendingSuiteHooks.afterAll = fn;
  syncPendingHooksToCurrentSuite();
}

/**
 * 设置 beforeEach 钩子
 * @param fn 钩子函数，可以接收可选的 TestContext 参数
 * @param options 钩子选项（可选）
 */
export function beforeEach(
  fn: (t?: TestContext) => void | Promise<void>,
  options?: TestOptions,
): void {
  pendingSuiteHooks.beforeEach = fn;
  pendingSuiteHooks.options = options;
  syncPendingHooksToCurrentSuite();
}

/**
 * 设置 afterEach 钩子
 * @param fn 钩子函数，可以接收可选的 TestContext 参数
 * @param options 钩子选项（可选）
 */
export function afterEach(
  fn: (t?: TestContext) => void | Promise<void>,
  options?: TestOptions,
): void {
  pendingSuiteHooks.afterEach = fn;
  pendingSuiteHooks.options = options;
  syncPendingHooksToCurrentSuite();
}

/**
 * 参数化测试：为每组数据注册独立用例，与 `it` 走同一套钩子/超时/浏览器逻辑。
 * @param cases 测试用例数组
 * @param fn 接收每组展开参数的测试体
 */
export function testEach<T extends unknown[]>(
  cases: T[],
): (name: string, fn: (...args: T) => void | Promise<void>) => void {
  return (name: string, fn: (...args: T) => void | Promise<void>) => {
    for (const testCase of cases) {
      const caseName = name.replace(/%\w+/g, (match) => {
        const index = match.slice(1);
        if (Array.isArray(testCase)) {
          const idx = parseInt(index, 10);
          if (!isNaN(idx) && idx >= 0 && idx < testCase.length) {
            return String(testCase[idx]);
          }
        }
        return match;
      });

      test(caseName, async () => {
        await fn(...testCase);
      });
    }
  };
}

/**
 * 基准测试
 * @param name 测试名称
 * @param fn 测试函数
 * @param options 选项
 */
export function bench(
  name: string,
  fn: () => void | Promise<void>,
  options?: {
    /** 运行次数（默认：100） */
    n?: number;
    /** 预热次数（默认：10） */
    warmup?: number;
  },
): void {
  const n = options?.n || 100;
  const warmup = options?.warmup || 10;

  test(`bench: ${name}`, async () => {
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    const start = performance.now();
    for (let i = 0; i < n; i++) {
      await fn();
    }
    const end = performance.now();

    const avgTime = (end - start) / n;
    const IS_DENO = typeof (globalThis as any).Deno !== "undefined";
    const IS_BUN = typeof (globalThis as any).Bun !== "undefined";

    const benchMsg = $tr("test.benchSummary", {
      name,
      avg: avgTime.toFixed(3),
      n: String(n),
    });
    if (IS_DENO) {
      const yellow = "\x1b[33m";
      const gray = "\x1b[90m";
      const reset = "\x1b[0m";
      logger.info(`${yellow}⚡${reset} ${gray}${benchMsg}${reset}`);
    } else if (IS_BUN) {
      const yellow = "\x1b[33m";
      const gray = "\x1b[90m";
      const reset = "\x1b[0m";
      const dim = "\x1b[2m";
      logger.info(`${dim}${$tr("test.outputSeparator")}${reset}`);
      logger.info(`${yellow}⚡${reset} ${gray}${benchMsg}${reset}`);
      logger.info(`${dim}${$tr("test.outputEnd")}${reset}`);
    } else {
      logger.info(`⚡ ${benchMsg}`);
    }
  });
}
