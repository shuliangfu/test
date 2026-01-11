/**
 * 测试运行器
 * 提供 describe, test, it 等测试组织函数
 * 兼容 Deno 和 Bun 环境
 */

import type {
  DescribeOptions,
  TestCase,
  TestContext,
  TestHooks,
  TestOptions,
  TestSuite,
} from "./types.ts";

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

import { IS_BUN, IS_DENO } from "@dreamer/runtime-adapter";

let currentSuite = rootSuite;

/**
 * Bun 环境下标记是否在 describe 块内（使用计数器支持嵌套）
 */
let describeDepth = 0;

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
 * @param options 套件选项（可选）
 */
export function describe(
  name: string,
  fn: () => void | Promise<void>,
  options?: DescribeOptions,
): void;
/**
 * 创建测试套件（带选项）
 * @param name 套件名称
 * @param options 套件选项
 * @param fn 套件函数
 */
export function describe(
  name: string,
  options: DescribeOptions,
  fn: () => void | Promise<void>,
): void;
export function describe(
  name: string,
  fnOrOptions: (() => void | Promise<void>) | DescribeOptions,
  fnOrOptions2?: (() => void | Promise<void>) | DescribeOptions,
): void {
  // 处理重载：检查第二个参数是函数还是选项
  let actualFn: () => void | Promise<void>;
  let options: DescribeOptions | undefined;

  if (typeof fnOrOptions === "function") {
    actualFn = fnOrOptions;
    // 第三个参数可能是选项
    options = typeof fnOrOptions2 === "object" && fnOrOptions2 !== null &&
        !("call" in fnOrOptions2) && typeof fnOrOptions2 !== "function"
      ? (fnOrOptions2 as DescribeOptions)
      : undefined;
  } else {
    // 第二个参数是选项，第三个参数必须是函数
    options = fnOrOptions as DescribeOptions;
    // 确保第三个参数是函数
    if (typeof fnOrOptions2 !== "function") {
      throw new Error(
        `describe: 当第二个参数是选项对象时，第三个参数必须是函数，但得到: ${typeof fnOrOptions2}。请使用 describe(name, options, fn) 或 describe(name, fn, options) 形式。`,
      );
    }
    actualFn = fnOrOptions2 as () => void | Promise<void>;
  }

  // 确保 actualFn 已正确设置
  if (!actualFn || typeof actualFn !== "function") {
    throw new Error(
      `describe: 无法确定测试函数。请检查参数：第二个参数是 ${typeof fnOrOptions}，第三个参数是 ${typeof fnOrOptions2}`,
    );
  }

  const suite: TestSuite = {
    name,
    fn: actualFn,
    tests: [],
    suites: [],
    parent: currentSuite,
    // 从当前套件继承钩子
    beforeAll: currentSuite.beforeAll,
    afterAll: currentSuite.afterAll,
    beforeEach: currentSuite.beforeEach,
    afterEach: currentSuite.afterEach,
    // 存储套件选项
    options,
  };

  currentSuite.suites.push(suite);
  suiteStack.push(currentSuite);
  currentSuite = suite;

  // 标记进入 describe 块
  if (IS_BUN) {
    describeDepth++;
  }

  try {
    actualFn();
  } finally {
    // 标记退出 describe 块
    if (IS_BUN) {
      describeDepth--;
    }

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

    // 查找所有父套件的选项，合并它们（子套件优先级更高）
    let finalSanitizeOps = options?.sanitizeOps;
    let finalSanitizeResources = options?.sanitizeResources;

    if (
      finalSanitizeOps === undefined || finalSanitizeResources === undefined
    ) {
      let current: TestSuite | null = suite;
      while (current) {
        if (
          finalSanitizeOps === undefined &&
          current.options?.sanitizeOps !== undefined
        ) {
          finalSanitizeOps = current.options.sanitizeOps;
        }
        if (
          finalSanitizeResources === undefined &&
          current.options?.sanitizeResources !== undefined
        ) {
          finalSanitizeResources = current.options.sanitizeResources;
        }
        current = current.parent || null;
      }
    }

    const testOptions: any = {
      name: fullName,
      parallel: false, // 确保顺序执行
      sanitizeOutput: false, // 禁用输出分隔线
      // 在测试选项级别设置 sanitizeOps 和 sanitizeResources
      ...(finalSanitizeOps !== undefined && { sanitizeOps: finalSanitizeOps }),
      ...(finalSanitizeResources !== undefined &&
        { sanitizeResources: finalSanitizeResources }),
      fn: async (t: any) => {
        // 立即应用最终的 sanitizeOps 和 sanitizeResources（必须在任何代码执行之前）
        // 这些值已经在 testOptions 级别设置了，但为了确保，也在函数内部立即设置
        // 注意：必须在任何可能创建定时器或资源的代码之前设置
        if (finalSanitizeOps !== undefined) {
          t.sanitizeOps = finalSanitizeOps;
        }
        if (finalSanitizeResources !== undefined) {
          t.sanitizeResources = finalSanitizeResources;
        }

        // 执行 beforeAll（只执行一次，通过检查标志）
        if (suite.beforeAll && !(suite as any)._beforeAllExecuted) {
          await suite.beforeAll();
          (suite as any)._beforeAllExecuted = true;
        }

        // 执行 beforeEach，传递 TestContext
        // 如果 beforeEach 有选项，应用 sanitizeOps 和 sanitizeResources
        if (suite.beforeEach) {
          // 检查是否有钩子选项（通过检查 TestHooks 的 options）
          const hooksOptions = (suite as any).hooksOptions as
            | TestOptions
            | undefined;
          if (hooksOptions) {
            if (hooksOptions.sanitizeOps !== undefined) {
              t.sanitizeOps = hooksOptions.sanitizeOps;
            }
            if (hooksOptions.sanitizeResources !== undefined) {
              t.sanitizeResources = hooksOptions.sanitizeResources;
            }
          }
          // 创建 TestContext 传递给 beforeEach（使用当前的 t 值）
          // 确保 sanitizeOps 和 sanitizeResources 有默认值（boolean）
          const beforeEachContext = createTestContext(fullName);
          Object.assign(beforeEachContext, {
            origin: t.origin,
            sanitizeExit: t.sanitizeExit,
            sanitizeOps: t.sanitizeOps !== undefined ? t.sanitizeOps : true,
            sanitizeResources: t.sanitizeResources !== undefined
              ? t.sanitizeResources
              : true,
            step: t.step.bind(t),
          });
          await suite.beforeEach(beforeEachContext);
        }

        const testContext = createTestContext(fullName);
        // 将 Deno.TestContext 的属性复制到我们的 TestContext
        // 注意：sanitizeOps 和 sanitizeResources 可能已经在之前被设置（通过套件选项或钩子选项）
        Object.assign(testContext, {
          origin: t.origin,
          sanitizeExit: t.sanitizeExit,
          sanitizeOps: t.sanitizeOps !== undefined
            ? t.sanitizeOps
            : testContext.sanitizeOps,
          sanitizeResources: t.sanitizeResources !== undefined
            ? t.sanitizeResources
            : testContext.sanitizeResources,
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
          // 执行 afterEach，传递 TestContext
          // 如果 afterEach 有选项，应用 sanitizeOps 和 sanitizeResources
          if (suite.afterEach) {
            // 检查是否有钩子选项（通过检查 TestHooks 的 options）
            const hooksOptions = (suite as any).hooksOptions as
              | TestOptions
              | undefined;
            if (hooksOptions) {
              if (hooksOptions.sanitizeOps !== undefined) {
                t.sanitizeOps = hooksOptions.sanitizeOps;
              }
              if (hooksOptions.sanitizeResources !== undefined) {
                t.sanitizeResources = hooksOptions.sanitizeResources;
              }
            }
            // 创建 TestContext 传递给 afterEach（使用当前的 t 值）
            // 确保 sanitizeOps 和 sanitizeResources 有默认值（boolean）
            const afterEachContext = createTestContext(fullName);
            Object.assign(afterEachContext, {
              origin: t.origin,
              sanitizeExit: t.sanitizeExit,
              sanitizeOps: t.sanitizeOps !== undefined ? t.sanitizeOps : true,
              sanitizeResources: t.sanitizeResources !== undefined
                ? t.sanitizeResources
                : true,
              step: t.step.bind(t),
            });
            await suite.afterEach(afterEachContext);
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
    // Bun 环境下，检查是否在 describe 块内
    if (describeDepth > 0) {
      // 在 describe 块内，直接注册测试
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

            // 执行 beforeEach，传递 TestContext（Bun 环境下需要创建模拟的 TestContext）
            if (suite.beforeEach) {
              // 检查是否有钩子选项
              const hooksOptions = (suite as any).hooksOptions as
                | TestOptions
                | undefined;
              // 创建模拟的 TestContext（Bun 环境下没有真实的 TestContext）
              const mockContext = createTestContext(fullName);
              // 应用钩子选项
              if (hooksOptions) {
                if (hooksOptions.sanitizeOps !== undefined) {
                  mockContext.sanitizeOps = hooksOptions.sanitizeOps;
                }
                if (hooksOptions.sanitizeResources !== undefined) {
                  mockContext.sanitizeResources =
                    hooksOptions.sanitizeResources;
                }
              }
              await suite.beforeEach(mockContext);
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
              // 执行 afterEach，传递 TestContext
              if (suite.afterEach) {
                // 检查是否有钩子选项
                const hooksOptions = (suite as any).hooksOptions as
                  | TestOptions
                  | undefined;
                // 创建模拟的 TestContext
                const mockContext = createTestContext(fullName);
                // 应用钩子选项
                if (hooksOptions) {
                  if (hooksOptions.sanitizeOps !== undefined) {
                    mockContext.sanitizeOps = hooksOptions.sanitizeOps;
                  }
                  if (hooksOptions.sanitizeResources !== undefined) {
                    mockContext.sanitizeResources =
                      hooksOptions.sanitizeResources;
                  }
                }
                await suite.afterEach(mockContext);
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
    } else {
      // 不在 describe 块内（可能在测试执行期间），在 Bun 中这是不允许的
      // 抛出友好的错误提示
      throw new Error(
        `在 Bun 环境中，test() 必须在 describe() 执行期间调用，不能在测试执行期间调用。` +
          `请将 test("${name}", ...) 移到 describe() 块内，而不是在 it() 或 test() 回调中调用。` +
          `\n提示：testEach() 和 bench() 应该在 describe() 执行期间调用，而不是在 it() 回调中。`,
      );
    }
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
