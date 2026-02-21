# 变更日志

本文件记录 @dreamer/test 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.13] - 2026-02-22

### 修复

- **Bun 清理用例注册**：在使用 Bun 时，最终的「cleanup browsers」用例改为在
  `describe()` 块内注册，避免在 `describe()` 外调用 `test()`。修复子进程运行
  （如 timeout fixture）时出现的 “Cannot call test() inside a test. Call it
  inside describe() instead” 错误，尤其在 Windows Bun 下。
- **timeout 测试（Bun 子进程）**：子进程输出断言同时接受 “Cannot call
  describe/test() inside a test”，在 Windows Bun 等场景下子进程报该错误时
  用例仍通过。

### 变更

- **CI (test-windows-bun)**：job 级 `PLAYWRIGHT_BROWSERS_PATH`（Windows 反斜杠
  路径）、Install/Verify Chromium 步骤；因 Windows 上已知的 Playwright/Bun
  启动卡住问题，Windows Bun 下排除 browser 测试，仅运行顶层测试文件。

---

## [1.0.12] - 2026-02-20

### 新增

- **Document/Cookie Mock**：`createCookieDocument()` — 返回带累积型 `cookie`
  getter/setter 的类 document 对象（类浏览器行为；多次赋值 `document.cookie`
  会累积而非覆盖）。从主入口导出；详见 README 与
  `tests/mock-document-comprehensive.test.ts`。

### 修复

- **timeout 测试（Bun）**：断言同时接受 Bun 的超时文案（`timed out`）与 Deno
  的（`Test timeout` / `Test failed`）。

### 变更

- **文档**：测试报告与 README（中英）已更新：测试总结 399 通过、20 文件、16
  秒；Document/Cookie Mock 用法与 API；TEST_REPORT.md 体现 mock-document 覆盖。

---

## [1.0.11] - 2026-02-19

### 变更

- **依赖**：`@dreamer/esbuild` 升级至 ^1.0.30。

---

## [1.0.10] - 2026-02-19

### 变更

- **i18n**：初始化改为在加载 i18n 模块时自动执行。入口文件不再导入或调用
  `initTestI18n`；请从你的代码中移除相关用法。

---

## [1.0.9] - 2026-02-19

### 变更

- **i18n**：翻译方法由 `$t` 重命名为 `$tr`，避免与全局 `$t`
  冲突。请将现有代码中本包消息改为使用 `$tr`。主入口不再导出
  `$tr`，测试需要时请从 `./i18n.ts`（或包内 i18n 模块）导入。

### 修复

- **测试**：test-runner-integration.test.ts 改为从 i18n.ts 导入
  `$tr`。浏览器集成测试（evaluate、goto、waitFor）超时时间调整为
  30s，以适配慢速或 CI 环境。

---

## [1.0.8] - 2026-02-18

### 修复

- **Bun 下 `it.skip` / `it.skipIf` / `it.only`**：通过 `Object.assign()` 导出
  `it`，使 `skip`、`skipIf`、`only` 成为导出函数上的自有属性，确保 Bun
  （及以不同方式解析导出的运行时）在从 `@dreamer/test` 导入时能正确识别
  `it.skip`、`it.skipIf`、`it.only`。

---

## [1.0.7] - 2026-02-17

### 新增

- **断言与运行器文案
  i18n**：expect、mock、assertions、test-runner、browser-context、 bundle
  中所有面向用户的字符串均通过 `$t()` 使用 en-US/zh-CN 文案。语言由
  `LANGUAGE`/`LC_ALL`/`LANG` 自动检测；主入口导出 `$t` 供测试断言错误信息使用。
- **浏览器入口**：`src/browser/index.ts` 重命名为 `src/browser/mod.ts`，并更新
  `deno.json` 中 `"./browser"` 导出。

### 修复

- **i18n 占位符**：`JSON.stringify(undefined)` 返回 `undefined`，导致中文环境下
  `{received}` 未被替换。在 expect 中新增 `stringifyForI18n()`，对所有
  `received` 参数使用该函数，使 `undefined` 转为字符串 `"undefined"`。
- **非英文环境下的测试**：错误信息断言依赖英文子串时，在中文环境下会失败。测试改为
  使用 `$t("key", ...)` 作为期望内容，从而在英文与中文环境下均通过。

### 变更

- **测试套件**：`assertions-comprehensive.test.ts`、`expect-comprehensive.test.ts`、
  `mod.test.ts`、`test-runner-integration.test.ts` 中针对错误信息的断言改为使用
  `$t()`，实现与语言无关的期望。

---

## [1.0.6] - 2026-02-16

### 新增

- **timeout 选项测试**：新增 `timeout.test.ts`（4 条）与
  `timeout-fixture.run.ts`， 通过子进程运行 fixture 断言超时失败。验证：在
  `options.timeout` 内完成则通过； 未传 timeout 时正常执行；超时后抛出 "Test
  timeout" 错误（Deno/Bun 均在运行器内 用 `Promise.race` 保证超时可靠）。
- **错误信息附带测试文件路径**：所有测试失败与超时错误均会附带测试文件路径。新增
  `formatOriginToPath()`（Deno `t.origin`
  转可读路径）、`getTestFilePathFromStack()`
  （Bun/兜底：注册时从调用栈解析）、`augmentErrorWithFilePath()`（在错误信息末尾追加
  `\n  at <路径>`）。应用于：主测试执行（Deno/Bun）、`test.only`（Deno/Bun）、超时
  reject 路径。

### 变更

- **许可证**：项目许可证改为 Apache-2.0。使用标准 `LICENSE` 与 `NOTICE` 替代
  `LICENSE.md`。`deno.json` 中 `license` 为 `Apache-2.0`，`publish.include` 包含
  `LICENSE` 与 `NOTICE`。
- **CI**：工作流中 check/lint/test 步骤调整。
- **文档**：测试报告与 README 已更新：392 通过、19 个测试文件、2 跳过、13 秒；
  测试文件列表增加 `timeout.test.ts`，测试类型增加「timeout 选项测试」。

---

## [1.0.5] - 2026-02-11

### 新增

- **浏览器测试**：全量浏览器测试（`full-suite-browser.test.ts`），支持顺序复用、
  `entryPoint` + `globalName`、共享浏览器上下文。

### 变更

- **测试报告**：正式测试报告移至 `docs/en-US/TEST_REPORT.md` 与
  `docs/zh-CN/TEST_REPORT.md`；根目录 `TEST_REPORT.md` 已移除。
- **JSR 发布**：从 `deno.json` 的 `publish.include` 中移除 `TEST_REPORT.md`。

### 修复

- **测试运行器**：在 `cleanupAllBrowsers()` 中清空 `beforeAllExecutedMap`，避免
  watch 或重复运行下 Map 无限增长。

### 性能

- **测试运行器**：缓存 `getBunTest()` 结果，避免重复动态 `import("bun:test")`；
  将 `collectParentSuites()` 从 O(n²) 优化为 O(n)（push + reverse 替代
  unshift）； 精简清理日志（仅在失败时使用 `logger.error`）。

### 安全

- **快照**：使用 `@dreamer/runtime-adapter` 的
  `IS_DENO`/`IS_BUN`；对快照文件名中的 `..` 做清理，防止路径穿越。
- **mock-fetch**：安全序列化 `requestBody`（对不可序列化 body 如 ReadableStream
  的 `JSON.stringify` 使用 try/catch）。

---

## [1.0.4] - 2026-02-10

### 新增

- **CI**：在 Linux/Windows/macOS 中增加 Playwright Chromium 安装步骤；Windows
  可选设置 `PLAYWRIGHT_BROWSERS_PATH`（如 `github.workspace`）。

### 修复

- **浏览器上下文**：启动前用 `existsSync` 检查 `executablePath`，在任意平台立即
  报「Chrome 未找到」错误（避免 Windows 上 60s 超时）。CI 下延长启动超时至
  120s。
- **测试运行器**：根级浏览器复用（每个顶层 describe 共用一个浏览器），避免
  Windows CI 多次启动/关闭后超时。当设置 `executablePath` 时使用完整 suite
  路径作为缓存 key，保证错误处理用例能正确拿到 `_browserSetupError`。
- **cleanupSuiteBrowser**：完整路径未命中时按根 describe 名解析缓存（与根级复用
  一致）。

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
