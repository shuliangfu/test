/**
 * @fileoverview 浏览器测试依赖管理模块测试
 */

import {
  getBuildBundle,
  getPuppeteer,
} from "../../src/browser/dependencies.ts";
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

  describe("getBuildBundle", () => {
    it("应该返回 buildBundle 函数", () => {
      const buildBundle = getBuildBundle();
      expect(buildBundle).toBeDefined();
      expect(typeof buildBundle).toBe("function");
    });

    it("应该返回相同的 buildBundle 函数", () => {
      const buildBundle1 = getBuildBundle();
      const buildBundle2 = getBuildBundle();
      expect(buildBundle1).toBe(buildBundle2);
    });
  });
});
