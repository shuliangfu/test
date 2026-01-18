/**
 * @module @dreamer/test/browser/page
 *
 * @fileoverview 测试页面创建工具
 * 创建包含客户端代码的 HTML 测试页面
 */

import { makeTempFile, writeTextFileSync } from "@dreamer/runtime-adapter";

/**
 * 默认 HTML 模板
 */
const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Browser Test</title>
</head>
<body>
  <div id="test-container"></div>
  {{BODY_CONTENT}}
  <script>
    {{BUNDLE_CODE}}

    // 标记模块已加载
    if (typeof window !== 'undefined') {
      window.testReady = true;
    }
  </script>
</body>
</html>`;

/**
 * 测试页面选项
 */
export interface TestPageOptions {
  /** 打包后的客户端代码 */
  bundleCode: string;
  /** HTML 模板（可选） */
  template?: string;
  /** 额外的 HTML body 内容（可选） */
  bodyContent?: string;
}

/**
 * 创建测试 HTML 页面
 *
 * 根据提供的模板和代码创建临时 HTML 文件，用于浏览器测试。
 *
 * @param options - 页面选项
 * @returns HTML 文件路径
 *
 * @example
 * ```typescript
 * import { createTestPage, buildClientBundle } from "@dreamer/test/browser";
 *
 * const bundle = await buildClientBundle({
 *   entryPoint: "./src/client/mod.ts",
 *   globalName: "MyClient",
 * });
 *
 * const htmlPath = await createTestPage({
 *   bundleCode: bundle,
 *   bodyContent: '<div id="app"></div>',
 * });
 * ```
 */
export async function createTestPage(
  options: TestPageOptions,
): Promise<string> {
  const template = options.template || DEFAULT_TEMPLATE;
  const html = template
    .replace("{{BUNDLE_CODE}}", options.bundleCode)
    .replace("{{BODY_CONTENT}}", options.bodyContent || "");

  const htmlPath = await makeTempFile({ suffix: ".html" });
  writeTextFileSync(htmlPath, html);

  return htmlPath;
}
