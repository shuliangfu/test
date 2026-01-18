# 客户端浏览器测试集成分析文档（方案二：集成到测试运行器）

## 📋 概述

本文档分析如何在 `@dreamer/test` 测试库中集成 Puppeteer 客户端测试功能，通过将浏览器测试功能直接集成到测试运行器中，实现完全自动化的浏览器测试体验。

---

## 🎯 目标

1. **无缝集成**：浏览器测试与普通测试使用相同的 API，无需额外学习
2. **自动管理**：自动管理浏览器生命周期，无需手动创建和关闭
3. **统一体验**：支持 beforeEach/afterEach 钩子，与现有测试完全一致
4. **可选功能**：Puppeteer 作为可选依赖，不影响不使用浏览器测试的项目
5. **兼容性**：支持 Deno 和 Bun 运行时

---

## 📊 现状分析

### 当前测试库架构

```
@dreamer/test
├── src/
│   ├── mod.ts              # 主入口，导出所有 API
│   ├── test-runner.ts      # 测试运行器（describe, it, test）
│   ├── expect.ts           # 断言增强
│   ├── mock.ts             # Mock 功能
│   ├── mock-fetch.ts       # HTTP Mock
│   ├── assertions.ts       # 断言工具函数
│   ├── snapshot.ts         # 快照测试
│   ├── test-utils.ts       # 测试工具函数
│   └── types.ts            # 类型定义
```

### 现有浏览器测试实现模式

通过分析 `logger`、`webrtc`、`video-player` 等项目的浏览器测试实现，发现以下共同模式：

#### 1. 依赖导入模式
```typescript
// 静态导入依赖
import puppeteer from "npm:puppeteer@^24.35.0";
import * as esbuild from "npm:esbuild@^0.24.0";
```

#### 2. Chrome 路径检测（跨平台支持）
```typescript
// 使用 runtime-adapter 检测系统 Chrome
const macChromePaths = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const linuxChromePaths = [
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];
const windowsChromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
// 合并所有路径并使用 existsSync 检查
const allPaths = [...macChromePaths, ...linuxChromePaths, ...windowsChromePaths];
for (const path of allPaths) {
  if (existsSync(path)) {
    executablePath = path;
    break;
  }
}
```

#### 3. 代码打包模式
```typescript
// 使用 esbuild 将客户端代码打包为浏览器兼容格式
const buildResult = await esbuild.build({
  entryPoints: [clientModulePath],
  bundle: true,
  format: "iife",        // 立即执行函数表达式
  platform: "browser",
  target: "es2020",
  globalName: "ModuleName",  // 全局变量名
});
```

#### 4. HTML 页面生成
```typescript
// 创建临时 HTML 文件
const testHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
  <div id="test-container"></div>
  <script>${bundleCode}</script>
</body>
</html>
`;
const htmlPath = await makeTempFile({ suffix: ".html" });
writeTextFileSync(htmlPath, testHtml);
```

#### 5. 测试执行模式
```typescript
// 加载页面并执行测试
await page.goto(`file://${htmlPath}`);
await page.waitForFunction(() => {
  return typeof window.ModuleName !== "undefined";
});

// 在浏览器中执行测试代码
const result = await page.evaluate(() => {
  const Module = (window as any).ModuleName;
  // 执行测试逻辑
  return testResult;
});
```

---

## 🏗️ 设计方案：集成到测试运行器

### 核心设计理念

将浏览器测试功能直接集成到测试运行器中，通过扩展 `TestOptions` 和 `TestContext`，使浏览器测试与普通测试使用完全相同的 API。

### 架构设计

```
src/
├── mod.ts                    # 主入口
├── test-runner.ts            # 测试运行器（扩展支持浏览器测试）
├── types.ts                  # 类型定义（扩展 TestOptions, TestContext）
├── browser/
│   ├── index.ts              # 浏览器测试模块入口
│   ├── browser-context.ts    # 浏览器上下文管理
│   ├── bundle.ts             # 代码打包工具
│   ├── page.ts               # 测试页面管理
│   ├── chrome.ts             # Chrome 路径检测
│   └── dependencies.ts       # 依赖加载
```

---

## 🎨 API 设计

### 1. 扩展 TestOptions

```typescript
/**
 * 浏览器测试配置
 */
export interface BrowserTestConfig {
  /** 是否启用浏览器测试（默认：false） */
  enabled?: boolean;
  /** 客户端代码入口文件路径 */
  entryPoint?: string;
  /** 全局变量名（IIFE 格式，默认：从 entryPoint 推断） */
  globalName?: string;
  /** 是否无头模式（默认：true） */
  headless?: boolean;
  /** Chrome 可执行文件路径（可选，自动检测） */
  executablePath?: string;
  /** Chrome 启动参数 */
  args?: string[];
  /** HTML 模板（可选） */
  htmlTemplate?: string;
  /** 额外的 HTML body 内容（可选） */
  bodyContent?: string;
  /** 等待模块加载的超时时间（毫秒，默认：10000） */
  moduleLoadTimeout?: number;
}

/**
 * 测试选项（扩展）
 */
export interface TestOptions {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否启用操作清理检查（默认：true） */
  sanitizeOps?: boolean;
  /** 是否启用资源清理检查（默认：true） */
  sanitizeResources?: boolean;
  /** 浏览器测试配置（可选） */
  browser?: BrowserTestConfig;
}
```

### 2. 扩展 TestContext

```typescript
/**
 * 测试上下文（扩展）
 */
export interface TestContext {
  name: string;
  origin: string;
  sanitizeExit: boolean;
  sanitizeOps: boolean;
  sanitizeResources: boolean;
  step<T>(name: string, fn: (t: TestContext) => Promise<T> | T): Promise<T>;

  /** 浏览器测试上下文（仅在 browser.enabled 为 true 时可用） */
  browser?: {
    /** Puppeteer Browser 实例 */
    browser: any;
    /** Puppeteer Page 实例 */
    page: any;
    /**
     * 在浏览器中执行代码
     * @param fn - 要在浏览器中执行的函数
     * @returns 执行结果
     */
    evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
    /**
     * 导航到指定 URL
     * @param url - 目标 URL
     */
    goto(url: string): Promise<void>;
    /**
     * 等待页面中的条件满足
     * @param fn - 条件函数
     * @param options - 等待选项
     */
    waitFor(fn: () => boolean, options?: { timeout?: number }): Promise<void>;
  };
}
```

### 3. 扩展 DescribeOptions

```typescript
/**
 * 测试套件选项（扩展）
 */
export interface DescribeOptions {
  /** 是否启用操作清理检查（默认：true） */
  sanitizeOps?: boolean;
  /** 是否启用资源清理检查（默认：true） */
  sanitizeResources?: boolean;
  /** 浏览器测试配置（可选，套件级别的默认配置） */
  browser?: BrowserTestConfig;
}
```

---

## 🔧 实现细节

### 1. 依赖管理模块

```typescript
// src/browser/dependencies.ts
/**
 * 导入 Puppeteer（静态导入）
 */
import puppeteer from "npm:puppeteer@^24.35.0";

/**
 * 导入 esbuild（静态导入）
 */
import * as esbuild from "npm:esbuild@^0.24.0";

/**
 * 获取 Puppeteer 模块
 *
 * @returns Puppeteer 模块
 */
export function getPuppeteer(): typeof puppeteer {
  return puppeteer;
}

/**
 * 获取 esbuild 模块
 *
 * @returns esbuild 模块
 */
export function getEsbuild(): typeof esbuild {
  return esbuild;
}
```

### 2. Chrome 路径检测模块

```typescript
// src/browser/chrome.ts
import { existsSync, statSync } from "@dreamer/runtime-adapter";

/**
 * Chrome 路径配置（跨平台）
 */
const CHROME_PATHS = {
  mac: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
  windows: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

/**
 * 检测系统 Chrome 可执行文件路径
 *
 * @returns Chrome 路径，如果未找到则返回 undefined
 */
export async function findChromePath(): Promise<string | undefined> {
  const allPaths = [
    ...CHROME_PATHS.mac,
    ...CHROME_PATHS.linux,
    ...CHROME_PATHS.windows,
  ];

  for (const path of allPaths) {
    try {
      if (existsSync(path)) {
        const stat = statSync(path);
        if (stat.isFile) {
          return path;
        }
      }
    } catch {
      // 继续检查下一个路径
    }
  }

  return undefined;
}
```

### 3. 代码打包模块

```typescript
// src/browser/bundle.ts
import { getEsbuild } from "./dependencies.ts";

/**
 * 客户端代码打包选项
 */
export interface BundleOptions {
  /** 入口文件路径 */
  entryPoint: string;
  /** 全局变量名（IIFE 格式） */
  globalName?: string;
  /** 目标平台（默认：browser） */
  platform?: "browser" | "node";
  /** 目标 ES 版本（默认：es2020） */
  target?: string;
  /** 是否压缩（默认：false） */
  minify?: boolean;
}

/**
 * 将客户端代码打包为浏览器兼容格式
 *
 * @param options - 打包选项
 * @returns 打包后的代码字符串
 */
export async function buildClientBundle(
  options: BundleOptions
): Promise<string> {
  const esbuild = getEsbuild();

  const buildResult = await esbuild.build({
    entryPoints: [options.entryPoint],
    bundle: true,
    format: "iife",
    platform: options.platform || "browser",
    target: options.target || "es2020",
    globalName: options.globalName,
    minify: options.minify || false,
    write: false,
    sourcemap: false,
  });

  return new TextDecoder().decode(buildResult.outputFiles[0].contents);
}
```

### 4. 测试页面创建模块

```typescript
// src/browser/page.ts
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
 * @param options - 页面选项
 * @returns HTML 文件路径
 */
export async function createTestPage(
  options: TestPageOptions
): Promise<string> {
  const template = options.template || DEFAULT_TEMPLATE;
  const html = template
    .replace("{{BUNDLE_CODE}}", options.bundleCode)
    .replace("{{BODY_CONTENT}}", options.bodyContent || "");

  const htmlPath = await makeTempFile({ suffix: ".html" });
  writeTextFileSync(htmlPath, html);

  return htmlPath;
}
```

### 5. 浏览器上下文管理模块

```typescript
// src/browser/browser-context.ts
import { getPuppeteer } from "./dependencies.ts";
import { findChromePath } from "./chrome.ts";
import { buildClientBundle } from "./bundle.ts";
import { createTestPage } from "./page.ts";
import type { BrowserTestConfig } from "../types.ts";

/**
 * 浏览器测试上下文
 */
export interface BrowserContext {
  browser: any;
  page: any;
  htmlPath: string;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  goto(url: string): Promise<void>;
  waitFor(fn: () => boolean, options?: { timeout?: number }): Promise<void>;
  close(): Promise<void>;
}

/**
 * 创建浏览器测试上下文
 *
 * @param config - 浏览器测试配置
 * @returns 浏览器测试上下文
 */
export async function createBrowserContext(
  config: BrowserTestConfig
): Promise<BrowserContext> {
  const puppeteer = getPuppeteer();

  // 检测 Chrome 路径
  const executablePath = config.executablePath || await findChromePath();

  // 启动浏览器
  const browser = await puppeteer.launch({
    headless: config.headless !== false,
    executablePath,
    args: config.args || [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  // 如果配置了 entryPoint，自动打包和创建页面
  let htmlPath: string | undefined;
  if (config.entryPoint) {
    // 打包客户端代码
    const bundle = await buildClientBundle({
      entryPoint: config.entryPoint,
      globalName: config.globalName,
    });

    // 创建测试页面
    htmlPath = await createTestPage({
      bundleCode: bundle,
      bodyContent: config.bodyContent,
      template: config.htmlTemplate,
    });

    // 加载页面
    await page.goto(`file://${htmlPath}`, {
      waitUntil: "networkidle0",
    });

    // 等待模块加载
    if (config.globalName) {
      await page.waitForFunction(
        () => {
          return typeof (window as any)[config.globalName!] !== "undefined" &&
            (window as any).testReady === true;
        },
        { timeout: config.moduleLoadTimeout || 10000 }
      );
    } else {
      await page.waitForFunction(
        () => (window as any).testReady === true,
        { timeout: config.moduleLoadTimeout || 10000 }
      );
    }
  }

  return {
    browser,
    page,
    htmlPath: htmlPath || "",
    async evaluate<T>(fn: () => T | Promise<T>): Promise<T> {
      return await page.evaluate(fn);
    },
    async goto(url: string): Promise<void> {
      await page.goto(url, { waitUntil: "networkidle0" });
    },
    async waitFor(
      fn: () => boolean,
      options?: { timeout?: number }
    ): Promise<void> {
      await page.waitForFunction(fn, {
        timeout: options?.timeout || 10000,
      });
    },
    async close(): Promise<void> {
      await page.close();
      await browser.close();
    },
  };
}
```

### 6. 测试运行器集成

```typescript
// src/test-runner.ts（修改部分）

import { createBrowserContext } from "./browser/browser-context.ts";
import type { BrowserTestConfig, TestOptions, TestContext } from "./types.ts";

/**
 * 检查测试选项是否启用了浏览器测试
 */
function hasBrowserTest(options?: TestOptions): boolean {
  return options?.browser?.enabled === true;
}

/**
 * 获取浏览器测试配置（从测试选项或套件选项继承）
 */
function getBrowserConfig(
  testOptions: TestOptions | undefined,
  suiteOptions: DescribeOptions | undefined
): BrowserTestConfig | undefined {
  // 优先使用测试选项中的配置
  if (testOptions?.browser) {
    return testOptions.browser;
  }
  // 其次使用套件选项中的配置
  if (suiteOptions?.browser) {
    return suiteOptions.browser;
  }
  return undefined;
}

/**
 * 在测试执行前设置浏览器上下文
 */
async function setupBrowserTest(
  config: BrowserTestConfig,
  testContext: TestContext
): Promise<void> {
  const browserCtx = await createBrowserContext(config);

  // 将浏览器上下文添加到 TestContext
  (testContext as any).browser = {
    browser: browserCtx.browser,
    page: browserCtx.page,
    evaluate: browserCtx.evaluate.bind(browserCtx),
    goto: browserCtx.goto.bind(browserCtx),
    waitFor: browserCtx.waitFor.bind(browserCtx),
  };

  // 保存浏览器上下文以便清理
  (testContext as any)._browserContext = browserCtx;
}

/**
 * 在测试执行后清理浏览器上下文
 */
async function cleanupBrowserTest(testContext: TestContext): Promise<void> {
  const browserCtx = (testContext as any)._browserContext;
  if (browserCtx) {
    await browserCtx.close();
    (testContext as any).browser = undefined;
    (testContext as any)._browserContext = undefined;
  }
}

// 在 test-runner.ts 的测试执行函数中集成
// 在 beforeEach 之后、测试函数执行之前
if (hasBrowserTest(testOptions)) {
  const browserConfig = getBrowserConfig(testOptions, suite.options);
  if (browserConfig) {
    await setupBrowserTest(browserConfig, testContext);
  }
}

// 在测试函数执行之后、afterEach 之前
try {
  await fn(testContext);
} finally {
  // 清理浏览器上下文
  if (hasBrowserTest(testOptions)) {
    await cleanupBrowserTest(testContext);
  }
}
```

---

## 💡 使用示例

### 基础使用（单个测试）

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("客户端测试", () => {
  it("应该在浏览器中创建实例", async (t) => {
    // 浏览器上下文自动可用
    const result = await t.browser!.evaluate(() => {
      const { createClient } = (window as any).MyClient;
      const client = createClient();
      return client !== null;
    });

    expect(result).toBe(true);
  }, {
    browser: {
      enabled: true,
      entryPoint: "./src/client/mod.ts",
      globalName: "MyClient",
    },
    sanitizeOps: false,
    sanitizeResources: false,
  });
});
```

### 套件级别配置

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("客户端测试套件", {
  browser: {
    enabled: true,
    entryPoint: "./src/client/mod.ts",
    globalName: "MyClient",
  },
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  it("应该在浏览器中创建实例", async (t) => {
    const result = await t.browser!.evaluate(() => {
      const { createClient } = (window as any).MyClient;
      return createClient() !== null;
    });

    expect(result).toBe(true);
  });

  it("应该支持自定义配置", async (t) => {
    const result = await t.browser!.evaluate(() => {
      const { createClient } = (window as any).MyClient;
      const client = createClient({ level: "debug" });
      return client.getLevel() === "debug";
    });

    expect(result).toBe(true);
  });
});
```

### 使用 beforeEach/afterEach

```typescript
import { describe, it, expect, beforeEach, afterEach } from "@dreamer/test";

describe("客户端测试", {
  browser: {
    enabled: true,
    entryPoint: "./src/client/mod.ts",
    globalName: "MyClient",
  },
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  beforeEach(async (t) => {
    // 浏览器上下文已经自动创建，可以直接使用
    await t.browser!.goto("http://localhost:3000");
  });

  it("应该加载页面", async (t) => {
    const title = await t.browser!.evaluate(() => {
      return document.title;
    });

    expect(title).toBe("测试页面");
  });
});
```

### 自定义 HTML 模板

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("客户端测试", {
  browser: {
    enabled: true,
    entryPoint: "./src/client/mod.ts",
    globalName: "MyClient",
    htmlTemplate: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>自定义测试页面</title>
      </head>
      <body>
        <div id="app"></div>
        {{BUNDLE_CODE}}
      </body>
      </html>
    `,
    bodyContent: '<div id="custom-container"></div>',
  },
}, () => {
  it("应该使用自定义模板", async (t) => {
    const hasCustomContainer = await t.browser!.evaluate(() => {
      return document.getElementById("custom-container") !== null;
    });

    expect(hasCustomContainer).toBe(true);
  });
});
```

### 混合测试（普通测试 + 浏览器测试）

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("混合测试套件", () => {
  // 普通测试（不使用浏览器）
  it("应该通过普通测试", () => {
    expect(1 + 1).toBe(2);
  });

  // 浏览器测试
  it("应该通过浏览器测试", async (t) => {
    const result = await t.browser!.evaluate(() => {
      return typeof window !== "undefined";
    });
    expect(result).toBe(true);
  }, {
    browser: {
      enabled: true,
      entryPoint: "./src/client/mod.ts",
      globalName: "MyClient",
    },
    sanitizeOps: false,
    sanitizeResources: false,
  });
});
```

---

## 🔄 配置继承机制

### 优先级规则

1. **测试用例选项** > **套件选项** > **默认值**
2. 子套件可以覆盖父套件的浏览器配置
3. 测试用例可以覆盖套件的浏览器配置

### 配置合并

```typescript
// 套件级别配置（默认配置）
describe("客户端测试", {
  browser: {
    enabled: true,
    entryPoint: "./src/client/mod.ts",
    globalName: "MyClient",
    headless: true,
  },
}, () => {
  // 测试用例可以覆盖部分配置
  it("测试1", async (t) => {
    // 使用套件的默认配置
  });

  it("测试2", async (t) => {
    // 覆盖 headless 配置
  }, {
    browser: {
      headless: false,  // 只覆盖这一个选项，其他继承套件配置
    },
  });
});
```

---

## 🔧 实现步骤

### 步骤 1：扩展类型定义

```typescript
// src/types.ts（修改）

export interface TestOptions {
  // ... 现有选项
  browser?: BrowserTestConfig;
}

export interface DescribeOptions {
  // ... 现有选项
  browser?: BrowserTestConfig;
}

export interface TestContext {
  // ... 现有属性
  browser?: {
    browser: any;
    page: any;
    evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
    goto(url: string): Promise<void>;
    waitFor(fn: () => boolean, options?: { timeout?: number }): Promise<void>;
  };
}

// 新增类型
export interface BrowserTestConfig {
  enabled?: boolean;
  entryPoint?: string;
  globalName?: string;
  headless?: boolean;
  executablePath?: string;
  args?: string[];
  htmlTemplate?: string;
  bodyContent?: string;
  moduleLoadTimeout?: number;
}
```

### 步骤 2：创建浏览器测试模块

创建 `src/browser/` 目录，实现以下文件：
- `dependencies.ts` - 依赖加载
- `chrome.ts` - Chrome 路径检测
- `bundle.ts` - 代码打包
- `page.ts` - 测试页面创建
- `browser-context.ts` - 浏览器上下文管理
- `index.ts` - 模块导出

### 步骤 3：修改测试运行器

在 `test-runner.ts` 中：
1. 导入浏览器测试模块
2. 在测试执行前检查 `browser.enabled`
3. 如果启用，自动创建浏览器上下文
4. 将浏览器上下文添加到 `TestContext`
5. 在测试执行后自动清理浏览器上下文

### 步骤 4：更新主入口

```typescript
// src/mod.ts
// ... 现有导出

// 浏览器测试模块（可选导出）
export type { BrowserTestConfig } from "./types.ts";
```

---

## ⚠️ 注意事项

### 1. 依赖安装

用户需要手动安装 Puppeteer 和 esbuild：

```bash
deno add npm:puppeteer@^24.35.0
deno add npm:esbuild@^0.24.0
```

### 2. Chrome 安装

需要系统安装 Chrome/Chromium，或使用 Puppeteer 自动下载：

```bash
npx puppeteer browsers install chrome
```

### 3. 资源清理

浏览器测试会产生定时器和资源，测试运行器会自动设置：

```typescript
// 当 browser.enabled 为 true 时，自动设置
sanitizeOps: false,
sanitizeResources: false,
```

### 4. 性能考虑

- 浏览器测试比单元测试慢
- 建议将浏览器测试与单元测试分开
- 可以使用 `test.skip` 跳过浏览器测试

### 5. 错误处理

- 如果 Puppeteer 或 esbuild 未安装，会抛出清晰的错误信息
- 如果 Chrome 未找到，会尝试使用 Puppeteer 自动下载的版本
- 如果模块加载超时，会抛出超时错误

---

## 📋 实施计划

### 阶段一：核心功能

1. ⏳ 扩展 `types.ts`，添加 `BrowserTestConfig` 和扩展 `TestOptions`、`TestContext`
2. ⏳ 创建 `src/browser/` 目录结构
3. ⏳ 实现 `dependencies.ts`（依赖加载）
4. ⏳ 实现 `chrome.ts`（Chrome 路径检测，跨平台支持）
5. ⏳ 实现 `bundle.ts`（代码打包）
6. ⏳ 实现 `page.ts`（测试页面创建）
7. ⏳ 实现 `browser-context.ts`（浏览器上下文管理）

### 阶段二：测试运行器集成

1. ⏳ 修改 `test-runner.ts`，添加浏览器测试检测逻辑
2. ⏳ 在测试执行前自动创建浏览器上下文
3. ⏳ 在测试执行后自动清理浏览器上下文
4. ⏳ 支持配置继承（测试用例 > 套件 > 默认值）
5. ⏳ 处理错误情况（依赖未安装、Chrome 未找到等）

### 阶段三：测试和文档

1. ⏳ 编写浏览器测试的测试用例
2. ⏳ 更新 README.md，添加浏览器测试使用说明
3. ⏳ 创建使用示例
4. ⏳ 更新类型定义文档

---

## 🎯 优势总结

1. **无缝集成**：与现有测试 API 完全一致，无需学习新 API
2. **自动管理**：浏览器生命周期完全自动化，无需手动管理
3. **统一体验**：支持所有现有功能（beforeEach、afterEach、嵌套套件等）
4. **配置灵活**：支持测试用例级别和套件级别的配置
5. **可选功能**：不影响不使用浏览器测试的项目
6. **兼容性**：支持 Deno 和 Bun 运行时

---

## 📝 结论

通过将浏览器测试功能集成到测试运行器中，可以实现完全自动化的浏览器测试体验。用户只需要在测试选项中配置 `browser.enabled: true`，测试运行器就会自动处理所有浏览器相关的操作，包括：

- 自动加载 Puppeteer 和 esbuild
- 自动检测 Chrome 路径
- 自动打包客户端代码
- 自动创建测试页面
- 自动启动浏览器
- 自动加载页面和等待模块
- 自动清理浏览器资源

这样既满足了浏览器测试的需求，又保持了与现有测试 API 的完全一致性。
