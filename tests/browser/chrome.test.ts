/**
 * @fileoverview Chrome 路径检测模块测试
 */

import { findChromePath } from "../../src/browser/chrome.ts";
import { describe, expect, it } from "../../src/mod.ts";

describe("Chrome 路径检测", () => {
  describe("findChromePath", () => {
    it("应该返回字符串或 undefined", () => {
      const path = findChromePath();
      expect(typeof path === "string" || path === undefined).toBe(true);
    });

    it("如果找到 Chrome，应该返回有效路径", () => {
      const path = findChromePath();
      if (path) {
        expect(path.length).toBeGreaterThan(0);
        expect(path).toMatch(/chrome|chromium/i);
      }
    });

    it("应该快速执行", () => {
      const start = Date.now();
      findChromePath();
      const end = Date.now();
      // 应该很快完成（< 100ms）
      expect(end - start).toBeLessThan(100);
    });
  });
});
