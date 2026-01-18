/**
 * @fileoverview 客户端代码打包模块测试
 */

import { makeTempFile, writeTextFileSync } from "@dreamer/runtime-adapter";
import { buildClientBundle } from "../../src/browser/bundle.ts";
import { describe, expect, it } from "../../src/mod.ts";

describe("客户端代码打包", () => {
  describe("buildClientBundle", () => {
    it("应该能够打包简单的 JavaScript 代码", async () => {
      // 创建临时入口文件
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const testValue = "Hello, World!";`,
      );

      const bundle = await buildClientBundle({
        entryPoint: entryFile,
      });

      expect(bundle).toBeDefined();
      expect(typeof bundle).toBe("string");
      expect(bundle.length).toBeGreaterThan(0);
    }, { timeout: 10000 });

    it("应该支持 globalName 选项", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const testValue = "Hello, World!";`,
      );

      const bundle = await buildClientBundle({
        entryPoint: entryFile,
        globalName: "TestModule",
      });

      expect(bundle).toContain("TestModule");
    }, { timeout: 10000 });

    it("应该支持 minify 选项", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const testValue = "Hello, World!";`,
      );

      const bundleMinified = await buildClientBundle({
        entryPoint: entryFile,
        minify: true,
      });

      const bundleNotMinified = await buildClientBundle({
        entryPoint: entryFile,
        minify: false,
      });

      // 压缩后的代码应该更短（或相等）
      expect(bundleMinified.length).toBeLessThanOrEqual(
        bundleNotMinified.length,
      );
    }, { timeout: 10000 });

    it("应该支持 platform 选项", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const testValue = "Hello, World!";`,
      );

      const browserBundle = await buildClientBundle({
        entryPoint: entryFile,
        platform: "browser",
      });

      const nodeBundle = await buildClientBundle({
        entryPoint: entryFile,
        platform: "node",
      });

      expect(browserBundle).toBeDefined();
      expect(nodeBundle).toBeDefined();
      // 两种平台的打包结果可能不同
      expect(typeof browserBundle).toBe("string");
      expect(typeof nodeBundle).toBe("string");
    }, { timeout: 10000 });

    it("应该支持 target 选项", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const testValue = "Hello, World!";`,
      );

      const bundle = await buildClientBundle({
        entryPoint: entryFile,
        target: "es2020",
      });

      expect(bundle).toBeDefined();
      expect(typeof bundle).toBe("string");
    }, { timeout: 10000 });

    it("应该处理 TypeScript 代码", async () => {
      const entryFile = await makeTempFile({ suffix: ".ts" });
      writeTextFileSync(
        entryFile,
        `export const testValue: string = "Hello, World!";`,
      );

      const bundle = await buildClientBundle({
        entryPoint: entryFile,
      });

      expect(bundle).toBeDefined();
      expect(typeof bundle).toBe("string");
      expect(bundle.length).toBeGreaterThan(0);
    }, { timeout: 10000 });

    it("应该处理包含多个导出的模块", async () => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const a = 1;
export const b = 2;
export function sum(x, y) { return x + y; }`,
      );

      const bundle = await buildClientBundle({
        entryPoint: entryFile,
        globalName: "TestModule",
      });

      expect(bundle).toBeDefined();
      expect(bundle).toContain("TestModule");
    }, { timeout: 10000 });
  }, {
    sanitizeOps: false,
    sanitizeResources: false,
  });
});
