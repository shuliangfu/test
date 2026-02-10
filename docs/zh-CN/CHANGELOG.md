# 变更日志

本文件记录 @dreamer/test 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.3] - 2026-02-10

### 新增

- **Playwright**：浏览器测试改为使用 Playwright（需执行
  `npx playwright install chromium`）。新增配置项 `browserType` （`"chromium"` |
  `"firefox"` | `"webkit"`）。
- **`clearBundleCache()`**：已纳入文档并补充测试。
- **文档结构**：文档迁至 `docs/en-US` 与 `docs/zh-CN`，根目录 README
  链接至各语言 README 与测试报告。

### 变更

- **浏览器引擎**：由 Puppeteer 切换为 Playwright（默认 Chromium）。
- **`browserSource`**：仅保留 `"system"` | `"test"`（移除 `"chromium"`）。
- **依赖**：移除 `getPuppeteer`，请使用 `getPlaywright()` 与 `getChromium()`（从
  `@dreamer/test/browser` 导入）。

---

## [1.0.2] - 2026-02-09

### 新增

- **`@dreamer/test/browser` 子路径导出**：浏览器 API（`createBrowserContext`、
  `findChromePath`、`buildClientBundle` 等）现可通过
  `import { findChromePath } from "@dreamer/test/browser"` 或
  `jsr:@dreamer/test/browser` 导入
- **`findChromePath()`**：用于检测系统 Chrome 路径的辅助函数，在需要可视调试
  （`headless: false`）时传入 `executablePath` 使用

### 变更

- **默认 Chrome**：未传入 `executablePath` 时，使用 Puppeteer 自带的 Chrome for
  Testing，不再自动检测系统 Chrome
- **文档**：在 README 中新增导入路径说明及 `findChromePath` 使用示例

---

## [1.0.1] - 2026-02-08

### 修复

- **Linux CI 兼容性**：在配置覆盖测试中使用 headless 模式，避免 Linux CI
  运行器出现 "Missing X server" 错误

### 变更

- **错误信息**：测试包中所有错误输出已改为英文

### 移除

- **Socket.IO 测试**：移除所有 socket-io 集成测试及相关文档

---

## [1.0.0] - 2026-02-06

### 新增

- **稳定版发布**：首个稳定版本，API 稳定
- **Mock 工具**：
  - 函数 Mock（`mockFn`），支持调用次数和参数校验
  - HTTP Mock（`mockFetch`），用于请求/响应模拟
- **断言增强**：
  - 丰富断言方法（`expect`、`assertSnapshot`、`assertRejects` 等）
  - 类型检查断言（`toBeArray`、`toBeString`、`toBeNumber` 等）
  - 属性断言（`toHaveProperty`、`toHaveLength`）
  - 否定断言（`.not`）
- **测试工具函数**：
  - 设置/清理（`beforeAll`、`afterAll`、`beforeEach`、`afterEach`）
  - 参数化测试（`testEach`）
  - 基准测试（`bench`）
- **浏览器测试集成**：
  - 通过 Puppeteer 自动创建浏览器上下文
  - 自动打包客户端代码（@dreamer/esbuild）
  - Deno/Bun 解析器插件支持（JSR、npm、相对路径、路径别名）
  - 页面操作 API（`evaluate`、`goto`、`waitFor`）
  - 浏览器实例复用
  - 自动资源清理（`cleanupAllBrowsers`）
- **测试组织**：
  - 测试套件（`describe`）
  - 测试用例（`it`、`test`）
  - 跳过测试（`test.skip`）、条件跳过（`test.skipIf`）、仅运行（`test.only`）
- **资源清理控制**：
  - `sanitizeOps` 用于定时器泄漏检查
  - `sanitizeResources` 用于资源句柄泄漏检查

### 兼容性

- Deno 2.5+
- Bun 1.0+
- 通过 Puppeteer 集成的浏览器测试
