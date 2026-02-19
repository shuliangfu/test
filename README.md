# @dreamer/test

> A testing utility library compatible with Deno and Bun, providing Mock tools,
> assertion enhancements, test utility functions, browser test integration, and
> other advanced features

English | [中文 (Chinese)](./docs/zh-CN/README.md)

[![JSR](https://jsr.io/badges/@dreamer/test)](https://jsr.io/@dreamer/test)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-392%20passed-brightgreen)](./docs/en-US/TEST_REPORT.md)

---

## 🎯 Overview

A testing utility library based on Deno's built-in test framework, providing
Mock, assertion enhancements, test utility functions, browser test integration,
and other advanced features to make testing simpler and more powerful.

---

## 📦 Installation

### Deno

```bash
deno add jsr:@dreamer/test
```

### Bun

```bash
bunx jsr add -D @dreamer/test
```

**Import paths**:

- Main: `@dreamer/test` or `jsr:@dreamer/test` — test runner, mock, assertions,
  etc.
- Browser: `@dreamer/test/browser` or `jsr:@dreamer/test/browser` — browser APIs
  (`createBrowserContext`, `findChromePath`, `buildClientBundle`, etc.)

```typescript
import { describe, expect, it } from "@dreamer/test";
import { createBrowserContext, findChromePath } from "@dreamer/test/browser";
```

---

## 🌍 Compatibility

| Environment       | Version | Status                                    |
| ----------------- | ------- | ----------------------------------------- |
| **Deno**          | 2.5+    | ✅ Fully supported                        |
| **Bun**           | 1.0+    | ✅ Fully supported                        |
| **Server**        | -       | ✅ Supported (Deno/Bun runtime)           |
| **Browser tests** | -       | ✅ Supported (via Playwright integration) |

---

## ✨ Features

- **Mock tools**:
  - Function Mock (`mockFn`)
  - HTTP Mock (`mockFetch`)
  - Call count and argument validation
  - Return value validation
- **Assertion enhancements**:
  - Rich assertion methods (`expect`, `assertSnapshot`, `assertRejects`, etc.)
  - Type check assertions (`toBeArray`, `toBeString`, `toBeNumber`, etc.)
  - Property assertions (`toHaveProperty`, `toHaveLength`)
  - Negation assertions (`.not`)
- **Test utility functions**:
  - Setup/Teardown (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`)
  - Parameterized tests (`testEach`)
  - Benchmark tests (`bench`)
- **Browser test integration**:
  - Auto-create browser context
  - Auto-bundle client code (@dreamer/esbuild)
  - Deno/Bun resolver plugin support (auto-resolve JSR, npm, relative paths,
    path aliases, etc.)
  - Page operation API (`evaluate`, `goto`, `waitFor`)
  - Browser instance reuse
  - Auto resource cleanup (`cleanupAllBrowsers`)
- **Test organization**:
  - Test suites (`describe`)
  - Test cases (`it`, `test`)
  - Skip test (`test.skip`)
  - Conditional skip test (`test.skipIf`)
  - Run only test (`test.only`)
- **Resource cleanup control**:
  - Support disabling timer leak check (`sanitizeOps`)
  - Support disabling resource handle leak check (`sanitizeResources`)

---

## 🎯 Use Cases

- **Unit tests**: Function, class, module tests
- **Integration tests**: API, database, service tests
- **Mock tests**: External dependency mocking
- **Snapshot tests**: UI component, data structure snapshots
- **Performance tests**: Benchmarks, performance comparison
- **Browser tests**: Frontend components, DOM operation tests

---

## 🚀 Quick Start

### Basic Tests

```typescript
import { describe, expect, it } from "@dreamer/test";

describe("Math", () => {
  it("should add two numbers", () => {
    expect(1 + 2).toBe(3);
  });

  it("should multiply two numbers", () => {
    expect(2 * 3).toBe(6);
  });
});
```

### Mock Functions

```typescript
import { describe, expectMock, it, mockFn } from "@dreamer/test";

describe("Mock functions", () => {
  it("should mock function calls", () => {
    const mock = mockFn();
    mock(1, 2);
    mock(3, 4);

    // Verify call count
    expectMock(mock).toHaveBeenCalledTimes(2);

    // Verify call arguments
    expectMock(mock).toHaveBeenCalledWith(1, 2);

    // Verify last call
    expectMock(mock).toHaveBeenLastCalledWith(3, 4);
  });
});
```

### HTTP Mock

```typescript
import { describe, expect, it, mockFetch } from "@dreamer/test";

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

## 🎨 Usage Examples

### Setup/Teardown

```typescript
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";

describe("Database Tests", () => {
  let db: Database;

  beforeAll(async () => {
    // Execute once before all tests
    db = await connectDatabase();
  });

  afterAll(async () => {
    // Execute once after all tests
    await db.close();
  });

  beforeEach(async () => {
    // Execute before each test
    await db.clear();
  });

  afterEach(async () => {
    // Execute after each test
    await db.cleanup();
  });

  it("should create user", async () => {
    const user = await db.createUser({ name: "Alice" });
    expect(user).toBeDefined();
  });
});
```

### Parameterized Tests

```typescript
import { describe, expect, testEach } from "@dreamer/test";

describe("Parameterized tests", () => {
  testEach([
    [1, 2, 3],
    [2, 3, 5],
    [3, 4, 7],
  ])("should add %0 and %1 to equal %2", (a, b, expected) => {
    expect(a + b).toBe(expected);
  });
});
```

### Benchmark Tests

```typescript
import { bench, describe } from "@dreamer/test";

describe("Performance tests", () => {
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
    n: 100, // Run count (default: 100)
    warmup: 10, // Warmup count (default: 10)
  });
});
```

### Snapshot Tests

```typescript
import { assertSnapshot, describe, it } from "@dreamer/test";

describe("Snapshot tests", () => {
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

### Test Suite Options

```typescript
import { describe, it } from "@dreamer/test";

// Set options for entire test suite
describe("Test suite using timers", {
  sanitizeOps: false, // Disable timer leak check
  sanitizeResources: false, // Disable resource handle leak check
}, () => {
  it("Test case 1", () => {
    // This test case inherits suite options
  });

  it("Test case 2", () => {
    // This test case also inherits suite options
  });
});
```

### Nested Suite Option Inheritance

```typescript
import { describe, it } from "@dreamer/test";

describe("Parent suite", {
  sanitizeOps: false,
}, () => {
  describe("Child suite", {
    sanitizeResources: false, // Child suite can override or add options
  }, () => {
    it("Test case", () => {
      // Inherits sanitizeOps: false and sanitizeResources: false
    });
  });
});
```

### Conditional Skip Test

```typescript
import { describe, expect, it } from "@dreamer/test";

describe("Conditional skip tests", () => {
  const enableWriteTests = true; // or false

  // Skip this test if enableWriteTests is false
  it.skipIf(!enableWriteTests, "Should be able to write data", async () => {
    // Write test code
    expect(true).toBeTruthy();
  });

  // Supports complex conditions
  const hasPermission = true;
  const isTestnet = true;
  it.skipIf(!hasPermission || !isTestnet, "Test requiring permission", () => {
    // Test code
  });
});
```

### Disable Resource Cleanup Check

```typescript
import { describe, expect, it } from "@dreamer/test";

describe("Redis tests", () => {
  it("Should create Redis connection", async () => {
    const client = await createRedisClient();
    expect(client).toBeDefined();
    await client.disconnect();
  }, {
    sanitizeOps: false, // Disable timer leak check
    sanitizeResources: false, // Disable resource handle leak check
  });
});
```

### Browser Test Integration

Browser tests allow you to test frontend code in a real Chrome browser
environment.

#### Browser Requirements

Browser tests use **Playwright** with Chromium. If you see
`Executable doesn't exist`, run:

```bash
npx playwright install chromium
```

Alternatively, set `browser.executablePath` to your system Chrome path (e.g. CI
with `CHROME_PATH`), or use `browserSource: "system"` to auto-detect.

**Running this package's browser tests** (`tests/browser/`): run with
`--no-parallel` to avoid multiple Chrome instances launching at once (which can
cause hangs or "Network service crashed"). Example:
`deno test -A --no-parallel
tests/browser`. If a run hangs, kill any leftover
Chrome processes and retry.

To use system Chrome for visible debugging (`headless: false`), use
`findChromePath()` from `@dreamer/test/browser`:

```typescript
import { describe, expect, it } from "@dreamer/test";
import { findChromePath } from "@dreamer/test/browser";

describe("Visible browser", {
  browser: {
    enabled: true,
    headless: false,
    executablePath: findChromePath(), // Use system Chrome when path not found
  },
}, () => {
  it("shows the page", async (t) => {/* ... */});
});
```

#### Basic Browser Tests

```typescript
import { describe, expect, it } from "@dreamer/test";

describe("Browser tests", {
  browser: {
    enabled: true, // Enable browser tests
    headless: true, // Headless mode (default)
  },
}, () => {
  it("Should execute code in browser", async (t) => {
    // t.browser contains browser context
    const result = await t.browser!.evaluate(() => {
      return 1 + 1;
    });
    expect(result).toBe(2);
  });

  it("Should be able to access DOM", async (t) => {
    const result = await t.browser!.evaluate(() => {
      return document.title;
    });
    expect(result).toBeDefined();
  });
});
```

#### Auto-Bundle Client Code

```typescript
import { describe, expect, it } from "@dreamer/test";

describe("Client library tests", {
  browser: {
    enabled: true,
    entryPoint: "./src/client/mod.ts", // Client code entry point
    globalName: "MyLib", // Global variable name
  },
}, () => {
  it("Should be able to use bundled library", async (t) => {
    const result = await t.browser!.evaluate(() => {
      // MyLib is the global variable exposed after bundling
      return typeof (globalThis as any).MyLib;
    });
    expect(result).toBe("object");
  });
});
```

#### Browser Context API

```typescript
import { describe, expect, it } from "@dreamer/test";

describe("Browser API tests", {
  browser: { enabled: true },
}, () => {
  // evaluate - Execute code in browser
  it("evaluate example", async (t) => {
    const result = await t.browser!.evaluate(() => {
      return navigator.userAgent;
    });
    expect(result).toContain("Chrome");
  });

  // goto - Navigate to URL
  it("goto example", async (t) => {
    await t.browser!.goto("https://example.com");
    const title = await t.browser!.evaluate(() => document.title);
    expect(title).toBeDefined();
  });

  // waitFor - Wait for condition to be met
  it("waitFor example", async (t) => {
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

#### Browser Instance Reuse

```typescript
import { describe, it } from "@dreamer/test";

describe("Reuse browser instance", {
  browser: {
    enabled: true,
    reuseBrowser: true, // Reuse browser within same suite (default: true)
  },
}, () => {
  // Multiple tests share same browser instance, but each test has independent page
  it("Test 1", async (t) => {
    // ...
  });

  it("Test 2", async (t) => {
    // ...
  });
});
```

#### Custom HTML Template

```typescript
import { describe, it } from "@dreamer/test";

describe("Custom template tests", {
  browser: {
    enabled: true,
    bodyContent: '<div id="app"></div>', // Additional HTML body content
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
  it("Should use custom template", async (t) => {
    const hasApp = await t.browser!.evaluate(() => {
      return document.getElementById("app") !== null;
    });
    expect(hasApp).toBe(true);
  });
});
```

#### Browser Resource Cleanup

`@dreamer/test` provides a comprehensive browser resource cleanup mechanism to
ensure all browser instances are properly closed after test completion, avoiding
resource leaks:

**Automatic cleanup mechanism**:

- After each test completes, automatically close the page used by the test
- Browser instances remain in cache, waiting for unified cleanup after all tests
  complete
- Automatically calls `cleanupAllBrowsers()` on process exit (SIGINT, SIGTERM
  signals)

**Manual cleanup**:

```typescript
import { afterAll, cleanupAllBrowsers, describe } from "@dreamer/test";

describe("Browser test suite", {
  browser: { enabled: true },
}, () => {
  afterAll(async () => {
    // Manually clean up all browser instances
    // This executes after all tests complete, ensuring all browsers are closed
    await cleanupAllBrowsers();
  });

  it("Test case 1", async (t) => {
    // Test code
  });

  it("Test case 2", async (t) => {
    // Test code
  });
});
```

**Cleanup mechanism notes**:

- `cleanupAllBrowsers()` closes all browser instances created in test suites
- Closes all browsers in parallel for efficient cleanup
- Ignores errors during close process to ensure all browsers are attempted to be
  closed
- Recommended to call in test suite's `afterAll` hook to ensure resource cleanup
  after tests complete

---

## 📚 API Reference

### Test Functions

- `describe(name: string, fn: () => void | Promise<void>)`: Create test suite
- `describe(name: string, options: DescribeOptions, fn: () => void | Promise<void>)`:
  Create test suite (with options)
- `it(name: string, fn: () => void | Promise<void>, options?)`: Create test case
- `test(name: string, fn: () => void | Promise<void>, options?)`: Create test
  case (alias for `it`)
- `test.skip(name: string, fn: () => void | Promise<void>)`: Skip test
- `test.only(name: string, fn: () => void | Promise<void>, options?)`: Run only
  this test

**Test suite options (DescribeOptions)**:

- `sanitizeOps?: boolean`: Enable operation cleanup check (default: `true`)
- `sanitizeResources?: boolean`: Enable resource cleanup check (default: `true`)

**Test options (TestOptions)**:

- `timeout?: number`: Test timeout (milliseconds)
- `sanitizeOps?: boolean`: Enable operation cleanup check (default: `true`)
- `sanitizeResources?: boolean`: Enable resource cleanup check (default: `true`)

### Mock Functions

- `mockFn(implementation?: Function)`: Create Mock function
- `expectMock(mock: MockFunction)`: Create Mock assertion object (`MockExpect`)
- `mockFetch(url: string, options?)`: Mock HTTP request

**Mock assertion methods (MockExpect)**:

- `.toHaveBeenCalled()`: Check if called
- `.toHaveBeenCalledTimes(n)`: Check call count
- `.toHaveBeenCalledWith(...args)`: Check call arguments
- `.toHaveBeenLastCalledWith(...args)`: Check last call arguments
- `.toHaveBeenNthCalledWith(n, ...args)`: Check Nth call arguments
- `.toHaveReturned()`: Check if returned value
- `.toHaveReturnedWith(value)`: Check return value
- `.toHaveReturnedTimes(n)`: Check return count
- `.toHaveLastReturnedWith(value)`: Check last return value
- `.toHaveNthReturnedWith(n, value)`: Check Nth return value
- `.not`: Negation assertion

### Assertions

- `expect(actual: unknown)`: Create assertion object
  - `.toBe(expected)`: Strict equality
  - `.toEqual(expected)`: Deep equality
  - `.toStrictEqual(expected)`: Strict deep equality
  - `.toBeTruthy()`: Truthy
  - `.toBeFalsy()`: Falsy
  - `.toBeNull()`: null
  - `.toBeUndefined()`: undefined
  - `.toBeDefined()`: Defined
  - `.toContain(item)`: Contains (array or string)
  - `.toMatch(regexp)`: Regex match
  - `.toHaveProperty(path, value?)`: Has specified property
  - `.toHaveLength(expected)`: Has specified length
  - `.toBeCloseTo(expected, numDigits?)`: Floating point approximate equality
  - `.toBeNaN()`: Is NaN
  - `.toBeArray()`: Is array
  - `.toBeString()`: Is string
  - `.toBeNumber()`: Is number
  - `.toBeBoolean()`: Is boolean
  - `.toBeFunction()`: Is function
  - `.toBeEmpty()`: Is empty
  - `.toBeInstanceOf(expected)`: Is instance of specified type
  - `.toBeGreaterThan(expected)`: Greater than
  - `.toBeGreaterThanOrEqual(expected)`: Greater than or equal
  - `.toBeLessThan(expected)`: Less than
  - `.toBeLessThanOrEqual(expected)`: Less than or equal
  - `.toThrow(error?)`: Throws error
  - `.not`: Negation assertion

### Async Assertions

- `assertRejects(fn: () => Promise<any>, ErrorClass?, message?)`: Assert async
  function throws error
- `assertResolves(fn: () => Promise<any>, expected?)`: Assert async function
  succeeds

### Object Assertions

- `assertDeepEqual(actual, expected)`: Deep equality assertion
- `assertInstanceOf(actual, ExpectedClass)`: Instance type assertion
- `assertMatch(actual, regexp)`: Regex match assertion

### Snapshot Tests

- `assertSnapshot(t: TestContext, data: any)`: Snapshot test

### Setup/Teardown

- `beforeAll(fn: () => void | Promise<void>)`: Execute before all tests
- `afterAll(fn: () => void | Promise<void>)`: Execute after all tests
- `beforeEach(fn: (t?: TestContext) => void | Promise<void>, options?: TestOptions)`:
  Execute before each test
- `afterEach(fn: (t?: TestContext) => void | Promise<void>, options?: TestOptions)`:
  Execute after each test

### Parameterized Tests

- `testEach(cases: any[])`: Parameterized tests

### Performance Tests

- `bench(name: string, fn: () => void, options?)`: Performance benchmark test

### Browser Tests

**Browser test configuration (BrowserTestConfig)**:

- `enabled?: boolean`: Enable browser tests (default: `false`)
- `entryPoint?: string`: Client code entry file path
- `globalName?: string`: Global variable name (IIFE format)
- `headless?: boolean`: Headless mode (default: `true`)
- `executablePath?: string`: Chrome executable path (optional, auto-detect)
- `args?: string[]`: Chrome launch arguments
- `htmlTemplate?: string`: HTML template (optional)
- `bodyContent?: string`: Additional HTML body content (optional)
- `moduleLoadTimeout?: number`: Module load timeout (ms, default: `10000`)
- `reuseBrowser?: boolean`: Reuse browser instance at suite level (default:
  `true`)

**Browser context (BrowserContext)**:

- `browser`: Playwright Browser instance
- `page`: Playwright Page instance
- `evaluate<T>(fn: () => T | Promise<T>)`: Execute code in browser
- `goto(url: string)`: Navigate to specified URL
- `waitFor(fn: () => boolean, options?)`: Wait for condition in page
- `close()`: Close browser and page

**Standalone browser context usage** (from `@dreamer/test/browser`):

- `createBrowserContext(config: BrowserTestConfig)`: Create browser test context
- `buildClientBundle(options: BundleOptions)`: Bundle client code
- `createTestPage(options: TestPageOptions)`: Create test page
- `findChromePath()`: Detect system Chrome path (use when passing
  `executablePath` for visible debugging)
- `cleanupAllBrowsers()`: Clean up all browser instances (call after all tests
  complete)
- `cleanupSuiteBrowser(suitePath: string)`: Clean up specified suite's browser
  instances

---

## 📊 Test Report

This library has undergone comprehensive testing. 392 test cases passed, 2
skipped by design (test.skip / skipIf), achieving 100% test coverage. See
[TEST_REPORT.md](./docs/en-US/TEST_REPORT.md) for detailed report.

**Test statistics**:

- **Test files**: 19
- **Total tests**: 394
- **Passed**: 392 ✅
- **Skipped**: 2 (test.skip, skipIf, etc. skipped by design)
- **Failed**: 0
- **Pass rate**: 100% ✅
- **Execution time**: 13 seconds
- **Coverage**: All public APIs, edge cases, error handling
- **Environment**: Deno latest stable

**Test types**:

- ✅ Unit tests
- ✅ Browser tests
- ✅ Timeout option tests

**Highlights**:

- ✅ All functionality, edge cases, error handling have full test coverage
- ✅ Browser tests verify functionality in real Chrome environment
- ✅ Complete Mock functionality tests (function Mock, HTTP Mock)
- ✅ Comprehensive hook function execution tests (27 tests)
- ✅ Deno resolver plugin tests (17 tests)
- ✅ Browser beforeAll execution dedicated tests
- ✅ Browser resource cleanup mechanism tests

Full test report: [TEST_REPORT.md](./docs/en-US/TEST_REPORT.md)

---

## 📋 Changelog

**v1.0.9** (2026-02-19) — Changed: i18n `$t` → `$tr` (import `$tr` from i18n
when needed). Fixed: test imports from i18n.ts; browser test timeouts 30s.

See [CHANGELOG.md](./docs/en-US/CHANGELOG.md) for full history.

---

## 📝 Notes

- **Bun environment limitation**: In Bun, `test()` must be called during
  `describe()` execution, not during test execution
- **bench() call location**: `bench()` should be called during `describe()`
  execution, not inside `it()` callback
- **Resource cleanup**: When using third-party libraries, if you encounter timer
  or resource leak warnings, use `sanitizeOps: false` and
  `sanitizeResources: false` to disable checks
- **Browser test dependencies**:
  - Uses Playwright (run `npx playwright install chromium` if needed)
  - Auto-uses Playwright and @dreamer/esbuild for bundling
  - Supports auto-detect system Chrome path (macOS, Linux, Windows)
- **Browser test performance**:
  - Enabling `reuseBrowser: true` (default) significantly improves performance
  - Each test creates new page but shares browser instance
  - Auto cleanup browser resources after tests
- **Browser resource cleanup**:
  - Auto close page after each test
  - Browser instances remain in cache, unified cleanup after all tests complete
  - Auto calls `cleanupAllBrowsers()` on process exit (SIGINT, SIGTERM)
  - Recommended to manually call `cleanupAllBrowsers()` in suite's `afterAll`
    hook to ensure cleanup
- **Client code bundling**:
  - Uses @dreamer/esbuild for fast bundling
  - Supports TypeScript
  - Bundle result cached in memory

---

## 🤝 Contributing

Issues and Pull Requests welcome!

---

## 📄 License

Apache License 2.0 - see [LICENSE](./LICENSE)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
