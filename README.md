# @dreamer/test

一个用于 Deno 的测试工具库，基于 Deno 内置测试框架，提供 Mock 工具、断言增强、测试工具函数等高级功能。

## 功能

测试工具库，基于 Deno 内置测试框架，提供 Mock、断言增强、测试工具函数等高级功能，让测试更简单、更强大。

## 为什么需要测试工具库？

虽然 Deno 内置了测试框架，但 `@dreamer/test` 提供了以下增强功能：

- ✅ **Mock 工具**：Deno 内置测试框架没有 Mock 功能，需要手动实现
- ✅ **断言增强**：提供更丰富的断言方法（如 `assertSnapshot`、`assertThrowsAsync` 等）
- ✅ **测试工具函数**：提供常用的测试工具函数（setup/teardown、fixtures、参数化测试）
- ✅ **测试覆盖率工具封装**：简化覆盖率收集和报告生成
- ✅ **性能测试工具**：提供性能测试和基准测试工具
- ✅ **快照测试**：支持快照测试（类似 Jest 的 snapshot）
- ✅ **HTTP Mock**：提供 HTTP 请求 Mock 工具
- ✅ **测试报告**：生成更详细的测试报告

## 特性

### Mock 工具

- **函数 Mock**：
  - 函数调用 Mock（`mockFn`）
  - 返回值 Mock
  - 调用次数验证
  - 调用参数验证
  - 调用顺序验证
- **模块 Mock**：
  - 模块导入 Mock（`mockModule`）
  - 部分模块 Mock
  - 动态模块替换
- **HTTP Mock**：
  - HTTP 请求 Mock（`mockFetch`）
  - 请求拦截和响应模拟
  - 请求验证（URL、方法、头部、Body）
  - 响应模拟（状态码、头部、Body）
- **时间 Mock**：
  - 时间 Mock（`mockDate`、`mockTimer`）
  - 定时器 Mock（`setTimeout`、`setInterval`）
  - 日期 Mock

### 断言增强

- **基础断言**：基于 Deno 内置断言，提供类型安全的包装
- **异步断言**：
  - `assertRejects`：断言异步函数抛出错误
  - `assertResolves`：断言异步函数成功
- **对象断言**：
  - `assertDeepEqual`：深度相等断言
  - `assertInstanceOf`：实例类型断言
  - `assertMatch`：正则匹配断言
- **快照断言**：
  - `assertSnapshot`：快照测试（类似 Jest）
  - 自动更新快照
  - 快照对比和差异显示
- **自定义断言**：
  - 自定义断言消息
  - 自定义断言逻辑

### 测试工具函数

- **Setup/Teardown**：
  - `beforeEach`：每个测试前执行
  - `afterEach`：每个测试后执行
  - `beforeAll`：所有测试前执行
  - `afterAll`：所有测试后执行
- **测试 Fixtures**：
  - 测试数据 Fixtures
  - 测试环境 Fixtures
  - 共享测试资源
- **参数化测试**：
  - 参数化测试（`test.each`）
  - 表格驱动测试
  - 测试用例生成
- **异步测试工具**：
  - 异步测试辅助函数
  - Promise 测试工具
  - 超时控制

### 测试覆盖率

- **覆盖率收集**：
  - 基于 Deno 内置覆盖率工具
  - 覆盖率数据收集
  - 覆盖率报告生成
- **覆盖率报告**：
  - HTML 报告生成
  - 文本报告生成
  - 覆盖率阈值检查
  - 覆盖率趋势分析

### 性能测试

- **基准测试**：
  - 性能基准测试（`bench`）
  - 执行时间测量
  - 内存使用测量
  - 性能对比
- **压力测试**：
  - 并发测试
  - 负载测试工具

### 其他功能

- **测试分组**：测试套件组织（`describe`、`it`）
- **测试跳过**：条件跳过测试（`test.skip`、`test.only`）
- **测试超时**：测试超时控制
- **测试报告**：详细的测试报告生成
- **测试并行化**：测试并行执行控制

## 使用场景

- 单元测试（函数、类、模块测试）
- 集成测试（API、数据库、服务测试）
- Mock 测试（外部依赖 Mock）
- 快照测试（UI 组件、数据结构快照）
- 性能测试（基准测试、性能对比）
- 测试覆盖率收集和分析

## 优先级

⭐⭐⭐

## 安装

```bash
deno add jsr:@dreamer/test
```

## 环境兼容性

- **Deno 版本**：要求 Deno 2.5 或更高版本
- **服务端**：✅ 支持（Deno 运行时，基于 Deno 测试框架，完整功能支持，在控制台运行）
- **客户端**：❌ 不支持（测试工具库仅在服务端运行，在控制台执行测试，客户端测试需要使用浏览器测试框架如 Playwright、Puppeteer）
- **依赖**：基于 Deno 内置测试框架，无额外依赖

## 示例用法

### 基础测试

```typescript
import { describe, it, expect } from "jsr:@dreamer/test";

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
import { describe, it, expect, mockFn } from "jsr:@dreamer/test";

describe("Mock 函数", () => {
  it("should mock function calls", () => {
    const mock = mockFn();
    mock(1, 2);
    mock(3, 4);

    // 验证调用次数
    expect(mock).toHaveBeenCalledTimes(2);

    // 验证调用参数
    expect(mock).toHaveBeenCalledWith(1, 2);
    expect(mock).toHaveBeenCalledWith(3, 4);

    // 验证最后一次调用
    expect(mock).toHaveBeenLastCalledWith(3, 4);
  });

  it("should mock return value", () => {
    const mock = mockFn(() => "mocked value");
    expect(mock()).toBe("mocked value");
  });

  it("should mock async function", async () => {
    const mock = mockFn(async () => {
      return Promise.resolve("async value");
    });
    const result = await mock();
    expect(result).toBe("async value");
  });
});
```

### Mock 模块

```typescript
import { describe, it, expect, mockModule } from "jsr:@dreamer/test";

// Mock 模块
const mockModule = await mockModule("./database.ts", {
  getUser: () => ({ id: 1, name: "Mock User" }),
  createUser: () => ({ id: 2, name: "New User" }),
});

describe("User Service", () => {
  it("should get user", async () => {
    const { getUser } = await import("./database.ts");
    const user = await getUser(1);
    expect(user).toEqual({ id: 1, name: "Mock User" });
  });
});
```

### HTTP Mock

```typescript
import { describe, it, expect, mockFetch } from "jsr:@dreamer/test";

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
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("should verify request", async () => {
    const mock = mockFetch("https://api.example.com/users", {
      method: "POST",
      requestBody: { name: "Bob" },
      response: {
        status: 201,
        body: JSON.stringify({ id: 2, name: "Bob" }),
      },
    });

    await fetch("https://api.example.com/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob" }),
    });

    // 验证请求
    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Bob" }),
      })
    );
  });
});
```

### 快照测试

```typescript
import { describe, it, expect, assertSnapshot } from "jsr:@dreamer/test";

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
    // 首次运行会创建快照文件
    // 后续运行会对比快照，如果不匹配会报错
  });
});
```

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
} from "jsr:@dreamer/test";

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
import { describe, it, expect, testEach } from "jsr:@dreamer/test";

describe("参数化测试", () => {
  testEach([
    [1, 2, 3],
    [2, 3, 5],
    [3, 4, 7],
  ])("should add %d and %d to equal %d", (a, b, expected) => {
    expect(a + b).toBe(expected);
  });

  // 或使用对象形式
  testEach([
    { input: "hello", expected: "HELLO" },
    { input: "world", expected: "WORLD" },
  ])("should uppercase %input to %expected", ({ input, expected }) => {
    expect(input.toUpperCase()).toBe(expected);
  });
});
```

### 异步断言

```typescript
import { describe, it, expect, assertRejects, assertResolves } from "jsr:@dreamer/test";

describe("异步断言", () => {
  it("should reject with error", async () => {
    await assertRejects(
      async () => {
        throw new Error("Test error");
      },
      Error,
      "Test error"
    );
  });

  it("should resolve with value", async () => {
    await assertResolves(
      async () => {
        return "success";
      },
      "success"
    );
  });
});
```

### 性能测试

```typescript
import { describe, bench } from "jsr:@dreamer/test";

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
  });
});
```

### 测试覆盖率

```typescript
// deno.json
{
  "tasks": {
    "test:coverage": "deno test --coverage=./coverage",
    "test:coverage:report": "deno coverage ./coverage --html"
  }
}
```

```typescript
import { describe, it, expect, collectCoverage } from "jsr:@dreamer/test";

// 收集覆盖率
await collectCoverage({
  include: ["./src/**/*.ts"],
  exclude: ["./src/**/*.test.ts"],
  outputDir: "./coverage",
  threshold: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
});
```

### 测试分组和跳过

```typescript
import { describe, it, expect, test } from "jsr:@dreamer/test";

describe("测试分组", () => {
  it("should run this test", () => {
    expect(1 + 1).toBe(2);
  });

  it.skip("should skip this test", () => {
    // 这个测试会被跳过
    expect(1 + 1).toBe(3);
  });

  test.only("should only run this test", () => {
    // 只运行这个测试
    expect(1 + 1).toBe(2);
  });
});
```

## 与 Deno 内置测试框架的关系

`@dreamer/test` **基于 Deno 内置测试框架**，提供以下增强：

| 功能 | Deno 内置 | @dreamer/test |
|------|-----------|---------------|
| 基础测试 | ✅ | ✅（包装） |
| 基础断言 | ✅ | ✅（增强） |
| Mock 功能 | ❌ | ✅ |
| 快照测试 | ❌ | ✅ |
| HTTP Mock | ❌ | ✅ |
| Setup/Teardown | ❌ | ✅ |
| 参数化测试 | ❌ | ✅ |
| 测试覆盖率 | ✅ | ✅（工具封装） |
| 性能测试 | ❌ | ✅ |
| 测试报告 | 基础 | 增强 |

**使用建议**：
- 简单测试：可以直接使用 Deno 内置测试框架
- 需要 Mock、快照、参数化等高级功能：使用 `@dreamer/test`
- 可以混合使用：`@dreamer/test` 与 Deno 内置测试框架完全兼容

## 状态

🚧 **开发中**

## 备注

- 基于 Deno 内置测试框架，提供增强功能，不替代 Deno 测试框架
- 提供 Mock、快照、参数化等 Deno 内置测试框架没有的功能
- 完全兼容 Deno 内置测试框架，可以混合使用
- 适合需要高级测试功能的项目
