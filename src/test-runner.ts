/**
 * 测试运行器
 * 提供 describe, test, it 等测试组织函数
 * 兼容 Deno / Bun / Node 环境
 */

import {
  addSignalListener,
  exit,
  getEnv,
  IS_BUN,
  IS_DENO,
  IS_NODE,
} from "@dreamer/runtime-adapter";
import { createRequire } from "node:module";
import type { BrowserContext } from "./browser/browser-context.ts";
import { createBrowserContext } from "./browser/browser-context.ts";
import { buildClientBundle } from "./browser/bundle.ts";
import { createTestPage, DEFAULT_TEMPLATE_IIFE } from "./browser/page.ts";
import { clearPendingSuiteHooks, pendingSuiteHooks } from "./hooks-state.ts";
import { $tr } from "./i18n.ts";
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
 * 套件钩子超时：Bun 原生 beforeAll/afterAll/beforeEach/afterEach **默认仅 5s**。
 * e2e 的 beforeAll 起 dev server + 就绪等待、afterEach 关 Playwright、afterAll kill
 * 进程树均可能 >5s，否则会出现 `a beforeEach/afterEach hook timed out` →
 * `killed dangling processes` → SIGTERM 误杀 dev server → 后续 ConnectionRefused。
 * Deno 的伪装 afterAll 用例也用此值。
 */
const HOOK_TIMEOUT_MS = 60_000;
/** @deprecated 使用 HOOK_TIMEOUT_MS；保留别名避免漏改 */
const AFTER_ALL_HOOK_TIMEOUT_MS = HOOK_TIMEOUT_MS;

/**
 * Bun/Node 环境下标记是否在 describe 块内（使用计数器支持嵌套）
 */
let describeDepth = 0;

/**
 * 标记当前是否正在执行 it()/test() 用例体。
 *
 * 【Why】Node 的 node:test 在用例体内调用 describe() 不会抛 "inside a test" 错误
 * （Bun 会抛），而是注册一个子测试；父用例同步返回后该子测试被 cancel
 * （cancelledByParent）。故 Node 下 describe() 检测到此标志为 true 时，
 * 跳过原生注册、直接执行回调（与 Bun 抛错后的兜底路径一致）。
 */
let insideTestBody = false;

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

/**
 * Bun 测试 API（同步）。
 *
 * 【Why 同步】旧实现用 `await import("bun:test")` 再注册 describe/test，导致：
 * 1) 首个顶层 describe 异步展开，多文件加载时 suite 栈串套；
 * 2) afterAll 被伪装成普通 `test("…(afterAll)")`，执行顺序不保证，e2e 会中途杀 dev server。
 * 现用 `import.meta.require("bun:test")` 同步取 API，并走原生 beforeAll/afterAll/beforeEach/afterEach。
 */
type BunTestApi = {
  test:
    & ((
      name: string,
      fn: () => void | Promise<void>,
      options?: { timeout?: number },
    ) => void)
    & {
      skip?: (
        name: string,
        fn: () => void | Promise<void>,
        options?: { timeout?: number },
      ) => void;
      only?: (
        name: string,
        fn: () => void | Promise<void>,
        options?: { timeout?: number },
      ) => void;
    };
  describe: (name: string, fn: () => void) => void;
  beforeAll: (
    fn: () => void | Promise<void>,
    options?: { timeout?: number },
  ) => void;
  afterAll: (
    fn: () => void | Promise<void>,
    options?: { timeout?: number },
  ) => void;
  beforeEach: (
    fn: () => void | Promise<void>,
    options?: { timeout?: number },
  ) => void;
  afterEach: (
    fn: () => void | Promise<void>,
    options?: { timeout?: number },
  ) => void;
};

/** undefined=未初始化；null=不可用 */
let bunTestApiSync: BunTestApi | null | undefined;

/**
 * 同步获取 bun:test（仅 IS_BUN）。Deno 路径永不调用。
 */
export function getBunTestApiSync(): BunTestApi | null {
  if (!IS_BUN) return null;
  if (bunTestApiSync !== undefined) return bunTestApiSync;
  try {
    const metaReq =
      (import.meta as { require?: (id: string) => unknown }).require;
    let mod: Partial<BunTestApi> | null = null;
    if (metaReq) {
      mod = metaReq("bun:test") as Partial<BunTestApi>;
    } else {
      const gRequire = (globalThis as { require?: (id: string) => unknown })
        .require;
      if (typeof gRequire === "function") {
        mod = gRequire("bun:test") as Partial<BunTestApi>;
      }
    }
    if (mod?.test && mod?.describe && mod.beforeAll && mod.afterAll) {
      bunTestApiSync = {
        test: mod.test as BunTestApi["test"],
        describe: mod.describe,
        beforeAll: mod.beforeAll,
        afterAll: mod.afterAll,
        beforeEach: mod.beforeEach!,
        afterEach: mod.afterEach!,
      };
    } else {
      bunTestApiSync = null;
    }
  } catch {
    bunTestApiSync = null;
  }
  return bunTestApiSync;
}

/**
 * 【Node 后端】node:test 原生 API 句柄（结构与 BunTestApi 一致，调用约定内部适配）。
 *
 * Node 的 node:test 与 bun:test 同构（describe/it/before/after/beforeEach/afterEach/
 * it.skip/it.only），但两处调用约定不同，需在 wrapper 内适配：
 * - test 签名：Node 为 `test(name, options, fn)`，Bun 为 `test(name, fn, options)`
 * - 钩子命名：Node 用 `before`/`after`，Bun 用 `beforeAll`/`afterAll`
 *
 * wrapper 对外暴露 Bun 兼容签名（name, fn, options），使 describe/test 分支无需区分运行时。
 */
let nodeTestApiSync: BunTestApi | null | undefined;

export function getNodeTestApiSync(): BunTestApi | null {
  if (!IS_NODE) return null;
  if (nodeTestApiSync !== undefined) return nodeTestApiSync;
  try {
    const req = createRequire(import.meta.url);
    const nt = req("node:test") as {
      test:
        & ((name: string, fn: () => void | Promise<void>) => void)
        & ((
          name: string,
          options: { timeout?: number },
          fn: () => void | Promise<void>,
        ) => void)
        & {
          skip?: (name: string, fn: () => void | Promise<void>) => void;
          only?:
            & ((name: string, fn: () => void | Promise<void>) => void)
            & ((
              name: string,
              options: { timeout?: number },
              fn: () => void | Promise<void>,
            ) => void);
        };
      describe: (name: string, fn: () => void) => void;
      before: (
        fn: () => void | Promise<void>,
        options?: { timeout?: number },
      ) => void;
      after: (
        fn: () => void | Promise<void>,
        options?: { timeout?: number },
      ) => void;
      beforeEach: (
        fn: () => void | Promise<void>,
        options?: { timeout?: number },
      ) => void;
      afterEach: (
        fn: () => void | Promise<void>,
        options?: { timeout?: number },
      ) => void;
    };
    if (!nt?.test || !nt?.describe || !nt.before || !nt.after) {
      nodeTestApiSync = null;
      return nodeTestApiSync;
    }
    /** 适配 Node test(name, options, fn) → 对外 test(name, fn, options) */
    const adaptTest = (
      base: typeof nt.test,
    ): BunTestApi["test"] => {
      const wrapped = ((
        name: string,
        fn: () => void | Promise<void>,
        options?: { timeout?: number },
      ) => {
        if (options?.timeout) base(name, { timeout: options.timeout }, fn);
        else base(name, fn);
      }) as BunTestApi["test"];
      return wrapped;
    };
    nodeTestApiSync = {
      test: adaptTest(nt.test),
      describe: nt.describe,
      // Node before/after 映射为 Bun beforeAll/afterAll
      beforeAll: (fn, options) =>
        nt.before(
          fn,
          options?.timeout ? { timeout: options.timeout } : undefined,
        ),
      afterAll: (fn, options) =>
        nt.after(
          fn,
          options?.timeout ? { timeout: options.timeout } : undefined,
        ),
      beforeEach: (fn, options) =>
        nt.beforeEach(
          fn,
          options?.timeout ? { timeout: options.timeout } : undefined,
        ),
      afterEach: (fn, options) =>
        nt.afterEach(
          fn,
          options?.timeout ? { timeout: options.timeout } : undefined,
        ),
    };
    // test.skip / test.only：Node 原生支持，适配为 Bun 签名 (name, fn, options?)
    const t = nodeTestApiSync.test as BunTestApi["test"];
    const ntSkip = nt.test.skip;
    if (ntSkip) {
      // 跳过的用例不执行，timeout 无意义，忽略
      t.skip = (name, fn) => ntSkip(name, fn);
    }
    const ntOnly = nt.test.only;
    if (ntOnly) {
      t.only = (name, fn, options) => {
        if (options?.timeout) {
          ntOnly(name, { timeout: options.timeout }, fn);
        } else {
          ntOnly(name, fn);
        }
      };
    }
  } catch {
    nodeTestApiSync = null;
  }
  return nodeTestApiSync;
}

/**
 * 统一原生测试 API 调度器：Bun 返回 bun:test，Node 返回 node:test，Deno 返回 null。
 * 【Why】describe/test 分支用此函数获取原生 API，无需重复 IS_BUN/IS_NODE 判断。
 */
export function getNativeTestApiSync(): BunTestApi | null {
  if (IS_BUN) return getBunTestApiSync();
  if (IS_NODE) return getNodeTestApiSync();
  return null;
}

/**
 * 在当前 describe 作用域注册原生钩子（由 test-utils 的 beforeAll 等调用）。
 * Bun/Node 下走原生 before/after/beforeEach/afterEach；Deno 下为 no-op（钩子由 test-runner 在首个 it 前执行）。
 */
export function registerNativeHook(
  kind: "beforeAll" | "afterAll" | "beforeEach" | "afterEach",
  fn: (...args: never[]) => void | Promise<void>,
  options?: { timeout?: number },
): void {
  // Bun/Node 走原生 API；Deno 不走（钩子存入套件树，由首个 it 前触发）
  if (!IS_BUN && !IS_NODE) return;
  const native = getNativeTestApiSync();
  if (!native) return;
  const hookOptions = options?.timeout != null
    ? { timeout: options.timeout }
    : undefined;
  try {
    // 所有钩子默认 HOOK_TIMEOUT_MS，避免 Bun 5s 默认误杀 e2e
    const opts = hookOptions ?? { timeout: HOOK_TIMEOUT_MS };
    if (kind === "beforeAll") {
      native.beforeAll(fn as () => void | Promise<void>, opts);
    } else if (kind === "afterAll") {
      native.afterAll(fn as () => void | Promise<void>, opts);
    } else if (kind === "beforeEach") {
      native.beforeEach(fn as () => void | Promise<void>, opts);
    } else {
      native.afterEach(fn as () => void | Promise<void>, opts);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 元测试在 it() 内调用 beforeAll 等：只保留 suite 状态，不抛
    if (/inside a test/i.test(msg)) return;
    logger.error(
      $tr("runner.afterAllHookError", { error: String(err) }),
    );
    throw err;
  }
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
 * 宿主侧限时 Promise：Playwright 的 newPage/goto 在 Bun 上偶发永不 resolve，
 * 仅靠 Playwright 自带 timeout 不够；setTimeout race 保证 setup 能失败并重建。
 */
function withHostTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} host timeout ${ms}ms`)),
        ms,
      )
    ),
  ]);
}

/**
 * createBrowserContext 宿主预算（CI 更长）。
 * 本地不宜过长：半死 launch/newPage 时外层 race 要尽快失败并走重试/重建，
 * 避免整文件长时间无输出像「卡住」。内层另有 launch/newPage 宿主 timeout。
 */
function createBrowserBudgetMs(): number {
  return getEnv("CI") === "true" ? 90_000 : 25_000;
}

/**
 * 新建浏览器实例（含一次重试），并写入 suite 缓存。
 * 其它 suite 泄漏的 Chromium 会先被清掉，避免 launch 叠超时。
 */
async function createFreshBrowserContext(
  config: BrowserTestConfig,
  cacheKey: string | undefined,
  shouldReuse: boolean,
): Promise<BrowserContext> {
  if (!shouldReuse && cacheKey) {
    const stale = suiteBrowserCache.get(cacheKey);
    if (stale) {
      suiteBrowserCache.delete(cacheKey);
      await stale.close().catch(() => {});
    }
  }
  if (suiteBrowserCache.size > 0) {
    await cleanupAllBrowsers().catch(() => {});
  }

  const createOnce = (budgetMs: number) =>
    withHostTimeout(
      createBrowserContext(config),
      budgetMs,
      "createBrowserContext",
    );
  const budgetMs = createBrowserBudgetMs();
  let browserCtx: BrowserContext;
  try {
    browserCtx = await createOnce(budgetMs);
  } catch (firstErr) {
    await cleanupAllBrowsers().catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    try {
      browserCtx = await createOnce(budgetMs);
    } catch {
      throw firstErr;
    }
  }
  if (cacheKey) {
    suiteBrowserCache.set(cacheKey, browserCtx);
  }
  return browserCtx;
}

/**
 * 复用已有 Browser：newPage + 可选 entryPoint 重载。
 *
 * 【Why 必须有宿主超时】
 * full-suite / beforeAll 嵌套套件在「第 N 例 pass 后」若卡在 `browser.newPage()`，
 * Bun 上可能 0% CPU 且永不进入第 N+1 例日志；外层 it timeout 也可能因事件环
 * 被 CDP 卡住而不触发。newPage/goto/wait 全部 race 后，失败可走「丢弃缓存并重建」。
 */
async function attachNewPageOnReusedBrowser(
  browserCtx: BrowserContext,
  config: BrowserTestConfig,
): Promise<void> {
  const browser = browserCtx.browser as {
    isConnected?: () => boolean;
    newPage: () => Promise<any>;
  };
  if (typeof browser.isConnected === "function" && !browser.isConnected()) {
    throw new Error("reused browser is disconnected");
  }

  const newPage = await withHostTimeout(
    browser.newPage(),
    10_000,
    "browser.newPage",
  );
  const defaultPageOpTimeoutMs = config.moduleLoadTimeout
    ? config.moduleLoadTimeout + 10_000
    : 60_000;
  try {
    newPage.setDefaultTimeout(defaultPageOpTimeoutMs);
    newPage.setDefaultNavigationTimeout(defaultPageOpTimeoutMs);
  } catch {
    // ignore
  }
  browserCtx.page = newPage;

  if (!config.entryPoint) return;

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

    const consoleErrors: string[] = [];
    newPage.on("console", (msg: any) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    newPage.on("pageerror", (error: any) => {
      consoleErrors.push(error.message);
    });

    const loadTimeout = config.moduleLoadTimeout
      ? config.moduleLoadTimeout + 10_000
      : 60_000;
    let diagRightAfterGoto:
      | { hasGlobal?: boolean; hasTestReady?: boolean }
      | { error: string } = {};
    try {
      /** Playwright Response 最小形态（newPage 为 any 时显式标注，避免 Deno check 推成 unknown） */
      type GotoResponse = {
        url(): string;
        ok(): boolean;
        status(): number;
      } | null;
      const response = await withHostTimeout<GotoResponse>(
        newPage.goto(`file://${htmlPath}`, {
          waitUntil: "domcontentloaded",
          timeout: loadTimeout,
        }) as Promise<GotoResponse>,
        loadTimeout + 2000,
        "page.goto",
      );
      // goto 后立即检查：已就绪则跳过 waitForFunction（复用路径下偶发不返回）
      diagRightAfterGoto = await withHostTimeout(
        newPage.evaluate((name: string) => ({
          hasGlobal: typeof (window as any)[name] !== "undefined",
          hasTestReady: (window as any).testReady === true,
        }), config.globalName!) as Promise<
          { hasGlobal?: boolean; hasTestReady?: boolean }
        >,
        5_000,
        "page.evaluate(diag)",
      ).catch((e: unknown) => ({ error: String(e) }));

      if (
        response &&
        !response.url().startsWith("file:") &&
        !response.ok()
      ) {
        const status = response?.status() || "unknown";
        throw new Error(
          $tr("runner.pageLoadFailedStatus", {
            status: String(status),
            htmlPath,
          }),
        );
      }

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
      await closePageWithHostTimeout(newPage);
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
    const hostWaitMs = moduleLoadTimeout + 2000;
    const globalName = config.globalName;
    if (globalName) {
      const alreadyReady = typeof diagRightAfterGoto === "object" &&
        !("error" in diagRightAfterGoto) &&
        diagRightAfterGoto.hasGlobal === true &&
        diagRightAfterGoto.hasTestReady === true;
      if (!alreadyReady) {
        try {
          await withHostTimeout(
            newPage.waitForFunction(
              (name: string) => {
                return typeof (window as any)[name] !== "undefined" &&
                  (window as any).testReady === true;
              },
              globalName,
              { timeout: moduleLoadTimeout },
            ),
            hostWaitMs,
            "waitForFunction",
          );
        } catch (_error) {
          try {
            await withHostTimeout(
              newPage.waitForFunction(
                (name: string) => typeof (window as any)[name] !== "undefined",
                globalName,
                { timeout: 2000 },
              ),
              3000,
              "waitForFunction retry",
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
      try {
        await withHostTimeout(
          newPage.waitForFunction(
            () => (window as any).testReady === true,
            { timeout: moduleLoadTimeout },
          ),
          hostWaitMs,
          "waitForFunction testReady",
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
    await closePageWithHostTimeout(newPage);
    throw error;
  }
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

  // 缓存键必须使用完整 getFullSuiteName(suite)：勿仅用 split(" > ")[0]，否则跨文件串键。
  // 【Invariant】reuseBrowser === false 时不得从 cache 取实例。
  let browserCtx: BrowserContext | undefined;
  const shouldReuse = config.reuseBrowser !== false && Boolean(suitePath);
  const cacheKey = suitePath;

  if (shouldReuse && cacheKey) {
    browserCtx = suiteBrowserCache.get(cacheKey);
  }

  if (browserCtx) {
    try {
      await attachNewPageOnReusedBrowser(browserCtx, config);
    } catch (reuseErr) {
      // 复用路径挂死/失败：丢弃缓存并完整重建（解决 full-suite 第 1 例后假死）
      if (cacheKey) suiteBrowserCache.delete(cacheKey);
      await browserCtx.close().catch(() => {});
      browserCtx = undefined;
      logger.error(
        `[dreamer/test] reuse browser failed, recreating: ${
          reuseErr instanceof Error ? reuseErr.message : String(reuseErr)
        }`,
      );
    }
  }

  if (!browserCtx) {
    try {
      browserCtx = await createFreshBrowserContext(
        config,
        cacheKey,
        shouldReuse,
      );
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        $tr("runner.browserContextFailed", { message: errorMessage }),
      );
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

  (testContext as TestContext & { _browserContext?: BrowserContext })
    ._browserContext = browserCtx;
  (testContext as TestContext & { _shouldReuseBrowser?: boolean })
    ._shouldReuseBrowser = shouldReuse;

  testContext.sanitizeOps = false;
  testContext.sanitizeResources = false;
}

/**
 * 宿主侧限时关闭 page：Playwright `page.close()` 在 Bun/CI 上偶发永不 resolve，
 * 会卡住「上一条 pass 后、下一条 setup 前」的 finally，表现为 full-suite 第 1 例后假死。
 */
async function closePageWithHostTimeout(
  page: { close(): Promise<void> },
  ms = 8_000,
): Promise<void> {
  const closePromise = page.close().catch(() => {});
  try {
    await Promise.race([
      closePromise,
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
    ]);
  } finally {
    void closePromise;
  }
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
    // 无论是否复用，都只关闭页面，不关闭浏览器。
    // 先摘掉 context 引用，避免下一例 setup 与 close 竞态；
    // close 用短超时：Bun 上 page.close 永不返回时不能挡住下一例。
    const page = browserCtx.page;
    try {
      (browserCtx as { page?: unknown }).page = undefined;
    } catch {
      // ignore
    }
    if (page) {
      // 4s 足够正常 close；超时则放行，页面由 suite 结束时 browser.close/SIGKILL 收
      await closePageWithHostTimeout(page, 4_000);
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
 *
 * 【Why 不在此处 clear beforeAllExecutedMap】
 * e2e 在 Bun 下会在 **afterEach** 调用本函数以关掉 Playwright（见 dweb
 * `browser-render-utils`），若同时清空 beforeAll 标记，同一套件后续 it 会再次
 * 执行 beforeAll → 再起一个 dev server，而旧进程仍占端口，导致
 * 「Port N is in use, using N+1」堆积、浏览器/端口连锁失败。
 * beforeAll 标记仅在进程退出信号路径中清空（见下方 SIGINT/SIGTERM）。
 */
export async function cleanupAllBrowsers(): Promise<void> {
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

/**
 * 重置 beforeAll 执行标记（watch / 进程退出用）。
 * 勿在套件 afterEach 中调用。
 */
export function resetBeforeAllExecutedMap(): void {
  beforeAllExecutedMap.clear();
}

// 使用 runtime-adapter 注册 SIGINT/SIGTERM：关闭所有浏览器后退出，与 browser-context 的 activeBrowsers 清理互补
// 手动终止进程（Ctrl+C）时确保关闭打开的浏览器
try {
  const handleSignalCleanup = () => {
    void cleanupAllBrowsers().then(() => {
      resetBeforeAllExecutedMap();
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

  /**
   * Bun/Node：必须用原生 `describe` 嵌套，才能让原生 beforeAll/afterAll 作用域正确。
   * 同步 require，避免旧版 async import 导致的多文件 suite 串套。
   */
  if (IS_BUN || IS_NODE) {
    const native = getNativeTestApiSync();
    if (!native?.describe) {
      throw new Error($tr("runner.bunTestMustBeInDescribe", { name }));
    }

    const runSuiteBody = (): void => {
      const suite: TestSuite = {
        name,
        fn,
        tests: [],
        suites: [],
        parent: currentSuite,
        beforeAll: currentSuite.beforeAll,
        afterAll: currentSuite.afterAll,
        beforeEach: currentSuite.beforeEach,
        afterEach: currentSuite.afterEach,
        options,
      };
      currentSuite.suites.push(suite);
      suiteStack.push(currentSuite);
      currentSuite = suite;
      describeDepth++;
      try {
        fn();
      } finally {
        // Bun afterAll 已在 afterAll() 调用时注册为原生钩子，切勿再伪装成 test
        clearPendingSuiteHooks();
        currentSuite = suiteStack.pop() || rootSuite;
        describeDepth--;
      }
    };

    // 元测试在 it() 内调用 describe 时原生 API 会抛错 → 仅执行回调
    // Node 不抛错（改为注册被 cancel 的子测试），故主动检测 insideTestBody 跳过原生注册
    if (IS_NODE && insideTestBody) {
      runSuiteBody();
      return;
    }
    try {
      /**
       * 【Why 每个顶层 describe 都挂 afterAll 清理】
       * 旧逻辑用进程级 `cleanupDescribeScheduled` 只注册一次 afterAll。
       * Bun 会缓存 `@dreamer/test` 模块，整次 `bun test tests/` 只在「最后一个文件结束」
       * 才关浏览器 → 前面文件的 Chromium 泄漏，后续 full-suite 第 1 例 launch 叠超时假死。
       * 顶层 describe（describeDepth===0）结束时清理本文件缓存的浏览器。
       */
      native.describe(name, () => {
        if (describeDepth === 0) {
          try {
            native.afterAll(async () => {
              await cleanupAllBrowsers();
            }, { timeout: HOOK_TIMEOUT_MS });
          } catch {
            // ignore
          }
        }
        runSuiteBody();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/inside a test/i.test(msg)) {
        runSuiteBody();
        return;
      }
      throw err;
    }
    return;
  }

  // ---------- Deno / 其它 ----------
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

  try {
    fn();
  } finally {
    const savedAfterAll = suite.afterAll;
    const parentAfterAll = suite.parent?.afterAll;
    currentSuite = suiteStack.pop() || rootSuite;

    // 清空当前钩子，避免钩子被错误继承到其他套件
    clearPendingSuiteHooks();

    // Deno：afterAll 无原生钩子，注册为顺序执行的特殊用例（须排在同套件 it 之后）
    if (
      IS_DENO &&
      savedAfterAll &&
      savedAfterAll !== parentAfterAll
    ) {
      const suiteFullName = getFullSuiteName(suite);
      const afterAllTestName = `${suiteFullName} (afterAll)`;
      (globalThis as { Deno?: { test: (opts: unknown) => void } }).Deno?.test({
        name: afterAllTestName,
        ignore: false,
        parallel: false,
        timeout: AFTER_ALL_HOOK_TIMEOUT_MS,
        sanitizeOps: false,
        sanitizeResources: false,
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

        /**
         * 浏览器初始化与用户断言在同一异步流程内，并与 `options.timeout` 一并赛跑；
         * 否则 setup 可占满 Playwright 的 120s，而 `fn` 侧 15s 超时先触发，表现为「假卡住」。
         */
        const runBrowserTestBody = async (): Promise<void> => {
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
                const browserSetupError = error instanceof Error
                  ? error
                  : new Error(String(error));
                testContext.browserSetupError = browserSetupError;
              }
            }
          }

          const browserSetupErr = testContext.browserSetupError;
          if (browserSetupErr) {
            const cfg = getBrowserConfig(options, suite.options);
            if (cfg?.onSetupError !== "pass") {
              throw browserSetupErr;
            }
          }

          await fn(testContext);

          if (testContext.sanitizeOps !== undefined) {
            t.sanitizeOps = testContext.sanitizeOps;
          }
          if (testContext.sanitizeResources !== undefined) {
            t.sanitizeResources = testContext.sanitizeResources;
          }
        };

        try {
          try {
            // Deno 的 timeout 在异步/浏览器场景下不可靠，在运行器内用 Promise.race 强制到点失败
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
                  runBrowserTestBody(),
                  timeoutPromise,
                ]);
              } finally {
                if (timeoutId != null) clearTimeout(timeoutId);
              }
            } else {
              await runBrowserTestBody();
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
  } else if (IS_BUN || IS_NODE) {
    // Bun：须在 describe 内；钩子由原生 beforeAll/afterAll/beforeEach/afterEach 执行，此处不再手动跑
    if (describeDepth <= 0) {
      throw new Error($tr("runner.bunTestMustBeInDescribe", { name }));
    }
    const native = getNativeTestApiSync();
    if (!native?.test) {
      throw new Error($tr("runner.bunTestMustBeInDescribe", { name }));
    }

    const fullName = getFullTestName(name);
    const suite = currentSuite;
    /** 嵌套 describe 下用短名，避免 "A > B > A > B > test" 重复前缀 */
    const registerName = name;

    const testFn = async () => {
      insideTestBody = true;
      const testContext = createTestContext(fullName);
      const inherited = mergeInheritedSanitize(suite, options);
      if (inherited.sanitizeOps !== undefined) {
        testContext.sanitizeOps = inherited.sanitizeOps;
      }
      if (inherited.sanitizeResources !== undefined) {
        testContext.sanitizeResources = inherited.sanitizeResources;
      }

      let browserCtx: BrowserContext | undefined;
      let timedOut = false;

      const runBrowserTestBody = async (): Promise<void> => {
        if (hasBrowserTest(options, suite.options)) {
          const browserConfig = getBrowserConfig(options, suite.options);
          if (browserConfig && browserConfig.enabled) {
            const suitePath = getFullSuiteName(suite);
            try {
              await setupBrowserTest(
                browserConfig,
                testContext,
                suitePath,
              );
              browserCtx = (testContext as TestContext & {
                _browserContext?: BrowserContext;
              })._browserContext;
              testContext.sanitizeOps = false;
              testContext.sanitizeResources = false;
            } catch (error) {
              testContext.browserSetupError = error instanceof Error
                ? error
                : new Error(String(error));
            }
          }
        }

        const browserSetupErr = testContext.browserSetupError;
        if (browserSetupErr) {
          const cfg = getBrowserConfig(options, suite.options);
          if (cfg?.onSetupError !== "pass") {
            throw browserSetupErr;
          }
        }

        await fn(testContext);
      };

      try {
        if (options?.timeout) {
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          /**
           * 长超时（e2e ≥15s）：宿主 race 比 Bun test timeout 短 5s，保证我们先
           * reject 并跑 finally 清理浏览器，避免 Bun 硬杀导致 dangling 连锁。
           * 短超时（unit 如 200ms）：直接用完整 timeout，不可再减 5s（否则变 1ms）。
           */
          const hostTimeoutMs = options.timeout >= 15_000
            ? options.timeout - 5_000
            : options.timeout;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              timedOut = true;
              const fileSuffix = testFilePath ? `\n  at ${testFilePath}` : "";
              reject(
                new Error(
                  `Test timeout: ${options.timeout}ms (test: ${fullName})${fileSuffix}`,
                ),
              );
            }, hostTimeoutMs);
          });
          try {
            await Promise.race([runBrowserTestBody(), timeoutPromise]);
          } finally {
            if (timeoutId != null) clearTimeout(timeoutId);
          }
        } else {
          await runBrowserTestBody();
        }
        if (!timedOut) {
          testStats.passed++;
          testStats.total++;
        }
      } catch (error) {
        testStats.failed++;
        testStats.total++;
        augmentErrorWithFilePath(error, testFilePath);
        throw error;
      } finally {
        insideTestBody = false;
        // 仅清理本用例浏览器页面；用户 afterEach 由 Bun 原生钩子执行
        if (browserCtx) {
          await cleanupBrowserTest(testContext);
        }
      }
    };

    if (options?.timeout) {
      native.test(registerName, testFn, { timeout: options.timeout });
    } else {
      native.test(registerName, testFn);
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
 *
 * 【Bun】部分 Error（如 Playwright / 宿主超时）的 `message` 为只读，直接
 * `error.message +=` 会抛 `TypeError: Attempted to assign to readonly property`，
 * 掩盖真实失败原因。失败时用 defineProperty 或忽略，绝不二次抛错。
 */
function augmentErrorWithFilePath(
  error: unknown,
  filePath: string | undefined,
): void {
  if (!filePath) return;
  const suffix = `\n  at ${filePath}`;
  if (!(error instanceof Error)) return;
  if (error.message.endsWith(suffix)) return;
  const next = error.message + suffix;
  try {
    error.message = next;
  } catch {
    try {
      Object.defineProperty(error, "message", {
        value: next,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch {
      // 无法改写时保留原错误，避免掩盖真实失败
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
  } else if (IS_BUN || IS_NODE) {
    const native = getNativeTestApiSync();
    const fullName = getFullTestName(name);
    if (native?.test?.skip) {
      const skipOpts = options?.timeout
        ? { timeout: options.timeout }
        : undefined;
      const skipFn = async () => {
        logger.warn($tr("runner.skipped", { name: fullName }));
        const testContext = createTestContext(fullName);
        await fn(testContext);
      };
      if (skipOpts) native.test.skip(name, skipFn, skipOpts);
      else native.test.skip(name, skipFn);
    }
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
  } else if (IS_BUN || IS_NODE) {
    // only：与普通 it 相同（原生钩子 + 浏览器 setup），仅用 test.only 注册
    const native = getNativeTestApiSync();
    if (!native?.test?.only) return;
    const fullName = getFullTestName(name);
    const suite = currentSuite;
    const testFn = async () => {
      insideTestBody = true;
      const testContext = createTestContext(fullName);
      if (suite.options) {
        if (suite.options.sanitizeOps !== undefined) {
          testContext.sanitizeOps = suite.options.sanitizeOps;
        }
        if (suite.options.sanitizeResources !== undefined) {
          testContext.sanitizeResources = suite.options.sanitizeResources;
        }
      }
      let browserCtx: BrowserContext | undefined;
      if (hasBrowserTest(options, suite.options)) {
        const browserConfig = getBrowserConfig(options, suite.options);
        if (browserConfig?.enabled) {
          try {
            await setupBrowserTest(
              browserConfig,
              testContext,
              getFullSuiteName(suite),
            );
            browserCtx = (testContext as TestContext & {
              _browserContext?: BrowserContext;
            })._browserContext;
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
        if (testContext.browserSetupError) {
          const cfg = getBrowserConfig(options, suite.options);
          if (cfg?.onSetupError !== "pass") throw testContext.browserSetupError;
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
        insideTestBody = false;
        if (browserCtx) await cleanupBrowserTest(testContext);
      }
    };
    if (options?.timeout) {
      native.test.only(name, testFn, { timeout: options.timeout });
    } else {
      native.test.only(name, testFn);
    }
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
