/**
 * 测试工具函数模块
 * 提供 Setup/Teardown、参数化测试、基准测试等功能
 */

import { _setCurrentSuiteHooks, test } from "./test-runner.ts";
import type { TestContext, TestHooks, TestOptions } from "./types.ts";

/**
 * 测试套件配置
 * 注意：这些钩子会被添加到当前测试套件中
 */
const currentHooks: TestHooks = {};

/**
 * 设置 beforeAll 钩子
 */
export function beforeAll(fn: () => void | Promise<void>): void {
  currentHooks.beforeAll = fn;
  _setCurrentSuiteHooks(currentHooks);
}

/**
 * 设置 afterAll 钩子
 */
export function afterAll(fn: () => void | Promise<void>): void {
  currentHooks.afterAll = fn;
  _setCurrentSuiteHooks(currentHooks);
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
  currentHooks.beforeEach = fn;
  currentHooks.options = options;
  _setCurrentSuiteHooks(currentHooks);
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
  currentHooks.afterEach = fn;
  currentHooks.options = options;
  _setCurrentSuiteHooks(currentHooks);
}

/**
 * 参数化测试
 * @param cases 测试用例数组
 * @param fn 测试函数
 */
export function testEach<T extends unknown[]>(
  cases: T[],
): (name: string, fn: (...args: T) => void | Promise<void>) => void {
  return (name: string, fn: (...args: T) => void | Promise<void>) => {
    for (const testCase of cases) {
      const caseName = name.replace(/%\w+/g, (match) => {
        const index = match.slice(1);
        // 尝试从测试用例中获取对应的值
        if (Array.isArray(testCase)) {
          const idx = parseInt(index, 10);
          if (!isNaN(idx) && idx >= 0 && idx < testCase.length) {
            return String(testCase[idx]);
          }
        }
        return match;
      });

      test(`${caseName}`, async () => {
        if (currentHooks.beforeEach) {
          await currentHooks.beforeEach();
        }

        try {
          await fn(...testCase);

          if (currentHooks.afterEach) {
            await currentHooks.afterEach();
          }
        } catch (error) {
          if (currentHooks.afterEach) {
            await currentHooks.afterEach();
          }
          throw error;
        }
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
    // 预热
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // 正式测试
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      await fn();
    }
    const end = performance.now();

    const avgTime = (end - start) / n;
    // 美化基准测试输出
    const IS_DENO = typeof (globalThis as any).Deno !== "undefined";
    const IS_BUN = typeof (globalThis as any).Bun !== "undefined";

    if (IS_DENO) {
      // Deno 环境：Deno 会自动添加分隔线，我们直接使用 console.log
      const yellow = "\x1b[33m";
      const cyan = "\x1b[36m";
      const gray = "\x1b[90m";
      const bold = "\x1b[1m";
      const reset = "\x1b[0m";
      console.log(
        `${yellow}⚡${reset} ${gray}基准测试 "${name}": 平均 ${bold}${cyan}${
          avgTime.toFixed(3)
        }ms${reset}${gray} (${n} 次运行)${reset}`,
      );
    } else if (IS_BUN) {
      // Bun 环境：使用 ANSI 颜色代码，添加分隔线以统一格式
      const yellow = "\x1b[33m";
      const cyan = "\x1b[36m";
      const gray = "\x1b[90m";
      const bold = "\x1b[1m";
      const reset = "\x1b[0m";
      const dim = "\x1b[2m";
      // 添加分隔线，模仿 Deno 的输出格式
      console.log(`${dim}------- output -------${reset}`);
      console.log(
        `${yellow}⚡${reset} ${gray}基准测试 "${name}": 平均 ${bold}${cyan}${
          avgTime.toFixed(3)
        }ms${reset}${gray} (${n} 次运行)${reset}`,
      );
      console.log(`${dim}----- output end -----${reset}`);
    } else {
      // 其他环境：普通输出
      console.log(
        `⚡ 基准测试 "${name}": 平均 ${avgTime.toFixed(3)}ms (${n} 次运行)`,
      );
    }
  });
}
