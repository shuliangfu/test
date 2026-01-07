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
 * 执行测试套件
 */
async function runSuite(suite: TestSuite, prefix = ""): Promise<void> {
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

    // 执行 beforeEach
    if (suite.beforeEach) {
      await suite.beforeEach();
    }

    const testName = `${fullName} > ${testCase.name}`;
    const testContext = createTestContext(testName);

    try {
      // 执行测试
      await testCase.fn(testContext);

      // 测试通过
      if (IS_DENO) {
        console.log(`%c✓ %c${testName}`, "color: green", "color: gray");
      } else {
        console.log(`✓ ${testName}`);
      }
    } catch (error) {
      // 测试失败
      if (IS_DENO) {
        console.error(`%c✗ %c${testName}`, "color: red", "color: gray");
      } else {
        console.error(`✗ ${testName}`);
      }
      console.error(error);
      throw error;
    } finally {
      // 执行 afterEach
      if (suite.afterEach) {
        await suite.afterEach();
      }
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
): void {
  const testCase: TestCase = {
    name,
    fn,
  };
  currentSuite.tests.push(testCase);

  // 如果是在 Deno 或 Bun 环境下，立即注册测试
  if (IS_DENO) {
    // Deno 环境：使用 Deno.test 注册
    const fullName = getFullTestName(name);
    (globalThis as any).Deno.test(fullName, async (t: any) => {
      const testContext = createTestContext(fullName);
      // 将 Deno.TestContext 的属性复制到我们的 TestContext
      Object.assign(testContext, {
        origin: t.origin,
        sanitizeExit: t.sanitizeExit,
        sanitizeOps: t.sanitizeOps,
        sanitizeResources: t.sanitizeResources,
        step: t.step.bind(t),
      });
      await fn(testContext);
    });
  } else if (IS_BUN) {
    // Bun 环境：尝试使用全局 test 函数注册测试
    // 在 Bun 测试环境中，test 函数在测试文件的顶层作用域中可用
    // 但由于我们在库模块中，可能无法直接访问
    // 我们尝试多种方式获取 test 函数
    const fullName = getFullTestName(name);

    // 方式1：尝试从 bun:test 导入（如果可能）
    try {
      // 使用动态导入，但需要处理异步问题
      // 由于 test 函数需要同步调用，我们使用立即执行的异步函数
      (async () => {
        try {
          const testModule = await import("bun:test" as string);
          const bunTest = testModule.test || testModule.default?.test;
          if (typeof bunTest === "function") {
            bunTest(fullName, async () => {
              const testContext = createTestContext(fullName);
              await fn(testContext);
            });
          }
        } catch {
          // 导入失败，忽略
        }
      })();
    } catch {
      // 同步导入失败，忽略
    }

    // 方式2：尝试全局 test 函数（在某些情况下可能可用）
    const globalTest = (globalThis as any).test;
    if (typeof globalTest === "function") {
      globalTest(fullName, async () => {
        const testContext = createTestContext(fullName);
        await fn(testContext);
      });
    }
  }
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

  // 在 Deno 或 Bun 环境下注册跳过测试
  if (IS_DENO) {
    const fullName = getFullTestName(name);
    (globalThis as any).Deno.test({
      name: fullName,
      ignore: true,
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
    const fullName = getFullTestName(name);
    const bunTest = (globalThis as any).test;
    if (typeof bunTest === "function") {
      // Bun 使用 test.skip 来跳过测试
      if (typeof bunTest.skip === "function") {
        bunTest.skip(fullName, async () => {
          const testContext = createTestContext(fullName);
          await fn(testContext);
        });
      } else {
        // 如果没有 skip，使用 todo
        bunTest.todo?.(fullName, async () => {
          const testContext = createTestContext(fullName);
          await fn(testContext);
        });
      }
    }
  }
};

/**
 * 只运行此测试
 */
test.only = function (
  name: string,
  fn: (t?: TestContext) => void | Promise<void>,
): void {
  hasOnly = true;
  const testCase: TestCase = {
    name,
    fn,
    only: true,
  };
  currentSuite.tests.push(testCase);

  // 在 Deno 或 Bun 环境下注册 only 测试
  if (IS_DENO) {
    const fullName = getFullTestName(name);
    (globalThis as any).Deno.test({
      name: fullName,
      only: true,
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
    const fullName = getFullTestName(name);
    (globalThis as any).Bun.test.only(fullName, async () => {
      const testContext = createTestContext(fullName);
      await fn(testContext);
    });
  }
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
  // 检查是否有 only 测试
  function checkOnly(suite: TestSuite): boolean {
    if (suite.tests.some((t) => t.only)) {
      return true;
    }
    return suite.suites.some(checkOnly);
  }

  hasOnly = checkOnly(rootSuite);

  // 运行所有测试套件
  for (const suite of rootSuite.suites) {
    await runSuite(suite);
  }
}

// 在 Deno 环境下，测试已经通过 Deno.test 注册了，Deno 会自动执行
// 在 Bun 环境下，由于无法在库模块中注册测试，我们需要手动执行
// 在其他环境下也需要手动执行
if (typeof window === "undefined") {
  if (IS_DENO) {
    // Deno 环境：测试已通过 Deno.test 注册，Deno 会自动执行
    // 不需要手动调用 runAllTests()
  } else {
    // Bun 和其他环境：手动执行测试
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await runAllTests();
    })();
  }
}
