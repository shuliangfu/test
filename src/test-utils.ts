/**
 * 测试工具函数模块
 * 提供 Setup/Teardown、参数化测试、基准测试等功能
 */

import { IS_BUN } from "@dreamer/runtime-adapter";
import { pendingSuiteHooks } from "./hooks-state.ts";
import { $tr } from "./i18n.ts";
import { logger } from "./logger.ts";
import {
  registerBunNativeHook,
  syncPendingHooksToCurrentSuite,
  test,
} from "./test-runner.ts";
import type { TestContext, TestOptions } from "./types.ts";

/**
 * 为 Bun 原生 beforeEach/afterEach 构造轻量 TestContext（与 Deno 路径字段对齐）
 */
function createHookContext(label: string): TestContext {
  return {
    name: label,
    origin: "",
    sanitizeExit: true,
    sanitizeOps: true,
    sanitizeResources: true,
    async step<T>(
      stepName: string,
      fn: (t: TestContext) => Promise<T> | T,
    ): Promise<T> {
      return await fn(createHookContext(`${label} > ${stepName}`));
    },
  };
}

/**
 * 设置 beforeAll 钩子
 *
 * Bun：同时注册 `bun:test` 原生 beforeAll（作用域=当前 describe）。
 * Deno：仅写入套件，由 test-runner 在首个 it 前执行一次。
 */
export function beforeAll(fn: () => void | Promise<void>): void {
  pendingSuiteHooks.beforeAll = fn;
  syncPendingHooksToCurrentSuite();
  if (IS_BUN) {
    // 默认加长超时：e2e 起服 + sleep 易 >5s
    registerBunNativeHook("beforeAll", fn as () => void | Promise<void>);
  }
}

/**
 * 设置 afterAll 钩子
 *
 * Bun：原生 afterAll（保证在同套件全部 it 之后执行；不再伪装成普通 test）。
 * Deno：describe 结束时注册为特殊 Deno.test 用例。
 */
export function afterAll(fn: () => void | Promise<void>): void {
  pendingSuiteHooks.afterAll = fn;
  syncPendingHooksToCurrentSuite();
  if (IS_BUN) {
    registerBunNativeHook("afterAll", fn as () => void | Promise<void>);
  }
}

/**
 * 设置 beforeEach 钩子
 * @param fn 钩子函数，可以接收可选的 TestContext 参数
 * @param options 钩子选项（可选）；`timeout` 在 Bun 下传给原生钩子
 */
export function beforeEach(
  fn: (t?: TestContext) => void | Promise<void>,
  options?: TestOptions,
): void {
  pendingSuiteHooks.beforeEach = fn;
  pendingSuiteHooks.options = options;
  syncPendingHooksToCurrentSuite();
  if (IS_BUN) {
    registerBunNativeHook(
      "beforeEach",
      async () => {
        const ctx = createHookContext("beforeEach");
        if (options?.sanitizeOps !== undefined) {
          ctx.sanitizeOps = options.sanitizeOps;
        }
        if (options?.sanitizeResources !== undefined) {
          ctx.sanitizeResources = options.sanitizeResources;
        }
        await fn(ctx);
      },
      options?.timeout != null ? { timeout: options.timeout } : undefined,
    );
  }
}

/**
 * 设置 afterEach 钩子
 * @param fn 钩子函数，可以接收可选的 TestContext 参数
 * @param options 钩子选项（可选）；`timeout` 在 Bun 下传给原生钩子
 */
export function afterEach(
  fn: (t?: TestContext) => void | Promise<void>,
  options?: TestOptions,
): void {
  pendingSuiteHooks.afterEach = fn;
  pendingSuiteHooks.options = options;
  syncPendingHooksToCurrentSuite();
  if (IS_BUN) {
    registerBunNativeHook(
      "afterEach",
      async () => {
        const ctx = createHookContext("afterEach");
        if (options?.sanitizeOps !== undefined) {
          ctx.sanitizeOps = options.sanitizeOps;
        }
        if (options?.sanitizeResources !== undefined) {
          ctx.sanitizeResources = options.sanitizeResources;
        }
        await fn(ctx);
      },
      options?.timeout != null ? { timeout: options.timeout } : undefined,
    );
  }
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
          if (!isNaN(idx) && idx < testCase.length) {
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
    const IS_DENO = typeof (globalThis as { Deno?: unknown }).Deno !==
      "undefined";
    const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

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
    } else if (isBun) {
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
