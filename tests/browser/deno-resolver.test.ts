/**
 * @fileoverview Deno 解析器插件测试
 * 测试 @dreamer/esbuild 的 Deno 解析器插件是否能正确解析 JSR 包的子路径导出
 */

import { buildBundle } from "@dreamer/esbuild";
import { join, mkdir, writeTextFile } from "@dreamer/runtime-adapter";
import { describe, expect, it } from "@dreamer/test";
import { logger } from "../../src/logger.ts";

describe("Deno 解析器插件", () => {
  let testDir: string;
  let entryFile: string;

  it("应该创建测试目录和测试文件", async () => {
    // 创建临时测试目录
    testDir = join(Deno.cwd(), "tests", "data", "deno-resolver");
    await mkdir(testDir, { recursive: true });

    // 创建测试入口文件，导入 @dreamer/logger/client
    entryFile = join(testDir, "test-entry.ts");
    await writeTextFile(
      entryFile,
      `import { createLogger } from "@dreamer/logger/client";

const logger = createLogger("test");
logger.info("Test message");

export { logger };
`,
    );

    expect(testDir).toBeTruthy();
  });

  it("应该能够解析 @dreamer/logger/client", async () => {
    try {
      // 启用调试模式查看解析过程
      const result = await buildBundle({
        entryPoint: entryFile,
        globalName: "TestClient",
        platform: "browser",
        format: "iife",
      });

      // 如果打包成功，说明解析器插件工作正常
      expect(result.code).toBeTruthy();
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.code).toContain("TestClient");
    } catch (error) {
      // 如果失败，输出详细错误信息
      logger.error("打包失败:", error);
      throw error;
    }
  });
}, {
  // esbuild 会启动子进程，禁用资源泄漏检查
  sanitizeOps: false,
  sanitizeResources: false,
});
