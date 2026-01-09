/**
 * 测试运行器
 * 提供 describe, test, it 等测试组织函数
 * 兼容 Deno 和 Bun 环境
 */

import type { TestCase, TestContext, TestHooks, TestSuite } from "./types.ts";

/**
 * 当前测试套件栈
 */
const suiteStack: TestSuite[] = [];
const rootSuite: TestSuite = {
  name: "root",
  fn: () => {},
  tests: [],
  suites: [],
};

let currentSuite = rootSuite;

/**
 * 测试统计信息
 */
interface TestStats {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

const testStats: TestStats = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
};

/**
 * 设置当前套件的钩子（由 test-utils 调用）
 */
export function _setCurrentSuiteHooks(hooks: TestHooks): void {
  currentSuite.beforeAll = hooks.beforeAll;
  currentSuite.afterAll = hooks.afterAll;
  currentSuite.beforeEach = hooks.beforeEach;
  currentSuite.afterEach = hooks.afterEach;
}

/**
 * 检测运行环境
 */
const IS_DENO = typeof (globalThis as any).Deno !== "undefined" &&
  typeof (globalThis as any).Deno.test !== "undefined";
const IS_BUN = typeof (globalThis as any).Bun !== "undefined";

/**
 * 获取 Bun 的 test 函数
 */
async function getBunTest(): Promise<any> {
  if (!IS_BUN) {
    return null;
  }
  try {
    // @ts-ignore: bun:test 是 Bun 特有的模块，Deno 类型检查器不识别
    const bunTest = await import("bun:test" as string);
    return bunTest.test;
  } catch {
    // 如果导入失败，尝试使用全局 test
    return (globalThis as any).test;
  }
}

/**
 * 创建测试上下文
 */
function createTestContext(name: string): TestContext {
  return {
    name,
    origin: "",
    sanitizeExit: true,
    sanitizeOps: true,
    sanitizeResources: true,
    async step<T>(
      stepName: string,
      fn: (t: TestContext) => Promise<T> | T,
    ): Promise<T> {
      return await fn(createTestContext(`${name} > ${stepName}`));
    },
  };
}

/**
 * 创建测试套件
 * @param name 套件名称
 * @param fn 套件函数
 */
export function describe(
  name: string,
  fn: () => void | Promise<void>,
): void {
  const suite: TestSuite = {
    name,
    fn,
    tests: [],
    suites: [],
    parent: currentSuite,
    // 从当前套件继承钩子
    beforeAll: currentSuite.beforeAll,
    afterAll: currentSuite.afterAll,
    beforeEach: currentSuite.beforeEach,
    afterEach: currentSuite.afterEach,
  };

  currentSuite.suites.push(suite);
  suiteStack.push(currentSuite);
  currentSuite = suite;

  try {
    fn();
  } finally {
    currentSuite = suiteStack.pop() || rootSuite;
  }
}

/**
 * 创建测试用例
 * @param name 测试名称
 * @param fn 测试函数（可以接受可选的测试上下文参数）
 */
export function test(
  name: string,
  fn: (t?: TestContext) => void | Promise<void>,
  options?: {
    timeout?: number;
    sanitizeOps?: boolean;
    sanitizeResources?: boolean;
  },
): void {
  const testCase: TestCase = {
    name,
    fn,
    timeout: options?.timeout,
    ...(options?.sanitizeOps !== undefined &&
      { sanitizeOps: options.sanitizeOps }),
    ...(options?.sanitizeResources !== undefined &&
      { sanitizeResources: options.sanitizeResources }),
  };
  currentSuite.tests.push(testCase);

  // 在 Deno 环境下，直接注册测试，使用 parallel: false 确保顺序执行
  if (IS_DENO) {
    const fullName = getFullTestName(name);
    const suite = currentSuite;
    const testOptions: any = {
      name: fullName,
      parallel: false, // 确保顺序执行
      sanitizeOutput: false, // 禁用输出分隔线
      fn: async (t: any) => {
        // 如果选项中有设置 sanitizeOps 或 sanitizeResources，在测试开始时设置
        // 注意：这些选项需要在测试函数内部通过 t 参数设置
        if (options?.sanitizeOps !== undefined) {
          t.sanitizeOps = options.sanitizeOps;
        }
        if (options?.sanitizeResources !== undefined) {
          t.sanitizeResources = options.sanitizeResources;
        }

        // 执行 beforeAll（只执行一次，通过检查标志）
        if (suite.beforeAll && !(suite as any)._beforeAllExecuted) {
          await suite.beforeAll();
          (suite as any)._beforeAllExecuted = true;
        }

        // 执行 beforeEach
        if (suite.beforeEach) {
          await suite.beforeEach();
        }

        const testContext = createTestContext(fullName);
        // 将 Deno.TestContext 的属性复制到我们的 TestContext
        Object.assign(testContext, {
          origin: t.origin,
          sanitizeExit: t.sanitizeExit,
          sanitizeOps: t.sanitizeOps,
          sanitizeResources: t.sanitizeResources,
          step: t.step.bind(t),
        });

        try {
          // 执行测试函数，如果函数内部修改了 sanitizeOps 或 sanitizeResources，
          // 需要同步到 Deno.TestContext
          await fn(testContext);
          // 同步测试上下文中的 sanitize 选项到 Deno.TestContext
          if (testContext.sanitizeOps !== undefined) {
            t.sanitizeOps = testContext.sanitizeOps;
          }
          if (testContext.sanitizeResources !== undefined) {
            t.sanitizeResources = testContext.sanitizeResources;
          }
        } finally {
          // 执行 afterEach
          if (suite.afterEach) {
            await suite.afterEach();
          }
        }
      },
    };
    // 如果设置了超时，添加到选项
    if (options?.timeout) {
      testOptions.timeout = options.timeout;
    }
    (globalThis as any).Deno.test(testOptions);
  } else if (IS_BUN) {
    // Bun 环境下，直接注册测试
    // 注意：Bun 默认并发执行，需要使用 --test-concurrency 1 来确保顺序执行
    const fullName = getFullTestName(name);
    const suite = currentSuite;

    // 直接获取 Bun.test 函数并注册测试
    // Bun 的 test() API 使用函数参数形式：test(name, fn, options?)
    (async () => {
      const bunTest = await getBunTest();
      if (bunTest) {
        const testFn = async () => {
          // 执行 beforeAll（只执行一次，通过检查标志）
          if (suite.beforeAll && !(suite as any)._beforeAllExecuted) {
            await suite.beforeAll();
            (suite as any)._beforeAllExecuted = true;
          }

          // 执行 beforeEach
          if (suite.beforeEach) {
            await suite.beforeEach();
          }

          const testContext = createTestContext(fullName);

          try {
            await fn(testContext);
            // 测试通过，统计数量
            testStats.passed++;
            testStats.total++;
          } catch (error) {
            // 测试失败，统计数量
            testStats.failed++;
            testStats.total++;
            throw error; // 重新抛出错误，让 Bun 捕获
          } finally {
            // 执行 afterEach
            if (suite.afterEach) {
              await suite.afterEach();
            }
          }
        };

        // Bun 的 test() 使用函数参数形式
        if (options?.timeout) {
          bunTest(fullName, testFn, { timeout: options.timeout });
        } else {
          bunTest(fullName, testFn);
        }
      }
    })();
  }
  // 其他环境：手动顺序执行
}

/**
 * 获取完整的测试名称（包含套件路径）
 */
function getFullTestName(name: string): string {
  const path: string[] = [];
  let suite: TestSuite | undefined = currentSuite;
  while (suite && suite.name !== "root") {
    path.unshift(suite.name);
    suite = suite.parent;
  }
  return path.length > 0 ? `${path.join(" > ")} > ${name}` : name;
}

/**
 * 跳过测试
 */
test.skip = function (
  name: string,
  fn: (t?: TestContext) => void | Promise<void>,
): void {
  const testCase: TestCase = {
    name,
    fn,
    skip: true,
  };
  currentSuite.tests.push(testCase);

  // 在 Deno 环境下，注册跳过测试
  if (IS_DENO) {
    const fullName = getFullTestName(name);
    (globalThis as any).Deno.test({
      name: fullName,
      ignore: true, // Deno 使用 ignore 来跳过测试
      parallel: false,
      fn: async (t: any) => {
        const testContext = createTestContext(fullName);
        Object.assign(testContext, {
          origin: t.origin,
          sanitizeExit: t.sanitizeExit,
          sanitizeOps: t.sanitizeOps,
          sanitizeResources: t.sanitizeResources,
          step: t.step.bind(t),
        });
        await fn(testContext);
      },
    });
  } else if (IS_BUN) {
    // Bun 环境下，注册跳过测试
    // Bun 的 test.skip() 使用函数参数形式：test.skip(name, fn)
    const fullName = getFullTestName(name);
    (async () => {
      const bunTest = await getBunTest();
      if (bunTest && bunTest.skip) {
        bunTest.skip(fullName, async () => {
          // 跳过测试，使用 ANSI 颜色代码输出黄色提示
          console.log(`\x1b[33m⊘\x1b[0m ${fullName}`);
          const testContext = createTestContext(fullName);
          await fn(testContext);
        });
      }
    })();
  }
  // 其他环境：skip 测试会在 runSuite 中处理
};

/**
 * 只运行此测试
 */
test.only = function (
  name: string,
  fn: (t?: TestContext) => void | Promise<void>,
  options?: { timeout?: number },
): void {
  const testCase: TestCase = {
    name,
    fn,
    only: true,
  };
  currentSuite.tests.push(testCase);

  // 在 Deno 环境下，注册 only 测试
  if (IS_DENO) {
    const fullName = getFullTestName(name);
    (globalThis as any).Deno.test({
      name: fullName,
      only: true,
      parallel: false,
      fn: async (t: any) => {
        const testContext = createTestContext(fullName);
        Object.assign(testContext, {
          origin: t.origin,
          sanitizeExit: t.sanitizeExit,
          sanitizeOps: t.sanitizeOps,
          sanitizeResources: t.sanitizeResources,
          step: t.step?.bind(t) || testContext.step,
        });
        await fn(testContext);
      },
    });
  } else if (IS_BUN) {
    // Bun 环境下，注册 only 测试
    // Bun 的 test.only() 使用函数参数形式：test.only(name, fn, options?)
    const fullName = getFullTestName(name);
    const suite = currentSuite;
    (async () => {
      const bunTest = await getBunTest();
      if (bunTest && bunTest.only) {
        const testFn = async () => {
          // 执行 beforeAll（只执行一次，通过检查标志）
          if (suite.beforeAll && !(suite as any)._beforeAllExecuted) {
            await suite.beforeAll();
            (suite as any)._beforeAllExecuted = true;
          }

          // 执行 beforeEach
          if (suite.beforeEach) {
            await suite.beforeEach();
          }

          const testContext = createTestContext(fullName);

          try {
            await fn(testContext);
            // 测试通过，统计数量
            testStats.passed++;
            testStats.total++;
          } catch (error) {
            // 测试失败，统计数量
            testStats.failed++;
            testStats.total++;
            throw error; // 重新抛出错误，让 Bun 捕获
          } finally {
            // 执行 afterEach
            if (suite.afterEach) {
              await suite.afterEach();
            }
          }
        };

        // Bun 的 test.only() 使用函数参数形式
        if (options?.timeout) {
          bunTest.only(fullName, testFn, { timeout: options.timeout });
        } else {
          bunTest.only(fullName, testFn);
        }
      }
    })();
  }
  // 其他环境：only 测试会在 runAllTests 中处理
};

/**
 * it 作为 test 的别名
 */
export const it = test;
