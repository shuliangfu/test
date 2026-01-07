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
let hasOnly = false;

/**
 * 测试统计信息
 */
interface TestStats {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

let testStats: TestStats = {
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
    const bunTest = await import("bun:test" as any);
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
 * 执行测试套件（支持 Deno TestContext 的 step API）
 */
async function runSuite(
  suite: TestSuite,
  prefix = "",
  denoTestContext?: any,
): Promise<void> {
  const fullName = prefix ? `${prefix} > ${suite.name}` : suite.name;

  // 执行 beforeAll
  if (suite.beforeAll) {
    await suite.beforeAll();
  }

  // 执行测试用例
  for (const testCase of suite.tests) {
    // 检查 only 标志
    if (hasOnly && !testCase.only) {
      continue;
    }

    // 跳过测试
    if (testCase.skip) {
      testStats.skipped++;
      testStats.total++;
      if (IS_DENO) {
        console.log(
          `%cSKIP %c${fullName} > ${testCase.name}`,
          "color: yellow",
          "color: gray",
        );
      } else {
        console.log(`SKIP ${fullName} > ${testCase.name}`);
      }
      continue;
    }

    testStats.total++;

    // 执行 beforeEach
    if (suite.beforeEach) {
      await suite.beforeEach();
    }

    const testName = `${fullName} > ${testCase.name}`;
    const testContext = createTestContext(testName);

    // 在 Deno 环境下，使用 t.step() 来确保测试被正确统计
    const executeTest = async () => {
      // 处理超时
      const timeout = testCase.timeout;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = timeout
        ? new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`测试超时: ${testName} (${timeout}ms)`));
          }, timeout);
        })
        : null;

      try {
        // 执行测试（支持超时）
        if (timeoutPromise) {
          await Promise.race([testCase.fn(testContext), timeoutPromise]);
        } else {
          await testCase.fn(testContext);
        }

        // 测试通过
        testStats.passed++;
        if (IS_DENO) {
          console.log(`%c✓ %c${testName}`, "color: green", "color: gray");
        } else {
          console.log(`✓ ${testName}`);
        }
      } catch (error) {
        // 测试失败
        testStats.failed++;
        if (IS_DENO) {
          console.error(`%c✗ %c${testName}`, "color: red", "color: gray");
        } else {
          console.error(`✗ ${testName}`);
        }
        console.error(error);
        // 不抛出错误，继续执行其他测试
        // throw error;
      } finally {
        // 清除超时定时器
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        // 执行 afterEach
        if (suite.afterEach) {
          await suite.afterEach();
        }
      }
    };

    // 在 Deno 环境下，使用 t.step() 来确保测试被正确统计
    if (
      IS_DENO && denoTestContext && typeof denoTestContext.step === "function"
    ) {
      await denoTestContext.step(testName, executeTest);
    } else {
      await executeTest();
    }
  }

  // 执行子套件
  for (const subSuite of suite.suites) {
    await runSuite(subSuite, fullName);
  }

  // 执行 afterAll
  if (suite.afterAll) {
    await suite.afterAll();
  }
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
  options?: { timeout?: number },
): void {
  const testCase: TestCase = {
    name,
    fn,
    timeout: options?.timeout,
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
          await fn(testContext);
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
  hasOnly = true;
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

/**
 * 运行所有测试
 * 在模块加载完成后自动执行
 */
async function runAllTests(): Promise<void> {
  // 重置统计信息
  testStats = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  };

  // 检查是否有 only 测试
  function checkOnly(suite: TestSuite): boolean {
    if (suite.tests.some((t) => t.only)) {
      return true;
    }
    return suite.suites.some(checkOnly);
  }

  hasOnly = checkOnly(rootSuite);

  // 运行所有测试套件
  // 注意：在 Deno 环境下，测试已经通过 Deno.test 注册，Deno 会自动执行
  // 这里只用于 Bun 和其他环境
  for (const suite of rootSuite.suites) {
    await runSuite(suite);
  }

  // 输出测试统计信息（只在有测试的情况下输出）
  // 注意：在 Deno 环境下，测试已经通过 Deno.test 注册，Deno 会自动输出统计
  // 所以我们不在这里输出，避免重复输出统计信息
  if (testStats.total > 0 && !IS_DENO) {
    // Bun 格式：24 pass, 0 fail
    console.log(
      `\n${testStats.passed} pass${
        testStats.failed > 0 ? `, ${testStats.failed} fail` : ""
      }${testStats.skipped > 0 ? `, ${testStats.skipped} skip` : ""}`,
    );
  }

  // 如果有失败的测试，以非零退出码退出
  if (testStats.failed > 0) {
    if (IS_DENO) {
      (globalThis as any).Deno.exit(1);
    } else if (IS_BUN) {
      // Bun 环境下使用全局 process
      (globalThis as any).process.exit(1);
    }
  }
}

if (IS_DENO) {
  // Deno 环境：测试已通过 Deno.test 注册，Deno 会自动执行
  // 不需要手动调用 runAllTests()
} else if (IS_BUN) {
  // 输出统计信息（Deno 格式：ok | X passed | Y failed）
  // 注意：只在有统计信息时输出
  if (testStats.total > 0) {
    const status = testStats.failed > 0 ? "fail" : "ok";
    const colorCode = testStats.failed > 0 ? "\x1b[31m" : "\x1b[32m";
    const resetCode = "\x1b[0m";
    // 在 Bun 的输出后添加我们的统计信息
    console.log(
      `${colorCode}${status}${resetCode} | ${testStats.passed} passed | ${testStats.failed} failed`,
    );
  }
} else {
  // 其他环境：手动执行测试
  (async () => {
    // 等待所有测试注册完成
    await new Promise((resolve) => setTimeout(resolve, 0));
    await runAllTests();
  })();
}
