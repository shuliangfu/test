/**
 * @fileoverview 浏览器测试依赖管理模块测试
 */

import { getEsbuild, getPuppeteer } from "../../src/browser/dependencies.ts";
import { describe, expect, it } from "../../src/mod.ts";

describe("浏览器测试依赖管理", () => {
  describe("getPuppeteer", () => {
    it("应该返回 Puppeteer 模块", () => {
      const puppeteer = getPuppeteer();
      expect(puppeteer).toBeDefined();
      expect(typeof puppeteer.launch).toBe("function");
      expect(typeof puppeteer.connect).toBe("function");
    });

    it("应该返回相同的 Puppeteer 实例", () => {
      const puppeteer1 = getPuppeteer();
      const puppeteer2 = getPuppeteer();
      expect(puppeteer1).toBe(puppeteer2);
    });
  });

  describe("getEsbuild", () => {
    it("应该返回 esbuild 模块", () => {
      const esbuild = getEsbuild();
      expect(esbuild).toBeDefined();
      expect(typeof esbuild.build).toBe("function");
      expect(typeof esbuild.transform).toBe("function");
    });

    it("应该返回相同的 esbuild 实例", () => {
      const esbuild1 = getEsbuild();
      const esbuild2 = getEsbuild();
      expect(esbuild1).toBe(esbuild2);
    });
  });
});
