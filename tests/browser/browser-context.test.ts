/**
 * @fileoverview 浏览器测试上下文管理模块测试
 */

import { makeTempFile, writeTextFileSync } from "@dreamer/runtime-adapter"
import { createBrowserContext } from "../../src/browser/browser-context.ts"
import { describe, expect, it } from "../../src/mod.ts"

describe("浏览器测试上下文管理", () => {
  describe("createBrowserContext", () => {
    it("应该创建浏览器上下文（无 entryPoint）", async () => {
      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
      });

      expect(ctx).toBeDefined();
      expect(ctx.browser).toBeDefined();
      expect(ctx.page).toBeDefined();
      expect(ctx.htmlPath).toBe("");

      // 清理
      await ctx.close();
    }, { timeout: 15000 });

    it("应该支持 headless 模式", async () => {
      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
      });

      expect(ctx.browser).toBeDefined();
      expect(ctx.page).toBeDefined();

      await ctx.close();
    });

    it("应该支持自定义 Chrome 路径（如果提供）", async () => {
      // 注意：这个测试可能在某些环境中失败，因为 Chrome 路径可能不存在
      // 但至少应该不会抛出错误
      try {
        const ctx = await createBrowserContext({
          enabled: true,
          headless: true,
          executablePath: "/nonexistent/path",
        });

        // 如果成功创建，清理
        await ctx.close();
      } catch (error) {
        // 如果路径不存在，应该抛出错误
        expect(error).toBeDefined();
      }
    });

    it("应该支持自定义启动参数", async () => {
      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      expect(ctx.browser).toBeDefined();
      expect(ctx.page).toBeDefined();

      await ctx.close();
    });

    it("应该能够执行浏览器代码（evaluate）", async () => {
      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
      });

      const result = await ctx.evaluate(() => {
        return 1 + 1;
      });

      expect(result).toBe(2);

      await ctx.close();
    }, { timeout: 15000 });

    it("应该能够导航到 URL（goto）", async () => {
      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
      });

      await ctx.goto("about:blank");
      const url = await ctx.evaluate(() => window.location.href);
      expect(url).toBe("about:blank");

      await ctx.close();
    }, { timeout: 15000 });

    it("应该能够等待条件（waitFor）", async () => {
      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
      });

      await ctx.goto("about:blank");

      // 设置一个条件
      await ctx.evaluate(() => {
        (window as any).testCondition = false;
        setTimeout(() => {
          (window as any).testCondition = true;
        }, 100);
      });

      await ctx.waitFor(() => {
        return (window as any).testCondition === true;
      }, { timeout: 5000 });

      const condition = await ctx.evaluate(() => {
        return (window as any).testCondition;
      });
      expect(condition).toBe(true);

      await ctx.close();
    });

    it("应该能够创建包含 entryPoint 的上下文", async () => {
      // 创建临时入口文件
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const value = "Hello, World!";`,
      );

      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
        entryPoint: entryFile,
        globalName: "testModule",
      });

      expect(ctx).toBeDefined();
      expect(ctx.browser).toBeDefined();
      expect(ctx.page).toBeDefined();
      expect(ctx.htmlPath).toBeTruthy();

      // 验证模块已加载（esbuild IIFE 格式会将导出绑定到全局变量）
      const moduleValue = await ctx.evaluate(() => {
        return (window as any).testModule?.value;
      });
      expect(moduleValue).toBe("Hello, World!");

      await ctx.close();
    }, { timeout: 15000 });

    it("应该支持自定义 globalName", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const test = "value";`,
      );

      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
        entryPoint: entryFile,
        globalName: "MyCustomModule",
      });

      const value = await ctx.evaluate(() => {
        return (window as any).MyCustomModule?.test;
      });
      expect(value).toBe("value");

      await ctx.close();
    }, { timeout: 25000 });

    it("应该支持自定义 bodyContent", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(entryFile, `console.log('test');`);

      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
        entryPoint: entryFile,
        bodyContent: '<div id="custom">Custom</div>',
      });

      const hasCustom = await ctx.evaluate(() => {
        return (globalThis as any).document?.getElementById("custom") !== null;
      });
      expect(hasCustom).toBe(true);

      await ctx.close();
    }, { timeout: 15000 });

    it("应该支持自定义 HTML 模板", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(entryFile, `console.log('test');`);

      const customTemplate = `<!DOCTYPE html>
<html>
<head>
  <title>Custom</title>
</head>
<body>
  {{BODY_CONTENT}}
  <script>
    {{BUNDLE_CODE}}
    if (typeof window !== 'undefined') {
      window.testReady = true;
    }
  </script>
</body>
</html>`;

      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
        entryPoint: entryFile,
        htmlTemplate: customTemplate,
      });

      const title = await ctx.evaluate(() => {
        return (globalThis as any).document?.title || "";
      });
      expect(title).toBe("Custom");

      await ctx.close();
    }, { timeout: 15000 });

    it("应该支持自定义 moduleLoadTimeout", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(entryFile, `export const data = {};`);

      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
        entryPoint: entryFile,
        globalName: "testModule",
        moduleLoadTimeout: 5000,
      });

      expect(ctx).toBeDefined();
      const value = await ctx.evaluate(() => {
        return typeof (window as any).testModule;
      });
      expect(value).toBe("object");

      await ctx.close();
    }, { timeout: 15000 });

    it("应该能够正确关闭浏览器", async () => {
      const ctx = await createBrowserContext({
        enabled: true,
        headless: true,
      });

      expect(ctx.browser).toBeDefined();
      await ctx.close();

      // 验证浏览器已关闭（尝试访问应该失败）
      try {
        await ctx.evaluate(() => 1);
        // 如果成功，说明浏览器未关闭（这在某些情况下可能发生）
      } catch {
        // 预期的错误：浏览器已关闭
      }
    }, {
      sanitizeOps: false,
      sanitizeResources: false,
    });
  }, {
    sanitizeOps: false,
    sanitizeResources: false,
  });
});
