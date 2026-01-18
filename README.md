# @dreamer/test

> 一个兼容 Deno 和 Bun 的测试工具库，提供 Mock 工具、断言增强、测试工具函数、浏览器测试集成等高级功能

[![JSR](https://jsr.io/badges/@dreamer/test)](https://jsr.io/@dreamer/test)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-300%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 功能

测试工具库，基于 Deno 内置测试框架，提供 Mock、断言增强、测试工具函数、浏览器测试集成等高级功能，让测试更简单、更强大。

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/test
```

### Bun

```bash
bunx jsr add -D @dreamer/test
```

---

## 🌍 环境兼容性

| 环境 | 版本要求 | 状态 |
|------|---------|------|
| **Deno** | 2.5+ | ✅ 完全支持 |
| **Bun** | 1.0+ | ✅ 完全支持 |
| **服务端** | - | ✅ 支持（Deno/Bun 运行时） |
| **浏览器测试** | - | ✅ 支持（通过 Puppeteer 集成） |

---

## ✨ 特性

- **Mock 工具**：
  - 函数 Mock（`mockFn`）
  - HTTP Mock（`mockFetch`）
  - 调用次数和参数验证
  - 返回值验证
- **断言增强**：
  - 丰富的断言方法（`expect`、`assertSnapshot`、`assertRejects` 等）
  - 类型检查断言（`toBeArray`、`toBeString`、`toBeNumber` 等）
  - 属性断言（`toHaveProperty`、`toHaveLength`）
  - 反向断言（`.not`）
- **测试工具函数**：
  - Setup/Teardown（`beforeAll`、`afterAll`、`beforeEach`、`afterEach`）
  - 参数化测试（`testEach`）
  - 基准测试（`bench`）
- **浏览器测试集成**：
  - 自动创建浏览器上下文
  - 客户端代码自动打包（@dreamer/esbuild）
  - 页面操作 API（`evaluate`、`goto`、`waitFor`）
  - 浏览器实例复用
- **测试组织**：
  - 测试套件（`describe`）
  - 测试用例（`it`、`test`）
  - 跳过测试（`test.skip`）
  - 仅运行测试（`test.only`）
- **资源清理控制**：
  - 支持禁用定时器泄漏检查（`sanitizeOps`）
  - 支持禁用资源句柄泄漏检查（`sanitizeResources`）

---

## 🎯 使用场景

- **单元测试**：函数、类、模块测试
- **集成测试**：API、数据库、服务测试
- **Mock 测试**：外部依赖 Mock
- **快照测试**：UI 组件、数据结构快照
- **性能测试**：基准测试、性能对比
- **浏览器测试**：前端组件、DOM 操作测试

---

## 🚀 快速开始

### 基础测试

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("Math", () => {
  it("should add two numbers", () => {
    expect(1 + 2).toBe(3);
  });

  it("should multiply two numbers", () => {
    expect(2 * 3).toBe(6);
  });
});
```

### Mock 函数

```typescript
import { describe, it, mockFn, expectMock } from "@dreamer/test";

describe("Mock 函数", () => {
  it("should mock function calls", () => {
    const mock = mockFn();
    mock(1, 2);
    mock(3, 4);

    // 验证调用次数
    expectMock(mock).toHaveBeenCalledTimes(2);

    // 验证调用参数
    expectMock(mock).toHaveBeenCalledWith(1, 2);

    // 验证最后一次调用
    expectMock(mock).toHaveBeenLastCalledWith(3, 4);
  });
});
```

### HTTP Mock

```typescript
import { describe, it, expect, mockFetch } from "@dreamer/test";

describe("HTTP Mock", () => {
  it("should mock fetch request", async () => {
    const mock = mockFetch("https://api.example.com/users", {
      method: "GET",
      response: {
        status: 200,
        body: JSON.stringify({ id: 1, name: "Alice" }),
      },
    });

    const response = await fetch("https://api.example.com/users");
    const data = await response.json();

    expect(data).toEqual({ id: 1, name: "Alice" });
  });
});
```

---

## 🎨 使用示例

### Setup/Teardown

```typescript
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@dreamer/test";

describe("Database Tests", () => {
  let db: Database;

  beforeAll(async () => {
    // 所有测试前执行一次
    db = await connectDatabase();
  });

  afterAll(async () => {
    // 所有测试后执行一次
    await db.close();
  });

  beforeEach(async () => {
    // 每个测试前执行
    await db.clear();
  });

  afterEach(async () => {
    // 每个测试后执行
    await db.cleanup();
  });

  it("should create user", async () => {
    const user = await db.createUser({ name: "Alice" });
    expect(user).toBeDefined();
  });
});
```

### 参数化测试

```typescript
import { describe, testEach, expect } from "@dreamer/test";

describe("参数化测试", () => {
  testEach([
    [1, 2, 3],
    [2, 3, 5],
    [3, 4, 7],
  ])("should add %0 and %1 to equal %2", (a, b, expected) => {
    expect(a + b).toBe(expected);
  });
});
```

### 基准测试

```typescript
import { describe, bench } from "@dreamer/test";

describe("性能测试", () => {
  bench("array push", () => {
    const arr: number[] = [];
    for (let i = 0; i < 1000; i++) {
      arr.push(i);
    }
  });

  bench("array concat", () => {
    let arr: number[] = [];
    for (let i = 0; i < 1000; i++) {
      arr = arr.concat([i]);
    }
  }, {
    n: 100,      // 运行次数（默认：100）
    warmup: 10,  // 预热次数（默认：10）
  });
});
```

### 快照测试

```typescript
import { describe, it, assertSnapshot } from "@dreamer/test";

describe("快照测试", () => {
  it("should match snapshot", async (t) => {
    const data = {
      users: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      total: 2,
    };

    await assertSnapshot(t, data);
  });
});
```

### 测试套件选项

```typescript
import { describe, it } from "@dreamer/test";

// 为整个测试套件设置选项
describe("使用定时器的测试套件", {
  sanitizeOps: false,        // 禁用定时器泄漏检查
  sanitizeResources: false,  // 禁用资源句柄泄漏检查
}, () => {
  it("测试用例 1", () => {
    // 这个测试用例会继承套件的选项
  });

  it("测试用例 2", () => {
    // 这个测试用例也会继承套件的选项
  });
});
```

### 嵌套套件的选项继承

```typescript
import { describe, it } from "@dreamer/test";

describe("父套件", {
  sanitizeOps: false,
}, () => {
  describe("子套件", {
    sanitizeResources: false,  // 子套件可以覆盖或添加选项
  }, () => {
    it("测试用例", () => {
      // 继承 sanitizeOps: false 和 sanitizeResources: false
    });
  });
});
```

### 禁用资源清理检查

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("Redis 测试", () => {
  it("应该创建 Redis 连接", async () => {
    const client = await createRedisClient();
    expect(client).toBeDefined();
    await client.disconnect();
  }, {
    sanitizeOps: false,        // 禁用定时器泄漏检查
    sanitizeResources: false,  // 禁用资源句柄泄漏检查
  });
});
```

### 浏览器测试集成

浏览器测试允许你在真实的 Chrome 浏览器环境中测试前端代码。

#### 基础浏览器测试

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("浏览器测试", {
  browser: {
    enabled: true,  // 启用浏览器测试
    headless: true, // 无头模式（默认）
  },
}, () => {
  it("应该在浏览器中执行代码", async (t) => {
    // t.browser 包含浏览器上下文
    const result = await t.browser!.evaluate(() => {
      return 1 + 1;
    });
    expect(result).toBe(2);
  });

  it("应该能够访问 DOM", async (t) => {
    const result = await t.browser!.evaluate(() => {
      return document.title;
    });
    expect(result).toBeDefined();
  });
});
```

#### 自动打包客户端代码

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("客户端库测试", {
  browser: {
    enabled: true,
    entryPoint: "./src/client/mod.ts",  // 客户端代码入口
    globalName: "MyLib",                 // 全局变量名
  },
}, () => {
  it("应该能够使用打包后的库", async (t) => {
    const result = await t.browser!.evaluate(() => {
      // MyLib 是打包后暴露的全局变量
      return typeof (globalThis as any).MyLib;
    });
    expect(result).toBe("object");
  });
});
```

#### 浏览器上下文 API

```typescript
import { describe, it, expect } from "@dreamer/test";

describe("浏览器 API 测试", {
  browser: { enabled: true },
}, () => {
  // evaluate - 在浏览器中执行代码
  it("evaluate 示例", async (t) => {
    const result = await t.browser!.evaluate(() => {
      return navigator.userAgent;
    });
    expect(result).toContain("Chrome");
  });

  // goto - 导航到 URL
  it("goto 示例", async (t) => {
    await t.browser!.goto("https://example.com");
    const title = await t.browser!.evaluate(() => document.title);
    expect(title).toBeDefined();
  });

  // waitFor - 等待条件满足
  it("waitFor 示例", async (t) => {
    await t.browser!.evaluate(() => {
      setTimeout(() => {
        (globalThis as any).ready = true;
      }, 100);
    });

    await t.browser!.waitFor(() => (globalThis as any).ready === true, {
      timeout: 5000,
    });

    const ready = await t.browser!.evaluate(() => (globalThis as any).ready);
    expect(ready).toBe(true);
  });
});
```

#### 浏览器实例复用

```typescript
import { describe, it } from "@dreamer/test";

describe("复用浏览器实例", {
  browser: {
    enabled: true,
    reuseBrowser: true,  // 在同一个套件中复用浏览器（默认为 true）
  },
}, () => {
  // 多个测试共享同一个浏览器实例，但每个测试有独立的页面
  it("测试 1", async (t) => {
    // ...
  });

  it("测试 2", async (t) => {
    // ...
  });
});
```

#### 自定义 HTML 模板

```typescript
import { describe, it } from "@dreamer/test";

describe("自定义模板测试", {
  browser: {
    enabled: true,
    bodyContent: '<div id="app"></div>',  // 额外的 HTML body 内容
    htmlTemplate: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Custom Test Page</title>
        {{BUNDLE}}
      </head>
      <body>
        {{BODY_CONTENT}}
        <script>window.testReady = true;</script>
      </body>
      </html>
    `,
  },
}, () => {
  it("应该使用自定义模板", async (t) => {
    const hasApp = await t.browser!.evaluate(() => {
      return document.getElementById("app") !== null;
    });
    expect(hasApp).toBe(true);
  });
});
```

---

## 📚 API 文档

### 测试函数

- `describe(name: string, fn: () => void | Promise<void>)`: 创建测试套件
- `describe(name: string, options: DescribeOptions, fn: () => void | Promise<void>)`: 创建测试套件（带选项）
- `it(name: string, fn: () => void | Promise<void>, options?)`: 创建测试用例
- `test(name: string, fn: () => void | Promise<void>, options?)`: 创建测试用例（`it` 的别名）
- `test.skip(name: string, fn: () => void | Promise<void>)`: 跳过测试
- `test.only(name: string, fn: () => void | Promise<void>, options?)`: 只运行此测试

**测试套件选项（DescribeOptions）**：
- `sanitizeOps?: boolean`: 是否启用操作清理检查（默认：`true`）
- `sanitizeResources?: boolean`: 是否启用资源清理检查（默认：`true`）

**测试选项（TestOptions）**：
- `timeout?: number`: 测试超时时间（毫秒）
- `sanitizeOps?: boolean`: 是否启用操作清理检查（默认：`true`）
- `sanitizeResources?: boolean`: 是否启用资源清理检查（默认：`true`）

### Mock 函数

- `mockFn(implementation?: Function)`: 创建 Mock 函数
- `expectMock(mock: MockFunction)`: 创建 Mock 断言对象（`MockExpect`）
- `mockFetch(url: string, options?)`: Mock HTTP 请求

**Mock 断言方法（MockExpect）**：
- `.toHaveBeenCalled()`: 检查是否被调用
- `.toHaveBeenCalledTimes(n)`: 检查调用次数
- `.toHaveBeenCalledWith(...args)`: 检查调用参数
- `.toHaveBeenLastCalledWith(...args)`: 检查最后一次调用参数
- `.toHaveBeenNthCalledWith(n, ...args)`: 检查第 N 次调用参数
- `.toHaveReturned()`: 检查是否返回值
- `.toHaveReturnedWith(value)`: 检查返回值
- `.toHaveReturnedTimes(n)`: 检查返回次数
- `.toHaveLastReturnedWith(value)`: 检查最后一次返回值
- `.toHaveNthReturnedWith(n, value)`: 检查第 N 次返回值
- `.not`: 反向断言

### 断言

- `expect(actual: unknown)`: 创建断言对象
  - `.toBe(expected)`: 严格相等
  - `.toEqual(expected)`: 深度相等
  - `.toStrictEqual(expected)`: 严格深度相等
  - `.toBeTruthy()`: 真值
  - `.toBeFalsy()`: 假值
  - `.toBeNull()`: null
  - `.toBeUndefined()`: undefined
  - `.toBeDefined()`: 已定义
  - `.toContain(item)`: 包含（数组或字符串）
  - `.toMatch(regexp)`: 正则匹配
  - `.toHaveProperty(path, value?)`: 具有指定属性
  - `.toHaveLength(expected)`: 具有指定长度
  - `.toBeCloseTo(expected, numDigits?)`: 浮点数近似相等
  - `.toBeNaN()`: 是否为 NaN
  - `.toBeArray()`: 是否为数组
  - `.toBeString()`: 是否为字符串
  - `.toBeNumber()`: 是否为数字
  - `.toBeBoolean()`: 是否为布尔值
  - `.toBeFunction()`: 是否为函数
  - `.toBeEmpty()`: 是否为空
  - `.toBeInstanceOf(expected)`: 为指定类型的实例
  - `.toBeGreaterThan(expected)`: 大于
  - `.toBeGreaterThanOrEqual(expected)`: 大于等于
  - `.toBeLessThan(expected)`: 小于
  - `.toBeLessThanOrEqual(expected)`: 小于等于
  - `.toThrow(error?)`: 抛出错误
  - `.not`: 反向断言

### 异步断言

- `assertRejects(fn: () => Promise<any>, ErrorClass?, message?)`: 断言异步函数抛出错误
- `assertResolves(fn: () => Promise<any>, expected?)`: 断言异步函数成功

### 对象断言

- `assertDeepEqual(actual, expected)`: 深度相等断言
- `assertInstanceOf(actual, ExpectedClass)`: 实例类型断言
- `assertMatch(actual, regexp)`: 正则匹配断言

### 快照测试

- `assertSnapshot(t: TestContext, data: any)`: 快照测试

### Setup/Teardown

- `beforeAll(fn: () => void | Promise<void>)`: 所有测试前执行
- `afterAll(fn: () => void | Promise<void>)`: 所有测试后执行
- `beforeEach(fn: (t?: TestContext) => void | Promise<void>, options?: TestOptions)`: 每个测试前执行
- `afterEach(fn: (t?: TestContext) => void | Promise<void>, options?: TestOptions)`: 每个测试后执行

### 参数化测试

- `testEach(cases: any[])`: 参数化测试

### 性能测试

- `bench(name: string, fn: () => void, options?)`: 性能基准测试

### 浏览器测试

**浏览器测试配置（BrowserTestConfig）**：
- `enabled?: boolean`: 是否启用浏览器测试（默认：`false`）
- `entryPoint?: string`: 客户端代码入口文件路径
- `globalName?: string`: 全局变量名（IIFE 格式）
- `headless?: boolean`: 是否无头模式（默认：`true`）
- `executablePath?: string`: Chrome 可执行文件路径（可选，自动检测）
- `args?: string[]`: Chrome 启动参数
- `htmlTemplate?: string`: HTML 模板（可选）
- `bodyContent?: string`: 额外的 HTML body 内容（可选）
- `moduleLoadTimeout?: number`: 等待模块加载的超时时间（毫秒，默认：`10000`）
- `reuseBrowser?: boolean`: 是否在套件级别复用浏览器实例（默认：`true`）

**浏览器上下文（BrowserContext）**：
- `browser`: Puppeteer Browser 实例
- `page`: Puppeteer Page 实例
- `evaluate<T>(fn: () => T | Promise<T>)`: 在浏览器中执行代码
- `goto(url: string)`: 导航到指定 URL
- `waitFor(fn: () => boolean, options?)`: 等待页面中的条件满足
- `close()`: 关闭浏览器和页面

**独立使用浏览器上下文**：
- `createBrowserContext(config: BrowserTestConfig)`: 创建浏览器测试上下文
- `buildClientBundle(options: BundleOptions)`: 打包客户端代码
- `createTestPage(options: TestPageOptions)`: 创建测试页面
- `findChromePath()`: 检测系统 Chrome 路径

---

## 📊 测试报告

本库经过全面测试，所有 300 个测试用例均已通过，测试覆盖率达到 100%。详细测试报告请查看 [TEST_REPORT.md](./TEST_REPORT.md)。

**测试统计**：
- **总测试数**: 301
- **通过**: 300 ✅
- **跳过**: 1
- **失败**: 0
- **通过率**: 100% ✅
- **测试执行时间**: ~1分11秒
- **测试覆盖**: 所有公共 API、边界情况、错误处理
- **测试环境**: Deno 最新稳定版

**测试类型**：
- ✅ 单元测试（241 个）
- ✅ 浏览器测试（60 个）

**测试亮点**：
- ✅ 所有功能、边界情况、错误处理都有完整的测试覆盖
- ✅ 浏览器测试验证了在真实 Chrome 浏览器环境中的功能
- ✅ 完整的 Mock 功能测试（函数 Mock、HTTP Mock）

查看完整测试报告：[TEST_REPORT.md](./TEST_REPORT.md)

---

## 📝 注意事项

- **Bun 环境限制**：在 Bun 环境中，`test()` 必须在 `describe()` 执行期间调用，不能在测试执行期间调用
- **bench() 调用位置**：`bench()` 应该在 `describe()` 执行期间调用，而不是在 `it()` 回调中
- **资源清理**：使用第三方库时，如果遇到定时器或资源泄漏警告，可以使用 `sanitizeOps: false` 和 `sanitizeResources: false` 选项禁用检查
- **浏览器测试依赖**：
  - 需要安装 Chrome/Chromium 浏览器
  - 自动使用 Puppeteer 和 @dreamer/esbuild 进行打包
  - 支持自动检测系统 Chrome 路径（macOS、Linux、Windows）
- **浏览器测试性能**：
  - 启用 `reuseBrowser: true`（默认）可显著提升性能
  - 每个测试会创建新页面，但共享浏览器实例
  - 测试结束后自动清理浏览器资源
- **客户端代码打包**：
  - 使用 @dreamer/esbuild 进行快速打包
  - 支持 TypeScript 代码
  - 打包结果缓存在内存中

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License - 详见 [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
