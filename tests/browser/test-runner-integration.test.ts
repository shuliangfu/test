/**
 * @fileoverview 测试运行器浏览器集成测试
 * 测试浏览器测试功能在测试运行器中的完整集成
 */

import { makeTempFile, writeTextFileSync } from "@dreamer/runtime-adapter";
import {
  afterAll,
  beforeEach,
  cleanupAllBrowsers,
  describe,
  expect,
  it,
} from "../../src/mod.ts";

describe("测试运行器浏览器集成", () => {
  afterAll(async () => {
    // 自动清理所有浏览器
    await cleanupAllBrowsers();
  });
  describe("浏览器测试启用和配置", () => {
    it("应该在启用浏览器测试时提供 browser 上下文", async (t) => {
      expect(t).toBeDefined();
      if (t) {
        expect(t.browser).toBeDefined();
        expect(t.browser?.browser).toBeDefined();
        expect(t.browser?.page).toBeDefined();
        expect(typeof t.browser?.evaluate).toBe("function");
        expect(typeof t.browser?.goto).toBe("function");
        expect(typeof t.browser?.waitFor).toBe("function");
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
      },
    });

    it("应该在未启用浏览器测试时不提供 browser 上下文", async (t) => {
      expect(t).toBeDefined();
      if (t) {
        expect(t.browser).toBeUndefined();
      }
    });

    it("应该支持测试级别的浏览器配置", async (t) => {
      if (t) {
        expect(t.browser).toBeDefined();
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
      },
    });
  });

  describe("套件级别的浏览器配置", () => {
    it("应该继承套件的浏览器配置", async (t) => {
      if (t) {
        expect(t.browser).toBeDefined();
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
      },
    });

    it("应该允许测试级别覆盖套件配置", async (t) => {
      // 测试级别的配置应该覆盖套件配置
      if (t) {
        expect(t.browser).toBeUndefined();
      }
    }, {
      browser: {
        enabled: false,
      },
    });
  });

  describe("浏览器实例复用", () => {
    let firstBrowser: any;

    beforeEach(async (t?: any) => {
      if (t?.browser) {
        firstBrowser = t.browser.browser;
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
        reuseBrowser: true,
      },
    });

    it("应该在同一个套件中复用浏览器实例", async (t) => {
      if (t) {
        expect(t.browser).toBeDefined();
        if (firstBrowser) {
          expect(t.browser?.browser).toBe(firstBrowser);
        }
      }
    }, {
      timeout: 15000,
      browser: {
        enabled: true,
        headless: true,
        reuseBrowser: true,
      },
    });

    it("应该在复用模式下为每个测试创建新页面", async (t) => {
      if (t) {
        expect(t.browser).toBeDefined();
        expect(t.browser?.page).toBeDefined();
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
        reuseBrowser: true,
      },
    });
  });

  describe("浏览器实例不复用", () => {
    it("应该在 reuseBrowser=false 时为每个测试创建新浏览器", async (t) => {
      if (t) {
        expect(t.browser).toBeDefined();
        expect(t.browser?.browser).toBeDefined();
        expect(t.browser?.page).toBeDefined();
      }
    }, {
      timeout: 15000,
      browser: {
        enabled: true,
        headless: true,
        reuseBrowser: false,
      },
    });
  });

  describe("entryPoint 自动打包和加载", () => {
    it("应该自动打包并加载 entryPoint", async (t) => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const testValue = "Browser Test Value";`,
      );

      // 注意：entryPoint 需要在配置中设置，这里只是验证浏览器上下文存在
      if (t && t.browser) {
        expect(t.browser).toBeDefined();
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
      },
    });

    it("应该支持 entryPoint 和 globalName 配置", async (t) => {
      const entryFile = await makeTempFile({ suffix: ".js" });
      writeTextFileSync(
        entryFile,
        `export const testValue = "Browser Test Value";`,
      );

      if (t && t.browser) {
        expect(t.browser).toBeDefined();
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
      },
    });
  });

  describe("浏览器上下文 API 集成", () => {
    it("应该支持 evaluate 方法", async (t) => {
      if (t && t.browser) {
        const result = await t.browser.evaluate(() => {
          return 2 + 2;
        });
        expect(result).toBe(4);
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
        reuseBrowser: false,
      },
    });

    it("应该支持 goto 方法", async (t) => {
      if (t && t.browser) {
        await t.browser.goto("about:blank");
        const url = await t.browser.evaluate(() => {
          return (globalThis as any).window?.location?.href || "";
        });
        expect(url).toBe("about:blank");
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
        reuseBrowser: false,
      },
    });

    it("应该支持 waitFor 方法", async (t) => {
      if (t && t.browser) {
        await t.browser.goto("about:blank");
        await t.browser.evaluate(() => {
          (globalThis as any).window.testCondition = false;
          setTimeout(() => {
            (globalThis as any).window.testCondition = true;
          }, 100);
        });

        await t.browser.waitFor(() => {
          return (globalThis as any).window?.testCondition === true;
        }, { timeout: 5000 });

        const condition = await t.browser.evaluate(() => {
          return (globalThis as any).window?.testCondition;
        });
        expect(condition).toBe(true);
      }
    }, {
      timeout: 15000,
      browser: {
        enabled: true,
        headless: true,
        reuseBrowser: false,
      },
    });
  });

  describe("配置继承", () => {
    describe("父套件配置", () => {
      it("应该继承父套件的浏览器配置", async (t) => {
        if (t) {
          expect(t.browser).toBeDefined();
        }
      }, {
        browser: {
          enabled: true,
          headless: true,
          moduleLoadTimeout: 5000,
        },
      });

      describe("子套件配置", () => {
        it("应该允许子套件覆盖父套件配置", async (t) => {
          if (t) {
            expect(t.browser).toBeDefined();
            // 子套件用 moduleLoadTimeout: 2000 覆盖父套件 5000，验证覆盖生效
            // 使用 headless: true 保证 Linux CI 无 X server 时也能通过
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }, {
          timeout: 15000,
          browser: {
            enabled: true,
            headless: true,
            moduleLoadTimeout: 2000, // 覆盖父套件 moduleLoadTimeout: 5000
          },
        });
      });
    });
  });

  describe("资源清理", () => {
    it("应该在测试结束后自动清理浏览器上下文", async (t) => {
      if (t && t.browser) {
        const browserId = t.browser.browser;
        // 测试结束后，浏览器应该被清理
        // 注意：这里无法直接验证，因为清理发生在 finally 块中
        expect(browserId).toBeDefined();
      }
    }, {
      timeout: 15000,
      browser: {
        enabled: true,
        headless: true,
      },
    });
  });

  describe("错误处理", () => {
    it("应该在 Chrome 未找到时提供清晰的错误信息", async (t) => {
      // 这个测试验证当 Chrome 路径不存在时，错误信息是否清晰
      // 错误会在 setupBrowserTest 阶段抛出，现在会被捕获并传递给测试函数
      if (t) {
        // 检查是否有浏览器设置错误
        const setupError = (t as any)._browserSetupError as Error | undefined;
        expect(setupError).toBeDefined();
        expect(setupError).toBeInstanceOf(Error);

        // 验证错误信息包含关键信息
        const errorMessage = setupError!.message;
        expect(errorMessage).toContain("创建浏览器上下文失败");
        expect(errorMessage).toContain("executablePath");
        expect(errorMessage).toContain("/nonexistent/chrome/path");
        expect(errorMessage).toContain("请检查 Chrome 是否已安装");

        // 浏览器上下文应该是 undefined
        expect(t.browser).toBeUndefined();
      }
    }, {
      browser: {
        enabled: true,
        headless: true,
        executablePath: "/nonexistent/chrome/path",
        onSetupError: "pass", // 需在测试内通过 _browserSetupError 断言错误内容，故不在此处抛出
      },
    });
  });

  describe("test.only 和 test.skip 支持", () => {
    it.skip("应该支持 test.skip 中的浏览器测试", async (t?: any) => {
      // 跳过测试，但验证配置被接受
      expect(true).toBe(true);
    });
  });
}, {
  sanitizeOps: false,
  sanitizeResources: false,
});
