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

/** 入口路径：相对 test 包根目录，执行 deno test 时 cwd 为 test/ */
const entryPath = "tests/browser/fixtures/minimal-entry.ts";

/** 全量跑用的浏览器配置（entryPoint + globalName + browserMode: false，复用浏览器） */
const fullSuiteBrowserConfig = {
  sanitizeOps: false,
  sanitizeResources: false,
  timeout: 60_000,
  browser: {
    enabled: true,
    headless: true,
    browserSource: "test" as const,
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
