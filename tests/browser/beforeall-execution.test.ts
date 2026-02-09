/**
 * @fileoverview 测试 beforeAll 在浏览器测试中的执行次数
 * 验证 beforeAll 是否只执行一次，特别是在有嵌套套件的情况下
 */

import { RUNTIME } from "@dreamer/runtime-adapter";
import { afterAll, beforeAll, describe, expect, it } from "../../src/mod.ts";

// 用于跟踪 beforeAll 执行次数
let beforeAllCallCount = 0;
let testPort = 30001;

describe(`浏览器测试 - beforeAll 执行测试 (${RUNTIME})`, () => {
  // 在所有测试前执行
  beforeAll(async () => {
    console.log(
      `[${RUNTIME}] beforeAll 启动服务器....................... beforeAll`,
    );
    beforeAllCallCount++;
    // 模拟服务器启动
    await new Promise((resolve) => setTimeout(resolve, 10));
    console.log(`[${RUNTIME}] 服务器已启动: http://localhost:${testPort}`);
  });

  // 在所有测试后执行
  afterAll(async () => {
    console.log(
      `[${RUNTIME}] afterAll 关闭服务器....................... afterAll`,
    );
    // 模拟服务器关闭
    await new Promise((resolve) => setTimeout(resolve, 10));
    console.log(`[${RUNTIME}] 服务器已关闭`);
  });

  describe("嵌套套件 1", () => {
    it("测试 1: 验证 beforeAll 只执行一次", async (t) => {
      expect(beforeAllCallCount).toBe(1);
    }, {
      timeout: 10000,
      browser: {
        enabled: true,
        headless: true,
      },
    });

    it("测试 2: 验证 beforeAll 只执行一次", async (t) => {
      expect(beforeAllCallCount).toBe(1);
    }, {
      timeout: 10000,
      browser: {
        enabled: true,
        headless: true,
      },
    });

    it("测试 3: 验证 beforeAll 只执行一次", async (t) => {
      expect(beforeAllCallCount).toBe(1);
    }, {
      timeout: 10000,
      browser: {
        enabled: true,
        headless: true,
      },
    });
  });

  describe("嵌套套件 2", () => {
    it("测试 4: 验证 beforeAll 只执行一次", async (t) => {
      expect(beforeAllCallCount).toBe(1);
    }, {
      timeout: 10000,
      browser: {
        enabled: true,
        headless: true,
      },
    });

    it("测试 5: 验证 beforeAll 只执行一次", async (t) => {
      expect(beforeAllCallCount).toBe(1);
    }, {
      timeout: 10000,
      browser: {
        enabled: true,
        headless: true,
      },
    });
  });
}, { sanitizeOps: false, sanitizeResources: false });
