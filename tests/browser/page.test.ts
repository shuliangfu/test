/**
 * @fileoverview 测试页面创建模块测试
 */

import { existsSync, readTextFileSync } from "@dreamer/runtime-adapter";
import { createTestPage } from "../../src/browser/page.ts";
import { describe, expect, it } from "../../src/mod.ts";

describe("测试页面创建", () => {
  describe("createTestPage", () => {
    it("应该创建 HTML 文件", async () => {
      const htmlPath = await createTestPage({
        bundleCode: "console.log('test');",
      });

      expect(htmlPath).toBeDefined();
      expect(typeof htmlPath).toBe("string");
      expect(existsSync(htmlPath)).toBe(true);
    });

    it("应该包含打包后的代码", async () => {
      const testCode = "console.log('Hello, World!');";
      const htmlPath = await createTestPage({
        bundleCode: testCode,
      });

      const html = readTextFileSync(htmlPath);
      expect(html).toContain(testCode);
    });

    it("应该使用默认模板", async () => {
      const htmlPath = await createTestPage({
        bundleCode: "console.log('test');",
      });

      const html = readTextFileSync(htmlPath);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html>");
      expect(html).toContain("<head>");
      expect(html).toContain("<body>");
      expect(html).toContain("test-container");
    });

    it("应该支持自定义 bodyContent", async () => {
      const customBody = '<div id="custom-app">Custom Content</div>';
      const htmlPath = await createTestPage({
        bundleCode: "console.log('test');",
        bodyContent: customBody,
      });

      const html = readTextFileSync(htmlPath);
      expect(html).toContain(customBody);
    });

    it("应该支持自定义模板", async () => {
      const customTemplate = `<!DOCTYPE html>
<html>
<head>
  <title>Custom Test</title>
</head>
<body>
  {{BODY_CONTENT}}
  <script>
    {{BUNDLE_CODE}}
  </script>
</body>
</html>`;

      const htmlPath = await createTestPage({
        bundleCode: "console.log('test');",
        template: customTemplate,
      });

      const html = readTextFileSync(htmlPath);
      expect(html).toContain("Custom Test");
      expect(html).toContain("console.log('test');");
    });

    it("应该替换模板中的所有占位符", async () => {
      const bundleCode = "const x = 1;";
      const bodyContent = "<div>Test</div>";
      const htmlPath = await createTestPage({
        bundleCode,
        bodyContent,
      });

      const html = readTextFileSync(htmlPath);
      expect(html).not.toContain("{{BUNDLE_CODE}}");
      expect(html).not.toContain("{{BODY_CONTENT}}");
      expect(html).toContain(bundleCode);
      expect(html).toContain(bodyContent);
    });

    it("应该包含 testReady 标记", async () => {
      const htmlPath = await createTestPage({
        bundleCode: "console.log('test');",
      });

      const html = readTextFileSync(htmlPath);
      expect(html).toContain("testReady");
      expect(html).toContain("window.testReady = true");
    });
  });
});
