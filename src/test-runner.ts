/**
 * 测试运行器
 * 提供 describe, test, it 等测试组织函数
 * 兼容 Deno 和 Bun 环境
 */

import {
  addSignalListener,
  exit,
  IS_BUN,
  IS_DENO,
} from "@dreamer/runtime-adapter";
import type { BrowserContext } from "./browser/browser-context.ts";
import { $tr } from "./i18n.ts";
import { createBrowserContext } from "./browser/browser-context.ts";
import { buildClientBundle } from "./browser/bundle.ts";
import { createTestPage, DEFAULT_TEMPLATE_IIFE } from "./browser/page.ts";
import { clearPendingSuiteHooks, pendingSuiteHooks } from "./hooks-state.ts";
import { logger } from "./logger.ts";
import type {
  BrowserTestConfig,
  DescribeOptions,
  TestCase,
  TestContext,
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
 * 跟踪 beforeAll 钩子的执行状态
 * key: 套件的完整路径（用于唯一标识套件）
 * value: 是否已执行
 */
const beforeAllExecutedMap = new Map<string, boolean>();

/**
 * Bun 将 `afterAll` 注册为普通 `test()`，默认超时约 5s；含 Socket.IO / Playwright 关闭时
 * `kill(9)` + `cleanupAllBrowsers()` 易超过 5s，导致 `(afterAll)` 误报超时。
 * Deno 侧 `Deno.test` 同样传入，避免慢机/CI 上钩子超时。
 */
const AFTER_ALL_HOOK_TIMEOUT_MS = 60_000;

/**
 * Bun 环境下标记是否在 describe 块内（使用计数器支持嵌套）
 */
let describeDepth = 0;

/**
 * Bun 下是否已在首个顶层 describe 中注册 cleanup describe（避免 setTimeout 在 test 执行时触发导致 "Cannot call describe() inside a test"）
 */
let bunCleanupDescribeScheduled = false;

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
 * 将 `hooks-state` 草稿同步到当前套件（由 test-utils 的 `beforeAll` 等调用）。
 */
export function syncPendingHooksToCurrentSuite(): void {
  currentSuite.beforeAll = pendingSuiteHooks.beforeAll;
  currentSuite.afterAll = pendingSuiteHooks.afterAll;
  currentSuite.beforeEach = pendingSuiteHooks.beforeEach;
  currentSuite.afterEach = pendingSuiteHooks.afterEach;
  currentSuite.hooksOptions = pendingSuiteHooks.options;
}

/** 缓存 Bun test 函数，避免重复动态 import */
let cachedBunTest: Promise<any> | null = null;
/** 缓存 Bun describe/test 模块，用于在 describe 内注册 cleanup test，满足 Bun 要求「test() 必须在 describe() 内调用」 */
let cachedBunTestModule: Promise<{ test: any; describe: any } | null> | null =
  null;

/**
 * 获取 Bun 的 test 函数（结果缓存，仅首次解析 bun:test）
 */
async function getBunTest(): Promise<any> {
  if (!IS_BUN) {
    return null;
  }
  if (cachedBunTest !== null) {
    return await cachedBunTest;
  }
  cachedBunTest = (async () => {
    const mod = await getBunTestModule();
    return mod?.test ?? null;
  })();
  return cachedBunTest;
}

/**
 * 获取 Bun 的 describe 与 test（用于在 describe 内注册 cleanup，避免 "Cannot call test() inside a test"）
 */
async function getBunTestModule(): Promise<
  {
    test: any;
    describe: any;
  } | null
> {
  if (!IS_BUN) {
    return null;
  }
  if (cachedBunTestModule !== null) {
    return await cachedBunTestModule;
  }
  cachedBunTestModule = (async () => {
    try {
      // @ts-ignore: bun:test 是 Bun 特有的模块
      const mod = await import("bun:test" as string);
      return mod?.test && mod?.describe
        ? { test: mod.test, describe: mod.describe }
        : null;
    } catch {
      return null;
    }
  })();
  return cachedBunTestModule;
}

/**
 * 收集所有父套件的钩子（从根到当前套件）
 * 使用 push + reverse 避免 unshift 的 O(n) 每次导致整体 O(n²)
 * @param suite 当前套件
 * @returns 所有父套件的数组（从根到当前套件）
 */
function collectParentSuites(suite: TestSuite): TestSuite[] {
  const suites: TestSuite[] = [];
  let current: TestSuite | undefined = suite;
  while (current && current !== rootSuite) {
    suites.push(current);
    current = current.parent;
  }
  suites.reverse();
  return suites;
}

/**
 * 合并套件链上的 sanitize 选项（子级 `it` 的 options 优先）。
 */
function mergeInheritedSanitize(
  suite: TestSuite,
  options?: TestOptions,
): { sanitizeOps?: boolean; sanitizeResources?: boolean } {
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
  return {
    sanitizeOps: finalSanitizeOps,
    sanitizeResources: finalSanitizeResources,
  };
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
    /**
     * 无 Deno `TestContext.step` 时的降级：仍提供嵌套命名上下文，便于日志与调试。
     * Deno 下由运行器注入 `t.step.bind(t)`，与原生子步骤报告对齐。
     */
    async step<T>(
      stepName: string,
      fn: (t: TestContext) => Promise<T> | T,
    ): Promise<T> {
      return await fn(createTestContext(`${name} > ${stepName}`));
    },
  };
}

/**
 * 检查测试选项或套件选项是否启用了浏览器测试
 * 当 it() 未传 browser 配置时，会从 describe 的 suite.options 继承
 *
 * @param testOptions - 测试用例的第三个参数（it 的 options）
 * @param suiteOptions - 套件的 options（describe 的第三个参数）
 * @returns 是否启用浏览器测试
 */
function hasBrowserTest(
  testOptions?: TestOptions,
  suiteOptions?: DescribeOptions,
): boolean {
  return testOptions?.browser?.enabled === true ||
    suiteOptions?.browser?.enabled === true;
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
  /**
   * 仅打包、不启动 Playwright：适合 CI 快速验证 bundle；无 `testContext.browser`。
   */
  if (config.bundleOnly === true && config.entryPoint) {
    const bundle = await buildClientBundle({
      entryPoint: config.entryPoint,
      globalName: config.globalName,
      browserMode: config.browserMode,
    });
    testContext.browserBundle = {
      code: bundle,
      entryPoint: config.entryPoint,
    };
    return;
  }

  // 如果配置了共享浏览器实例，尝试从缓存获取
  // 缓存键必须使用完整 getFullSuiteName(suite)：若仅用 split(" > ")[0]，Bun 顺序加载多文件时套件链可能被串成
  // 「A > B」，B 与 A 会共用同一 Playwright 实例键，造成跨示例污染、goto 挂死直至外层超时，并触发 killed dangling processes。
  // 同一 describe 内各 it 的 suite 相同，完整路径仍一致，故套件内复用浏览器的行为不变。
  // executablePath 场景仍用完整 suitePath，避免与默认 Chromium 路径的用例错误复用。
  let browserCtx: BrowserContext | undefined;
  const shouldReuse = config.reuseBrowser !== false && Boolean(suitePath);
  const cacheKey = suitePath;

  if (cacheKey) {
    browserCtx = suiteBrowserCache.get(cacheKey);
  }

  // 如果缓存中没有或不应该复用，创建新的浏览器实例
  if (!browserCtx) {
    try {
      browserCtx = await createBrowserContext(config);

      // 无论是否复用，都保存到缓存，以便在所有测试完成后统一清理
      if (cacheKey) {
        suiteBrowserCache.set(cacheKey, browserCtx);
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        $tr("runner.browserContextFailed", { message: errorMessage }),
      );
    }
  } else {
    // 复用浏览器实例时，创建新页面
    const newPage = await browserCtx.browser.newPage();
    browserCtx.page = newPage;

    // 如果配置了 entryPoint，需要重新加载（browserMode 透传给 build，入口含 JSR 时传 false）
    if (config.entryPoint) {
      try {
        const bundle = await buildClientBundle({
          entryPoint: config.entryPoint,
          globalName: config.globalName,
          browserMode: config.browserMode,
        });

        const template = config.htmlTemplate ??
          (config.browserMode === false ? DEFAULT_TEMPLATE_IIFE : undefined);
        const htmlPath = await createTestPage({
          bundleCode: bundle,
          bodyContent: config.bodyContent,
          template,
        });

        browserCtx.htmlPath = htmlPath;

        // 在页面加载前设置错误监听器，以便捕获所有运行时错误
        const consoleErrors: string[] = [];
        newPage.on("console", (msg: any) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text());
          }
        });
        newPage.on("pageerror", (error: any) => {
          consoleErrors.push(error.message);
        });

        // 加载页面，捕获加载错误
        // 使用 domcontentloaded：DOM 就绪即触发、内联脚本已执行，比 load 更早且对 file:// 更稳定
        const loadTimeout = config.moduleLoadTimeout
          ? config.moduleLoadTimeout + 10_000
          : 60_000;
        let diagRightAfterGoto:
          | { hasGlobal?: boolean; hasTestReady?: boolean }
          | { error: string } = {};
        try {
          const response = await newPage.goto(`file://${htmlPath}`, {
            waitUntil: "domcontentloaded",
            timeout: loadTimeout,
          });
          // goto 后立即检查：若已就绪则跳过 waitForFunction，避免复用路径下 waitForFunction 不返回的 Playwright 行为
          diagRightAfterGoto = await newPage.evaluate((name: string) => ({
            hasGlobal: typeof (window as any)[name] !== "undefined",
            hasTestReady: (window as any).testReady === true,
          }), config.globalName!).catch((e: unknown) => ({ error: String(e) }));

          // 检查页面加载是否成功
          if (!response || !response.ok()) {
            const status = response?.status() || "unknown";
            throw new Error(
              $tr("runner.pageLoadFailedStatus", {
                status: String(status),
                htmlPath,
              }),
            );
          }

          // 验证页面 URL 是否正确
          const actualUrl = newPage.url();
          if (!actualUrl.startsWith("file://")) {
            throw new Error(
              $tr("runner.pageUrlIncorrect", {
                url: actualUrl,
                htmlPath,
              }),
            );
          }
        } catch (error) {
          // 如果页面加载失败，关闭页面并抛出错误
          await newPage.close().catch(() => {});
          const errorMessage = error instanceof Error
            ? error.message
            : String(error);
          const errorDetails = consoleErrors.length > 0
            ? `\nBrowser console errors: ${consoleErrors.join("\n")}`
            : "";
          throw new Error(
            $tr("runner.pageLoadFailed", {
              message: errorMessage,
              htmlPath,
              details: errorDetails,
            }),
          );
        }

        const moduleLoadTimeout = config.moduleLoadTimeout || 10000;
        const globalName = config.globalName;
        if (globalName) {
          const alreadyReady = typeof diagRightAfterGoto === "object" &&
            !("error" in diagRightAfterGoto) &&
            diagRightAfterGoto.hasGlobal === true &&
            diagRightAfterGoto.hasTestReady === true;
          if (!alreadyReady) {
            // 等待全局变量存在且 testReady 标记已设置
            try {
              await newPage.waitForFunction(
                (name: string) => {
                  return typeof (window as any)[name] !== "undefined" &&
                    (window as any).testReady === true;
                },
                { timeout: moduleLoadTimeout },
                globalName,
              );
            } catch (_error) {
              try {
                await newPage.waitForFunction(
                  (name: string) =>
                    typeof (window as any)[name] !== "undefined",
                  { timeout: 2000 },
                  globalName,
                );
              } catch (_retryError) {
                const errorDetails = consoleErrors.length > 0
                  ? `\nBrowser console errors: ${consoleErrors.join("\n")}`
                  : "";
                throw new Error(
                  $tr("runner.moduleLoadTimeout", {
                    globalName: globalName!,
                    entry: config.entryPoint!,
                    details: errorDetails,
                  }),
                );
              }
            }
          }
        } else {
          // 如果没有 globalName，只等待 testReady 标记
          try {
            await newPage.waitForFunction(
              () => (window as any).testReady === true,
              { timeout: moduleLoadTimeout },
            );
          } catch (_error) {
            const errorDetails = consoleErrors.length > 0
              ? `\nBrowser console errors: ${consoleErrors.join("\n")}`
              : "";
            throw new Error(
              $tr("runner.moduleLoadTimeoutTestReady", {
                entry: config.entryPoint!,
                details: errorDetails,
              }),
            );
          }
        }
      } catch (error) {
        // 如果加载失败，关闭页面并抛出错误
        await newPage.close().catch(() => {});
        throw error;
      }
    }
  }

  // 将浏览器上下文添加到 TestContext
  (testContext as TestContext & { _browserContext?: BrowserContext }).browser =
    {
      browser: browserCtx.browser,
      page: browserCtx.page,
      evaluate: browserCtx.evaluate.bind(browserCtx),
      goto: browserCtx.goto.bind(browserCtx),
      waitFor: browserCtx.waitFor.bind(browserCtx),
    };

  // 保存浏览器上下文以便清理（内部字段，不列入公开 API）
  (testContext as TestContext & { _browserContext?: BrowserContext })
    ._browserContext = browserCtx;
  (testContext as TestContext & { _shouldReuseBrowser?: boolean })
    ._shouldReuseBrowser = shouldReuse;

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
  const browserCtx =
    (testContext as TestContext & { _browserContext?: BrowserContext })
      ._browserContext;

  if (browserCtx) {
    // 无论是否复用，都只关闭页面，不关闭浏览器
    // 浏览器实例保留在缓存中，等待所有测试完成后统一清理
    try {
      await browserCtx.page.close();
    } catch {
      // 忽略关闭错误
    }

    (testContext as TestContext & { _browserContext?: BrowserContext })
      .browser = undefined;
    (testContext as TestContext & { _browserContext?: BrowserContext })
      ._browserContext = undefined;
    (testContext as TestContext & { _shouldReuseBrowser?: boolean })
      ._shouldReuseBrowser = undefined;
  }
}

/**
 * 清理套件级别的浏览器缓存
 * @param suitePath 套件路径（应与 setup 时 getFullSuiteName 一致；完整路径未命中时再尝试根 describe 名以兼容旧调用）
 */
export function cleanupSuiteBrowser(suitePath: string): Promise<void> {
  const rootKey = suitePath.split(" > ")[0];
  /** 主键为完整套件路径；根名仅作兼容查找 */
  const browserCtx = suiteBrowserCache.get(suitePath) ??
    suiteBrowserCache.get(rootKey);
  if (browserCtx) {
    const key = suiteBrowserCache.has(suitePath) ? suitePath : rootKey;
    suiteBrowserCache.delete(key);
    return browserCtx.close();
  }
  return Promise.resolve();
}

/**
 * 清理所有浏览器实例
 * 在所有测试完成后调用，确保所有浏览器实例都被关闭。
 * 同时清空 beforeAll 执行标记，避免 watch/重复运行下 Map 无限增长。
 */
export async function cleanupAllBrowsers(): Promise<void> {
  beforeAllExecutedMap.clear();
  const closePromises: Promise<void>[] = [];
  for (const [suitePath, browserCtx] of suiteBrowserCache.entries()) {
    suiteBrowserCache.delete(suitePath);
    closePromises.push(
      browserCtx.close().catch((err) => {
        logger.error($tr("runner.cleanupSuiteBrowserFailed", {
          suitePath,
          err: String(err),
        }));
      }),
    );
  }
  await Promise.all(closePromises);
}

// 使用 runtime-adapter 注册 SIGINT/SIGTERM：关闭所有浏览器后退出，与 browser-context 的 activeBrowsers 清理互补
// 手动终止进程（Ctrl+C）时确保关闭打开的浏览器
try {
  const handleSignalCleanup = () => {
    void cleanupAllBrowsers().then(() => {
      exit(130); // 130 = 被 SIGINT 终止
    });
  };
  addSignalListener("SIGINT", handleSignalCleanup);
  addSignalListener("SIGTERM", handleSignalCleanup);
} catch {
  // 忽略信号监听错误（可能在某些环境下不支持）
}

/**
 * 注册 Deno 下「最终清理」用例：关闭所有套件浏览器。
 *
 * 禁止再用 `setTimeout(0)` / `queueMicrotask` 延迟调用 `Deno.test`：Deno 2.x 不允许
 * 在**任意正在执行的 test 回调**期间再注册新用例，定时器偶发落在用例执行窗口内会报
 * `Nested Deno.test() calls are not supported`（表现为某随机测试文件 uncaught error）。
 *
 * 在 **test-runner 模块首次求值**时同步注册即可；`globalThis` 守卫保证 HMR/重复加载不重复注册。
 */
const DENO_CLEANUP_TEST_FLAG = Symbol.for(
  "@dreamer/test:denoCleanupTestRegistered",
);
const registerFinalCleanupTestSync = (): void => {
  if (!IS_DENO) return;
  const g = globalThis as Record<string | symbol, unknown>;
  if (g[DENO_CLEANUP_TEST_FLAG]) return;
  const DenoRef = (globalThis as any).Deno;
  if (!DenoRef?.test) return;
  g[DENO_CLEANUP_TEST_FLAG] = true;
  DenoRef.test({
    name: "\uFFFF@dreamer/test cleanup browsers",
    fn: async () => {
      await cleanupAllBrowsers();
    },
    ignore: false,
    sanitizeOps: false,
    sanitizeResources: false,
  });
};
registerFinalCleanupTestSync();

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
      $tr("runner.describeSecondArgMustBeFunction", { type: typeof fn }),
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
    // Bun：在首个顶层 describe 中先注册 cleanup describe 再执行用户 fn，避免 setTimeout 在 test 执行时触发导致 "Cannot call describe() inside a test"（Windows CI）
    if (
      IS_BUN &&
      describeDepth === 1 &&
      !bunCleanupDescribeScheduled
    ) {
      bunCleanupDescribeScheduled = true;
      const parentSuite = currentSuite.parent ?? rootSuite;
      void getBunTestModule().then((mod) => {
        if (mod?.describe && mod?.test) {
          mod.describe("\uFFFF@dreamer/test cleanup", () => {
            mod.test("\uFFFF@dreamer/test cleanup browsers", async () => {
              await cleanupAllBrowsers();
            });
          });
        }
        // 恢复当前 describe 上下文，再执行用户 fn，使内部 describe/test 挂到正确 suite
        suiteStack.push(parentSuite);
        currentSuite = suite;
        if (IS_BUN) describeDepth = 1;
        try {
          fn();
        } finally {
          // 与同步路径中 try/finally 一致：fn 结束后必须 pop，否则 currentSuite 永远留在本套件，
          // 后续**其它测试文件** load 时下一个顶层 describe 的 parent 会错挂到本套件下（Bun 多文件表现为
          // 「preact-hybrid-flat > react-ssg-advanced」），beforeAll/端口/浏览器全乱并 60s 超时。
          currentSuite = suiteStack.pop() || rootSuite;
          if (IS_BUN) describeDepth--;
        }
      });
      return;
    }
    fn();
  } finally {
    const savedAfterAll = suite.afterAll;
    const parentAfterAll = suite.parent?.afterAll;
    currentSuite = suiteStack.pop() || rootSuite;
    if (IS_BUN) describeDepth--;

    // 清空当前钩子，避免钩子被错误继承到其他套件
    clearPendingSuiteHooks();

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
          timeout: AFTER_ALL_HOOK_TIMEOUT_MS,
          sanitizeOps: false, // 禁用操作清理检查，因为 afterAll 需要清理之前测试创建的资源
          sanitizeResources: false, // 禁用资源清理检查，因为 afterAll 需要清理之前测试创建的资源
          fn: async () => {
            try {
              await savedAfterAll();
            } catch (error) {
              logger.error(
                $tr("runner.afterAllHookError", {
                  error: String(error),
                }),
              );
              throw error;
            }
          },
        });
      } else if (IS_BUN) {
        // Bun 环境：注册一个特殊的测试用例来执行 afterAll
        (async () => {
          const bunTest = await getBunTest();
          if (bunTest) {
            bunTest(
              afterAllTestName,
              async () => {
                try {
                  await savedAfterAll();
                } catch (error) {
                  logger.error(
                    $tr("runner.afterAllHookError", {
                      error: String(error),
                    }),
                  );
                  throw error;
                }
              },
              { timeout: AFTER_ALL_HOOK_TIMEOUT_MS },
            );
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
  // 注册时从调用栈解析测试文件路径，用于超时等错误信息（Bun 无 origin 时使用，Deno 作兜底）
  const testFilePath = getTestFilePathFromStack();

  // 在 Deno 环境下，直接注册测试，使用 parallel: false 确保顺序执行
  if (IS_DENO) {
    const fullName = getFullTestName(name);
    const suite = currentSuite;

    const {
      sanitizeOps: finalSanitizeOps,
      sanitizeResources: finalSanitizeResources,
    } = mergeInheritedSanitize(suite, options);

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

        // 执行所有父套件的 beforeAll（只执行一次，通过全局 Map 跟踪）
        // 注意：只执行定义了自己的 beforeAll 的套件，跳过继承的套件
        for (const parentSuite of allSuites) {
          if (parentSuite.beforeAll) {
            // 检查这个套件是否定义了自己的 beforeAll（不是从父套件继承的）
            const parentBeforeAll = parentSuite.parent?.beforeAll;
            const hasOwnBeforeAll = parentSuite.beforeAll !== parentBeforeAll;

            // 只执行定义了自己的 beforeAll 的套件
            if (hasOwnBeforeAll) {
              // 使用套件的完整路径作为唯一标识符
              const suiteKey = getFullSuiteName(parentSuite);
              // 检查全局 Map，确保只执行一次
              const hasExecuted = beforeAllExecutedMap.get(suiteKey) === true;
              if (!hasExecuted) {
                await parentSuite.beforeAll();
                // 在全局 Map 中标记为已执行
                beforeAllExecutedMap.set(suiteKey, true);
              }
            }
          }
        }

        // 执行所有父套件的 beforeEach（从根到当前套件）
        // 如果 beforeEach 有选项，应用 sanitizeOps 和 sanitizeResources
        for (const parentSuite of allSuites) {
          if (parentSuite.beforeEach) {
            // 检查是否有钩子选项（通过检查 TestHooks 的 options）
            const hooksOpts = parentSuite.hooksOptions;
            if (hooksOpts) {
              if (hooksOpts.sanitizeOps !== undefined) {
                t.sanitizeOps = hooksOpts.sanitizeOps;
              }
              if (hooksOpts.sanitizeResources !== undefined) {
                t.sanitizeResources = hooksOpts.sanitizeResources;
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

        // 检查是否启用浏览器测试（支持从 describe 的 suite.options 继承）
        let browserCtx: BrowserContext | undefined;
        let browserSetupError: Error | undefined;
        if (hasBrowserTest(options, suite.options)) {
          const browserConfig = getBrowserConfig(options, suite.options);
          if (browserConfig && browserConfig.enabled) {
            const suitePath = getFullSuiteName(suite);
            try {
              await setupBrowserTest(browserConfig, testContext, suitePath);
              browserCtx = (testContext as TestContext & {
                _browserContext?: BrowserContext;
              })
                ._browserContext;
              // 同步 sanitize 选项到 Deno.TestContext
              t.sanitizeOps = false;
              t.sanitizeResources = false;
            } catch (error) {
              browserSetupError = error instanceof Error
                ? error
                : new Error(String(error));
              testContext.browserSetupError = browserSetupError;
            }
          }
        }

        try {
          // 若浏览器初始化失败，按 onSetupError 决定：默认 'throw'；'pass' 则继续并由测试读取 browserSetupError
          const browserSetupErr = testContext.browserSetupError;
          if (browserSetupErr) {
            const cfg = getBrowserConfig(options, suite.options);
            if (cfg?.onSetupError !== "pass") {
              throw browserSetupErr;
            }
          }
          // 执行测试函数，如果函数内部修改了 sanitizeOps 或 sanitizeResources，
          // 需要同步到 Deno.TestContext
          // Deno 的 timeout 在异步/浏览器场景下不可靠，在运行器内用 Promise.race 强制到点失败
          try {
            if (options?.timeout) {
              let timeoutId: ReturnType<typeof setTimeout> | undefined;
              const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                  () => {
                    const filePart = t.origin
                      ? formatOriginToPath(t.origin)
                      : testFilePath;
                    const fileSuffix = filePart ? `\n  at ${filePart}` : "";
                    reject(
                      new Error(
                        `Test timeout: ${options.timeout}ms (test: ${fullName})${fileSuffix}`,
                      ),
                    );
                  },
                  options.timeout,
                );
              });
              try {
                await Promise.race([
                  Promise.resolve(fn(testContext)),
                  timeoutPromise,
                ]);
              } finally {
                if (timeoutId != null) clearTimeout(timeoutId);
              }
            } else {
              await fn(testContext);
            }
            // 同步测试上下文中的 sanitize 选项到 Deno.TestContext
            if (testContext.sanitizeOps !== undefined) {
              t.sanitizeOps = testContext.sanitizeOps;
            }
            if (testContext.sanitizeResources !== undefined) {
              t.sanitizeResources = testContext.sanitizeResources;
            }
          } catch (error) {
            const filePart = t.origin
              ? formatOriginToPath(t.origin)
              : testFilePath;
            augmentErrorWithFilePath(error, filePart);
            throw error;
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
              const hooksOpts = parentSuite.hooksOptions;
              if (hooksOpts) {
                if (hooksOpts.sanitizeOps !== undefined) {
                  t.sanitizeOps = hooksOpts.sanitizeOps;
                }
                if (hooksOpts.sanitizeResources !== undefined) {
                  t.sanitizeResources = hooksOpts.sanitizeResources;
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

            // 执行所有父套件的 beforeAll（只执行一次，通过全局 Map 跟踪）
            // 注意：只执行定义了自己的 beforeAll 的套件，跳过继承的套件
            for (const parentSuite of allSuites) {
              if (parentSuite.beforeAll) {
                // 检查这个套件是否定义了自己的 beforeAll（不是从父套件继承的）
                const parentBeforeAll = parentSuite.parent?.beforeAll;
                const hasOwnBeforeAll =
                  parentSuite.beforeAll !== parentBeforeAll;

                // 只执行定义了自己的 beforeAll 的套件
                if (hasOwnBeforeAll) {
                  // 使用套件的完整路径作为唯一标识符
                  const suiteKey = getFullSuiteName(parentSuite);
                  // 检查全局 Map，确保只执行一次
                  const hasExecuted =
                    beforeAllExecutedMap.get(suiteKey) === true;
                  if (!hasExecuted) {
                    await parentSuite.beforeAll();
                    // 在全局 Map 中标记为已执行
                    beforeAllExecutedMap.set(suiteKey, true);
                  }
                }
              }
            }

            // 执行所有父套件的 beforeEach（从根到当前套件）
            // Bun 环境下需要创建模拟的 TestContext
            for (const parentSuite of allSuites) {
              if (parentSuite.beforeEach) {
                const hooksOpts = parentSuite.hooksOptions;
                const mockContext = createTestContext(fullName);
                if (hooksOpts) {
                  if (hooksOpts.sanitizeOps !== undefined) {
                    mockContext.sanitizeOps = hooksOpts.sanitizeOps;
                  }
                  if (hooksOpts.sanitizeResources !== undefined) {
                    mockContext.sanitizeResources = hooksOpts.sanitizeResources;
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

            // 检查是否启用浏览器测试（支持从 describe 的 suite.options 继承）
            let browserCtx: BrowserContext | undefined;
            let browserSetupError: Error | undefined;
            if (hasBrowserTest(options, suite.options)) {
              const browserConfig = getBrowserConfig(options, suite.options);
              if (browserConfig && browserConfig.enabled) {
                const suitePath = getFullSuiteName(suite);
                try {
                  await setupBrowserTest(browserConfig, testContext, suitePath);
                  browserCtx = (testContext as TestContext & {
                    _browserContext?: BrowserContext;
                  })
                    ._browserContext;
                  // 浏览器测试需要禁用资源清理检查
                  testContext.sanitizeOps = false;
                  testContext.sanitizeResources = false;
                } catch (error) {
                  browserSetupError = error instanceof Error
                    ? error
                    : new Error(String(error));
                  testContext.browserSetupError = browserSetupError;
                }
              }
            }

            try {
              const browserSetupErr = testContext.browserSetupError;
              if (browserSetupErr) {
                const cfg = getBrowserConfig(options, suite.options);
                if (cfg?.onSetupError !== "pass") {
                  throw browserSetupErr;
                }
              }
              // 与 Deno 一致：在运行器内用 Promise.race 强制超时，避免运行时不可靠
              if (options?.timeout) {
                let timeoutId: ReturnType<typeof setTimeout> | undefined;
                const timeoutPromise = new Promise<never>((_, reject) => {
                  timeoutId = setTimeout(
                    () => {
                      const fileSuffix = testFilePath
                        ? `\n  at ${testFilePath}`
                        : "";
                      reject(
                        new Error(
                          `Test timeout: ${options.timeout}ms (test: ${fullName})${fileSuffix}`,
                        ),
                      );
                    },
                    options.timeout,
                  );
                });
                try {
                  await Promise.race([
                    Promise.resolve(fn(testContext)),
                    timeoutPromise,
                  ]);
                } finally {
                  if (timeoutId != null) clearTimeout(timeoutId);
                }
              } else {
                await fn(testContext);
              }
              // 测试通过，统计数量
              testStats.passed++;
              testStats.total++;
            } catch (error) {
              // 测试失败，统计数量，并在错误信息中追加测试文件路径
              testStats.failed++;
              testStats.total++;
              augmentErrorWithFilePath(error, testFilePath);
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
                  const hooksOpts = parentSuite.hooksOptions;
                  const mockContext = createTestContext(fullName);
                  if (hooksOpts) {
                    if (hooksOpts.sanitizeOps !== undefined) {
                      mockContext.sanitizeOps = hooksOpts.sanitizeOps;
                    }
                    if (hooksOpts.sanitizeResources !== undefined) {
                      mockContext.sanitizeResources =
                        hooksOpts.sanitizeResources;
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
      throw new Error($tr("runner.bunTestMustBeInDescribe", { name }));
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
 * 将 Deno 测试上下文的 origin（file URL）格式化为可读的文件路径，用于超时等错误信息
 * @param origin - 测试的 origin 字符串（如 file:///path/to/test.ts）
 * @returns 可读路径，若解析失败则返回原字符串
 */
function formatOriginToPath(origin: string): string {
  if (!origin || !origin.startsWith("file:")) return origin;
  try {
    const u = new URL(origin);
    return decodeURIComponent(u.pathname);
  } catch {
    return origin;
  }
}

/**
 * 从当前调用栈中解析出第一个非 test-runner 的文件路径（用于 Bun 等无 origin 的环境）
 * 在 test() 注册时调用，栈中调用方为测试文件
 * @returns 文件路径或 undefined
 */
function getTestFilePathFromStack(): string | undefined {
  try {
    const stack = new Error().stack ?? "";
    const lines = stack.split("\n");
    const runnerBasename = "test-runner";
    for (const line of lines) {
      // 匹配 file:// URL（括号内或单独）
      const fileUrlMatch = line.match(/file:\/\/[^\s)]+/);
      const pathInParen = line.match(/at\s+.*?\s+\(([^)]+)\)/)?.[1];
      const path = fileUrlMatch?.[0] ?? pathInParen;
      if (!path || path.includes(runnerBasename)) continue;
      if (path.startsWith("file://")) {
        try {
          return decodeURIComponent(new URL(path).pathname);
        } catch {
          return path;
        }
      }
      if (path.includes(".ts") || path.includes(".js")) return path;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * 在错误信息末尾追加测试文件路径，便于定位失败用例所在文件
 * @param error - 捕获的异常（可为 Error 或任意值）
 * @param filePath - 测试文件路径（Deno 的 origin 格式化后或栈解析结果），无则不变
 */
function augmentErrorWithFilePath(
  error: unknown,
  filePath: string | undefined,
): void {
  if (!filePath) return;
  const suffix = `\n  at ${filePath}`;
  if (error instanceof Error) {
    if (!error.message.endsWith(suffix)) {
      error.message += suffix;
    }
  }
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

        // 检查是否启用浏览器测试（虽然测试被跳过，但配置应该被接受；支持从 suite.options 继承）
        let browserCtx: BrowserContext | undefined;
        if (hasBrowserTest(options, suite.options)) {
          const browserConfig = getBrowserConfig(options, suite.options);
          if (browserConfig && browserConfig.enabled) {
            const suitePath = getFullSuiteName(suite);
            await setupBrowserTest(browserConfig, testContext, suitePath);
            browserCtx = (testContext as TestContext & {
              _browserContext?: BrowserContext;
            })
              ._browserContext;
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
          logger.warn($tr("runner.skipped", { name: fullName }));
          const testContext = createTestContext(fullName);
          await fn(testContext);
        }, options);
      }
    })();
  }
  // 其他环境：skip 测试会在 runSuite 中处理
};

/**
 * 条件跳过测试
 * @param condition 如果为 true，则跳过测试；如果为 false，则正常执行测试
 * @param name 测试名称
 * @param fn 测试函数（可以接受可选的测试上下文参数）
 * @param options 测试选项（可选）
 */
test.skipIf = function (
  condition: boolean,
  name: string,
  fn: (t?: TestContext) => void | Promise<void>,
  options?: TestOptions,
): void {
  if (condition) {
    test.skip(name, fn, options);
  } else {
    test(name, fn, options);
  }
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
  const testFilePath = getTestFilePathFromStack();

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

        // 检查是否启用浏览器测试（支持从 suite.options 继承）
        let browserCtx: BrowserContext | undefined;
        if (hasBrowserTest(options, suite.options)) {
          const browserConfig = getBrowserConfig(options, suite.options);
          if (browserConfig && browserConfig.enabled) {
            const suitePath = getFullSuiteName(suite);
            try {
              await setupBrowserTest(browserConfig, testContext, suitePath);
              browserCtx = (testContext as TestContext & {
                _browserContext?: BrowserContext;
              })
                ._browserContext;
              t.sanitizeOps = false;
              t.sanitizeResources = false;
            } catch (error) {
              testContext.browserSetupError = error instanceof Error
                ? error
                : new Error(String(error));
            }
          }
        }

        try {
          const browserSetupErr = testContext.browserSetupError;
          if (browserSetupErr) {
            const cfg = getBrowserConfig(options, suite.options);
            if (cfg?.onSetupError !== "pass") {
              throw browserSetupErr;
            }
          }
          try {
            await fn(testContext);
          } catch (error) {
            const filePart = t.origin
              ? formatOriginToPath(t.origin)
              : testFilePath;
            augmentErrorWithFilePath(error, filePart);
            throw error;
          }
        } finally {
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

          // 检查是否启用浏览器测试（支持从 suite.options 继承）
          let browserCtx: BrowserContext | undefined;
          if (hasBrowserTest(options, suite.options)) {
            const browserConfig = getBrowserConfig(options, suite.options);
            if (browserConfig && browserConfig.enabled) {
              const suitePath = getFullSuiteName(suite);
              try {
                await setupBrowserTest(browserConfig, testContext, suitePath);
                browserCtx = (testContext as TestContext & {
                  _browserContext?: BrowserContext;
                })
                  ._browserContext;
                testContext.sanitizeOps = false;
                testContext.sanitizeResources = false;
              } catch (error) {
                testContext.browserSetupError = error instanceof Error
                  ? error
                  : new Error(String(error));
              }
            }
          }

          try {
            const browserSetupErr = testContext.browserSetupError;
            if (browserSetupErr) {
              const cfg = getBrowserConfig(options, suite.options);
              if (cfg?.onSetupError !== "pass") {
                throw browserSetupErr;
              }
            }
            await fn(testContext);
            testStats.passed++;
            testStats.total++;
          } catch (error) {
            augmentErrorWithFilePath(error, testFilePath);
            testStats.failed++;
            testStats.total++;
            throw error;
          } finally {
            if (browserCtx) {
              await cleanupBrowserTest(testContext);
            }
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
 * it 的导出类型：与 test 相同的调用签名，并包含 skip / skipIf / only 方法（JSR 要求显式类型）
 */
export type ItExport =
  & ((
    name: string,
    fn: (t?: TestContext) => void | Promise<void>,
    options?: TestOptions,
  ) => void)
  & {
    skip: typeof test.skip;
    skipIf: typeof test.skipIf;
    only: typeof test.only;
  };

/**
 * it 作为 test 的别名，并显式挂载 skip / skipIf / only 为自有属性
 * 确保 Bun 等运行时在解析模块时能正确看到 it.skip、it.skipIf、it.only
 */
export const it: ItExport = Object.assign(
  (
    name: string,
    fn: (t?: TestContext) => void | Promise<void>,
    options?: TestOptions,
  ) => test(name, fn, options),
  {
    skip: test.skip,
    skipIf: test.skipIf,
    only: test.only,
  },
);
