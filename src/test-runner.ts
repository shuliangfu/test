/**
 * 测试运行器
 * 提供 describe, test, it 等测试组织函数
 * 兼容 Deno 和 Bun 环境
 */

import { addSignalListener, IS_BUN, IS_DENO } from "@dreamer/runtime-adapter";
import type { BrowserContext } from "./browser/browser-context.ts";
import { createBrowserContext } from "./browser/browser-context.ts";
import { buildClientBundle } from "./browser/bundle.ts";
import { createTestPage } from "./browser/page.ts";
import { logger } from "./logger.ts";
import { _clearCurrentHooks } from "./test-utils.ts";
import type {
  BrowserTestConfig,
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

let currentSuite = rootSuite;

/**
 * 套件级别的浏览器实例缓存
 * key: 套件路径
 * value: 浏览器上下文
 */
const suiteBrowserCache = new Map<string, BrowserContext>();

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
 * 收集所有父套件的钩子（从根到当前套件）
 * @param suite 当前套件
 * @returns 所有父套件的数组（从根到当前套件）
 */
function collectParentSuites(suite: TestSuite): TestSuite[] {
  const suites: TestSuite[] = [];
  let current: TestSuite | undefined = suite;
  while (current && current !== rootSuite) {
    suites.unshift(current); // 从根到当前套件的顺序
    current = current.parent;
  }
  return suites;
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
 * 检查测试选项是否启用了浏览器测试
 */
function hasBrowserTest(options?: TestOptions): boolean {
  return options?.browser?.enabled === true;
}

/**
 * 获取浏览器测试配置（从测试选项或套件选项继承）
 */
function getBrowserConfig(
  testOptions: TestOptions | undefined,
  suiteOptions: DescribeOptions | undefined,
): BrowserTestConfig | undefined {
  // 优先使用测试选项中的配置
  if (testOptions?.browser) {
    return testOptions.browser;
  }
  // 其次使用套件选项中的配置
  if (suiteOptions?.browser) {
    return suiteOptions.browser;
  }
  return undefined;
}

/**
 * 在测试执行前设置浏览器上下文
 */
async function setupBrowserTest(
  config: BrowserTestConfig,
  testContext: TestContext,
  suitePath?: string,
): Promise<void> {
  // 如果配置了共享浏览器实例，尝试从缓存获取
  let browserCtx: BrowserContext | undefined;
  const shouldReuse = config.reuseBrowser !== false && suitePath;

  if (shouldReuse && suitePath) {
    browserCtx = suiteBrowserCache.get(suitePath);
  }

  // 如果缓存中没有或不应该复用，创建新的浏览器实例
  if (!browserCtx) {
    try {
      browserCtx = await createBrowserContext(config);

      // 无论是否复用，都保存到缓存，以便在所有测试完成后统一清理
      if (suitePath) {
        suiteBrowserCache.set(suitePath, browserCtx);
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `创建浏览器上下文失败: ${errorMessage}。` +
          `请检查 Chrome 是否已安装，或设置 executablePath 配置。`,
      );
    }
  } else {
    // 复用浏览器实例时，创建新页面
    const newPage = await browserCtx.browser.newPage();
    browserCtx.page = newPage;

    // 如果配置了 entryPoint，需要重新加载
    if (config.entryPoint) {
      try {
        const bundle = await buildClientBundle({
          entryPoint: config.entryPoint,
          globalName: config.globalName,
        });

        const htmlPath = await createTestPage({
          bundleCode: bundle,
          bodyContent: config.bodyContent,
          template: config.htmlTemplate,
        });

        browserCtx.htmlPath = htmlPath;

        await newPage.goto(`file://${htmlPath}`, {
          waitUntil: "networkidle0",
        });

        const moduleLoadTimeout = config.moduleLoadTimeout || 10000;
        const globalName = config.globalName;
        if (globalName) {
          await newPage.waitForFunction(
            (name: string) => {
              return typeof (window as any)[name] !== "undefined" &&
                (window as any).testReady === true;
            },
            { timeout: moduleLoadTimeout },
            globalName,
          ).catch(() => {
            return newPage.waitForFunction(
              (name: string) => typeof (window as any)[name] !== "undefined",
              { timeout: 2000 },
              globalName,
            );
          });
        } else {
          await newPage.waitForFunction(
            () => (window as any).testReady === true,
            { timeout: moduleLoadTimeout },
          );
        }
      } catch (error) {
        // 如果加载失败，关闭页面并抛出错误
        await newPage.close().catch(() => {});
        throw error;
      }
    }
  }

  // 将浏览器上下文添加到 TestContext
  (testContext as any).browser = {
    browser: browserCtx.browser,
    page: browserCtx.page,
    evaluate: browserCtx.evaluate.bind(browserCtx),
    goto: browserCtx.goto.bind(browserCtx),
    waitFor: browserCtx.waitFor.bind(browserCtx),
  };

  // 保存浏览器上下文以便清理
  (testContext as any)._browserContext = browserCtx;
  (testContext as any)._shouldReuseBrowser = shouldReuse;

  // 浏览器测试需要禁用资源清理检查
  testContext.sanitizeOps = false;
  testContext.sanitizeResources = false;
}

/**
 * 在测试执行后清理浏览器上下文
 * 注意：为了确保所有测试完成后才关闭浏览器，即使 reuseBrowser=false，
 * 也只在测试完成后关闭页面，浏览器实例保留在缓存中，等待所有测试完成后统一清理
 */
async function cleanupBrowserTest(testContext: TestContext): Promise<void> {
  const browserCtx = (testContext as any)._browserContext as
    | BrowserContext
    | undefined;

  if (browserCtx) {
    // 无论是否复用，都只关闭页面，不关闭浏览器
    // 浏览器实例保留在缓存中，等待所有测试完成后统一清理
    try {
      await browserCtx.page.close();
    } catch {
      // 忽略关闭错误
    }

    (testContext as any).browser = undefined;
    (testContext as any)._browserContext = undefined;
    (testContext as any)._shouldReuseBrowser = undefined;
  }
}

/**
 * 清理套件级别的浏览器缓存
 * @param suitePath 套件路径
 */
export function cleanupSuiteBrowser(suitePath: string): Promise<void> {
  const browserCtx = suiteBrowserCache.get(suitePath);
  if (browserCtx) {
    suiteBrowserCache.delete(suitePath);
    return browserCtx.close();
  }
  return Promise.resolve();
}

/**
 * 清理所有浏览器实例
 * 在所有测试完成后调用，确保所有浏览器实例都被关闭
 */
export async function cleanupAllBrowsers(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  for (const [suitePath, browserCtx] of suiteBrowserCache.entries()) {
    suiteBrowserCache.delete(suitePath);
    closePromises.push(
      browserCtx.close().catch(() => {
        // 忽略关闭错误
      }),
    );
  }
  await Promise.all(closePromises);
}

// 使用 runtime-adapter 提供的 API 注册进程退出时的清理钩子
// 确保在所有测试完成后清理浏览器
try {
  const handleAsyncCleanup = async () => {
    await cleanupAllBrowsers();
  };
  addSignalListener("SIGINT", handleAsyncCleanup);
  addSignalListener("SIGTERM", handleAsyncCleanup);
} catch {
  // 忽略信号监听错误（可能在某些环境下不支持）
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
 * 定义测试套件
 * @param name 套件名称
 * @param fn 套件函数
 * @param options 可选配置项
 */
export function describe(
  name: string,
  fn: () => void | Promise<void>,
  options?: DescribeOptions,
): void {
  // 确保 fn 是函数
  if (typeof fn !== "function") {
    throw new Error(
      `describe: 第二个参数必须是函数，但得到: ${typeof fn}。请使用 describe(name, fn, options?) 形式。`,
    );
  }

  const suite: TestSuite = {
    name,
    fn: fn,
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

  if (IS_BUN) describeDepth++;

  try {
    fn();
  } finally {
    const savedAfterAll = suite.afterAll;
    const parentAfterAll = suite.parent?.afterAll;
    currentSuite = suiteStack.pop() || rootSuite;
    if (IS_BUN) describeDepth--;

    // 清空当前钩子，避免钩子被错误继承到其他套件
    _clearCurrentHooks();

    // 如果有 afterAll 钩子，且这个套件定义了自己的 afterAll（不是从父套件继承的），
    // 注册一个特殊的测试用例来执行它
    // 这个测试用例会在所有其他测试完成后执行
    if (savedAfterAll && savedAfterAll !== parentAfterAll) {
      const suiteFullName = getFullSuiteName(suite);
      const afterAllTestName = `${suiteFullName} (afterAll)`;

      if (IS_DENO) {
        // Deno 环境：注册一个特殊的测试用例来执行 afterAll
        (globalThis as any).Deno.test({
          name: afterAllTestName,
          ignore: false,
          parallel: false,
          sanitizeOps: false, // 禁用操作清理检查，因为 afterAll 需要清理之前测试创建的资源
          sanitizeResources: false, // 禁用资源清理检查，因为 afterAll 需要清理之前测试创建的资源
          fn: async () => {
            try {
              await savedAfterAll();
            } catch (error) {
              logger.error(`执行 afterAll 钩子时出错: ${error}`);
              throw error;
            }
          },
        });
      } else if (IS_BUN) {
        // Bun 环境：注册一个特殊的测试用例来执行 afterAll
        (async () => {
          const bunTest = await getBunTest();
          if (bunTest) {
            bunTest(afterAllTestName, async () => {
              try {
                await savedAfterAll();
              } catch (error) {
                logger.error(`执行 afterAll 钩子时出错: ${error}`);
                throw error;
              }
            });
          }
        })();
      }
    }
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
  options?: TestOptions,
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

        // 收集所有父套件（从根到当前套件）
        const allSuites = collectParentSuites(suite);

        // 执行所有父套件的 beforeAll（只执行一次，通过检查标志）
        for (const parentSuite of allSuites) {
          if (parentSuite.beforeAll) {
            // 检查标志，确保只执行一次
            // 使用严格相等检查，避免 undefined 或 false 被误判
            const hasExecuted = (parentSuite as any)._beforeAllExecuted === true;
            // 添加调试：检查套件对象和标志
            if (!hasExecuted) {
              await parentSuite.beforeAll();
              // 直接设置属性，确保标志被正确设置
              (parentSuite as any)._beforeAllExecuted = true;
              // 验证标志是否设置成功
              if ((parentSuite as any)._beforeAllExecuted !== true) {
                logger.warn(
                  `警告：beforeAll 标志设置失败，套件: ${parentSuite.name}`,
                );
              }
            }
          }
        }

        // 执行所有父套件的 beforeEach（从根到当前套件）
        // 如果 beforeEach 有选项，应用 sanitizeOps 和 sanitizeResources
        for (const parentSuite of allSuites) {
          if (parentSuite.beforeEach) {
            // 检查是否有钩子选项（通过检查 TestHooks 的 options）
            const hooksOptions = (parentSuite as any).hooksOptions as
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
            await parentSuite.beforeEach(beforeEachContext);
          }
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

        // 检查是否启用浏览器测试
        let browserCtx: BrowserContext | undefined;
        let browserSetupError: Error | undefined;
        if (hasBrowserTest(options)) {
          const browserConfig = getBrowserConfig(options, suite.options);
          if (browserConfig && browserConfig.enabled) {
            const suitePath = getFullSuiteName(suite);
            try {
              await setupBrowserTest(browserConfig, testContext, suitePath);
              browserCtx = (testContext as any)._browserContext;
              // 同步 sanitize 选项到 Deno.TestContext
              t.sanitizeOps = false;
              t.sanitizeResources = false;
            } catch (error) {
              // 捕获浏览器设置错误，将其保存到测试上下文中
              browserSetupError = error instanceof Error
                ? error
                : new Error(String(error));
              // 将错误信息保存到测试上下文，以便测试函数可以访问
              (testContext as any)._browserSetupError = browserSetupError;
            }
          }
        }

        try {
          // 执行测试函数，如果函数内部修改了 sanitizeOps 或 sanitizeResources，
          // 需要同步到 Deno.TestContext
          // 如果有浏览器设置错误，将其保存到测试上下文，让测试函数决定如何处理
          // 测试函数可以通过 testContext._browserSetupError 访问错误信息
          await fn(testContext);
          // 同步测试上下文中的 sanitize 选项到 Deno.TestContext
          if (testContext.sanitizeOps !== undefined) {
            t.sanitizeOps = testContext.sanitizeOps;
          }
          if (testContext.sanitizeResources !== undefined) {
            t.sanitizeResources = testContext.sanitizeResources;
          }
        } finally {
          // 清理浏览器上下文
          if (browserCtx) {
            await cleanupBrowserTest(testContext);
          }
          // 执行所有父套件的 afterEach（从当前套件到根套件，与 beforeEach 顺序相反）
          // 如果 afterEach 有选项，应用 sanitizeOps 和 sanitizeResources
          for (let i = allSuites.length - 1; i >= 0; i--) {
            const parentSuite = allSuites[i];
            if (parentSuite.afterEach) {
              // 检查是否有钩子选项（通过检查 TestHooks 的 options）
              const hooksOptions = (parentSuite as any).hooksOptions as
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
              await parentSuite.afterEach(afterEachContext);
            }
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
            // 收集所有父套件（从根到当前套件）
            const allSuites = collectParentSuites(suite);

            // 执行所有父套件的 beforeAll（只执行一次，通过检查标志）
            for (const parentSuite of allSuites) {
              if (parentSuite.beforeAll) {
                // 检查标志，确保只执行一次
                // 使用严格相等检查，避免 undefined 或 false 被误判
                const hasExecuted = (parentSuite as any)._beforeAllExecuted === true;
                if (!hasExecuted) {
                  await parentSuite.beforeAll();
                  // 直接设置属性，确保标志被正确设置
                  (parentSuite as any)._beforeAllExecuted = true;
                }
              }
            }

            // 执行所有父套件的 beforeEach（从根到当前套件）
            // Bun 环境下需要创建模拟的 TestContext
            for (const parentSuite of allSuites) {
              if (parentSuite.beforeEach) {
                // 检查是否有钩子选项
                const hooksOptions = (parentSuite as any).hooksOptions as
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
                await parentSuite.beforeEach(mockContext);
              }
            }

            const testContext = createTestContext(fullName);
            // 应用套件选项
            if (suite.options) {
              if (suite.options.sanitizeOps !== undefined) {
                testContext.sanitizeOps = suite.options.sanitizeOps;
              }
              if (suite.options.sanitizeResources !== undefined) {
                testContext.sanitizeResources = suite.options.sanitizeResources;
              }
            }

            // 检查是否启用浏览器测试
            let browserCtx: BrowserContext | undefined;
            let browserSetupError: Error | undefined;
            if (hasBrowserTest(options)) {
              const browserConfig = getBrowserConfig(options, suite.options);
              if (browserConfig && browserConfig.enabled) {
                const suitePath = getFullSuiteName(suite);
                try {
                  await setupBrowserTest(browserConfig, testContext, suitePath);
                  browserCtx = (testContext as any)._browserContext;
                  // 浏览器测试需要禁用资源清理检查
                  testContext.sanitizeOps = false;
                  testContext.sanitizeResources = false;
                } catch (error) {
                  // 捕获浏览器设置错误，将其保存到测试上下文中
                  browserSetupError = error instanceof Error
                    ? error
                    : new Error(String(error));
                  // 将错误信息保存到测试上下文，以便测试函数可以访问
                  (testContext as any)._browserSetupError = browserSetupError;
                }
              }
            }

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
              // 清理浏览器上下文
              if (browserCtx) {
                await cleanupBrowserTest(testContext);
              }
              // 执行所有父套件的 afterEach（从当前套件到根套件，与 beforeEach 顺序相反）
              for (let i = allSuites.length - 1; i >= 0; i--) {
                const parentSuite = allSuites[i];
                if (parentSuite.afterEach) {
                  // 检查是否有钩子选项
                  const hooksOptions = (parentSuite as any).hooksOptions as
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
                  await parentSuite.afterEach(mockContext);
                }
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
 * 获取完整的套件路径
 */
function getFullSuiteName(suite: TestSuite): string {
  const path: string[] = [];
  let current: TestSuite | null = suite;
  while (current && current !== rootSuite) {
    path.unshift(current.name);
    current = current.parent || null;
  }
  return path.join(" > ");
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
 * @param name 测试名称
 * @param fn 测试函数（可以接受可选的测试上下文参数）
 * @param options 测试选项（可选）
 */
test.skip = function (
  name: string,
  fn: (t?: TestContext) => void | Promise<void>,
  options?: TestOptions,
): void {
  const testCase: TestCase = {
    name,
    fn,
    skip: true,
    timeout: options?.timeout,
    ...(options?.sanitizeOps !== undefined &&
      { sanitizeOps: options.sanitizeOps }),
    ...(options?.sanitizeResources !== undefined &&
      { sanitizeResources: options.sanitizeResources }),
  };
  currentSuite.tests.push(testCase);

  // 在 Deno 环境下，注册跳过测试
  if (IS_DENO) {
    const fullName = getFullTestName(name);
    const suite = currentSuite;
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
          step: t.step?.bind(t) || testContext.step,
        });

        // 检查是否启用浏览器测试（虽然测试被跳过，但配置应该被接受）
        let browserCtx: BrowserContext | undefined;
        if (hasBrowserTest(options)) {
          const browserConfig = getBrowserConfig(options, suite.options);
          if (browserConfig && browserConfig.enabled) {
            const suitePath = getFullSuiteName(suite);
            await setupBrowserTest(browserConfig, testContext, suitePath);
            browserCtx = (testContext as any)._browserContext;
            // 同步 sanitize 选项到 Deno.TestContext
            t.sanitizeOps = false;
            t.sanitizeResources = false;
          }
        }

        try {
          await fn(testContext);
        } finally {
          // 清理浏览器上下文
          if (browserCtx) {
            await cleanupBrowserTest(testContext);
          }
        }
      },
    });
  } else if (IS_BUN) {
    // Bun 环境下，注册跳过测试
    // Bun 的 test.skip() 使用函数参数形式：test.skip(name, fn, options?)
    const fullName = getFullTestName(name);
    (async () => {
      const bunTest = await getBunTest();
      if (bunTest && bunTest.skip) {
        bunTest.skip(fullName, async () => {
          // 跳过测试，使用 warn 级别（黄色）输出
          logger.warn(`⊘ ${fullName}`);
          const testContext = createTestContext(fullName);
          await fn(testContext);
        }, options);
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
  options?: TestOptions,
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
        const suite = currentSuite;
        const testContext = createTestContext(fullName);
        Object.assign(testContext, {
          origin: t.origin,
          sanitizeExit: t.sanitizeExit,
          sanitizeOps: t.sanitizeOps,
          sanitizeResources: t.sanitizeResources,
          step: t.step?.bind(t) || testContext.step,
        });

        // 检查是否启用浏览器测试
        let browserCtx: BrowserContext | undefined;
        if (hasBrowserTest(options)) {
          const browserConfig = getBrowserConfig(options, suite.options);
          if (browserConfig && browserConfig.enabled) {
            const suitePath = getFullSuiteName(suite);
            await setupBrowserTest(browserConfig, testContext, suitePath);
            browserCtx = (testContext as any)._browserContext;
            // 同步 sanitize 选项到 Deno.TestContext
            t.sanitizeOps = false;
            t.sanitizeResources = false;
          }
        }

        try {
          await fn(testContext);
        } finally {
          // 清理浏览器上下文
          if (browserCtx) {
            await cleanupBrowserTest(testContext);
          }
        }
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
          if (suite.beforeAll) {
            // 检查标志，确保只执行一次
            // 使用严格相等检查，避免 undefined 或 false 被误判
            const hasExecuted = (suite as any)._beforeAllExecuted === true;
            if (!hasExecuted) {
              await suite.beforeAll();
              // 直接设置属性，确保标志被正确设置
              (suite as any)._beforeAllExecuted = true;
            }
          }

          // 执行 beforeEach
          if (suite.beforeEach) {
            await suite.beforeEach();
          }

          const testContext = createTestContext(fullName);
          // 应用套件选项
          if (suite.options) {
            if (suite.options.sanitizeOps !== undefined) {
              testContext.sanitizeOps = suite.options.sanitizeOps;
            }
            if (suite.options.sanitizeResources !== undefined) {
              testContext.sanitizeResources = suite.options.sanitizeResources;
            }
          }

          // 检查是否启用浏览器测试
          let browserCtx: BrowserContext | undefined;
          if (hasBrowserTest(options)) {
            const browserConfig = getBrowserConfig(options, suite.options);
            if (browserConfig && browserConfig.enabled) {
              const suitePath = getFullSuiteName(suite);
              await setupBrowserTest(browserConfig, testContext, suitePath);
              browserCtx = (testContext as any)._browserContext;
              // 浏览器测试需要禁用资源清理检查
              testContext.sanitizeOps = false;
              testContext.sanitizeResources = false;
            }
          }

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
            // 清理浏览器上下文
            if (browserCtx) {
              await cleanupBrowserTest(testContext);
            }
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
