/**
 * @fileoverview 浏览器测试依赖管理模块测试
 */

import {
  getBuildBundle,
  getChromium,
  getPlaywright,
} from "../../src/browser/dependencies.ts";
import { describe, expect, it } from "../../src/mod.ts";

describe("浏览器测试依赖管理", () => {
  describe("getPlaywright", () => {
    it("应该返回 Playwright 模块", () => {
      const pw = getPlaywright();
      expect(pw).toBeDefined();
      expect(pw.chromium).toBeDefined();
      expect(typeof pw.chromium.launch).toBe("function");
    });

    it("应该返回相同的 Playwright 实例", () => {
      const pw1 = getPlaywright();
      const pw2 = getPlaywright();
      expect(pw1).toBe(pw2);
    });
  });

  describe("getChromium", () => {
    it("应该返回 Chromium 对象且可 launch", () => {
      const chromium = getChromium();
      expect(chromium).toBeDefined();
      expect(typeof chromium.launch).toBe("function");
    });

    it("应该返回相同的 Chromium 实例", () => {
      const c1 = getChromium();
      const c2 = getChromium();
      expect(c1).toBe(c2);
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
