/**
 * @fileoverview 全量浏览器测试（真实场景）
 *
 * 在同一 describe 下顺序执行多个浏览器用例：entryPoint 打包为 IIFE、复用浏览器、每用例新页面。
 * 用于回归：确保多用例连续跑时不会因 goto/load 或 waitForFunction 卡住；
 * 依赖 test 包在 browserMode: false 时使用经典 script 模板，使 IIFE 正确挂到 window。
 *
 * 入口使用 tests/browser/fixtures/minimal-entry.ts（相对 test 包根目录）。
 */

import {
  afterAll,
  cleanupAllBrowsers,
  describe,
  expect,
  it,
} from "../../src/mod.ts";
import { PLAYWRIGHT_BROWSER_IT_TIMEOUT_MS } from "./_timeouts.ts";

/** 入口路径：相对 test 包根目录，执行 deno test 时 cwd 为 test/ */
const entryPath = "tests/browser/fixtures/minimal-entry.ts";

/**
 * 全量跑配置：entryPoint + globalName + browserMode:false，套件内复用浏览器。
 * timeout 用 60s 而非 300s：launch/goto/wait 均有宿主兜底，5 分钟只掩盖假死。
 */
const fullSuiteBrowserConfig = {
  sanitizeOps: false,
  sanitizeResources: false,
  timeout: 60_000,
  browser: {
    enabled: true,
    headless: true,
    /** 优先系统 Chrome，减轻「先跑 integration 再 full-suite」时 bundled Chromium 启动叠超时 */
    browserSource: "system" as const,
    entryPoint: entryPath,
    globalName: "FullSuiteClient",
    browserMode: false,
    moduleLoadTimeout: 15_000,
    bodyContent: '<div id="root"></div>',
  },
};

describe("全量浏览器测试（多用例顺序执行）", () => {
  afterAll(async () => {
    await cleanupAllBrowsers();
  });

  it("第 1 个用例：应加载入口并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 2 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 3 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 4 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 5 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 6 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 7 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 8 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 9 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);

  it("第 10 个用例：应再次加载页面并得到 global", async (t) => {
    if (!t?.browser) return;
    const result = await t.browser.evaluate(() => {
      const g =
        (globalThis as unknown as { FullSuiteClient?: { ok?: boolean } })
          .FullSuiteClient;
      return g?.ok === true;
    });
    expect(result).toBe(true);
  }, fullSuiteBrowserConfig);
});
