/**
 * @fileoverview 覆盖 runner 优化：testEach 走统一 `test` 钩子链、`browser.bundleOnly`、类型字段 browserSetupError。
 */
import { fromFileUrl } from "@dreamer/runtime-adapter";
import { beforeEach, describe, expect, it, testEach } from "../src/mod.ts";

describe("runner / testEach 与父级 beforeEach", () => {
  /** 记录钩子与用例体执行顺序 */
  const log: string[] = [];

  beforeEach(() => {
    log.push("beforeEach");
  });

  const run = testEach<[string]>([["a"], ["b"]]);
  run("param %0", async () => {
    log.push("body");
  });

  it("每组参数应各自触发父级 beforeEach，且共产生 2 次 body", () => {
    expect(log.filter((x) => x === "body").length).toBe(2);
    /** 2 次参数用例 + 本断言用例，各有一次 beforeEach */
    expect(log.filter((x) => x === "beforeEach").length).toBeGreaterThanOrEqual(
      3,
    );
  });
});

describe("runner / browser.bundleOnly", () => {
  /**
   * 必须使用 fromFileUrl：在 Windows 上 `URL#pathname` 会得到 `/D:/...`，
   * esbuild 与 stat 无法解析；fromFileUrl 得到 `D:/...`，与 CI（含 Windows）一致。
   */
  const entryPoint = fromFileUrl(
    new URL("./browser/fixtures/minimal-entry.ts", import.meta.url),
  );

  it(
    "应只打包不启动 Playwright：browserBundle 有代码，browser 无 page",
    async (t) => {
      if (!t) throw new Error("expected TestContext");
      expect(t.browserBundle?.entryPoint).toBe(entryPoint);
      expect(t.browserBundle?.code?.length ?? 0).toBeGreaterThan(20);
      expect(t.browser).toBeUndefined();
    },
    {
      sanitizeOps: false,
      sanitizeResources: false,
      browser: {
        enabled: true,
        bundleOnly: true,
        entryPoint,
        browserMode: false,
        globalName: "minimalFixture",
      },
    },
  );
});
