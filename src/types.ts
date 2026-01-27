/**
 * 测试相关类型定义
 */

/**
 * 测试套件配置
 */
export interface TestSuite {
  name: string;
  fn: () => void | Promise<void>;
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
  beforeEach?: (t?: TestContext) => void | Promise<void>;
  afterEach?: (t?: TestContext) => void | Promise<void>;
  tests: TestCase[];
  suites: TestSuite[];
  parent?: TestSuite;
  /** 标记 beforeAll 是否已执行（仅用于 Deno 环境） */
  _beforeAllExecuted?: boolean;
  /** 套件选项 */
  options?: DescribeOptions;
}

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
  /** 是否在套件级别复用浏览器实例（默认：true，可显著提升性能） */
  reuseBrowser?: boolean;
  /**
   * 是否将 JSR/npm 标为 external（仅影响打包格式，浏览器绝不生成 require）。
   * - true（默认）：输出 ESM，用 <script type="module"> 加载，external 为 import，不生成 require。
   * - false：输出 IIFE，把 JSR 等打进 bundle，用普通 script 也可；不生成 require。
   * 入口含 @dreamer/socket-io 等 JSR 时，设为 false 可省去“入口自挂 window[globalName]”的约定。
   */
  browserMode?: boolean;
  /**
   * 浏览器初始化失败时的行为（默认：'throw'）
   * - 'throw'：在调用测试函数前直接抛出原始错误，便于快速定位
   * - 'pass'：将错误写入 testContext._browserSetupError，仍执行测试函数，便于断言错误内容
   */
  onSetupError?: "throw" | "pass";
}

/**
 * 测试上下文接口（兼容 Deno.TestContext）
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

/**
 * 测试用例
 */
export interface TestCase {
  name: string;
  fn: (t?: TestContext) => void | Promise<void>;
  skip?: boolean;
  only?: boolean;
  timeout?: number;
  /** 是否禁用操作清理检查（用于第三方库的内部定时器） */
  sanitizeOps?: boolean;
  /** 是否禁用资源清理检查（用于第三方库的内部资源） */
  sanitizeResources?: boolean;
}

/**
 * Mock 函数调用记录
 */
export interface MockCall {
  /** 调用参数 */
  args: unknown[];
  /** 返回值 */
  result?: unknown;
  /** 调用时间 */
  timestamp: number;
}

/**
 * Mock 函数类型
 */
export interface MockFunction<T extends (...args: any[]) => any = any> {
  /** 原始函数（如果有） */
  originalFn?: T;
  /** 调用记录 */
  calls: MockCall[];
  /** 实现函数 */
  implementation?: T;
  /** 调用函数 */
  (...args: Parameters<T>): ReturnType<T>;
}

/**
 * 测试选项
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

/**
 * Setup/Teardown 钩子
 */
export interface TestHooks {
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
  beforeEach?: (t?: TestContext) => void | Promise<void>;
  afterEach?: (t?: TestContext) => void | Promise<void>;
  /** 钩子选项 */
  options?: TestOptions;
}

/**
 * 测试套件选项
 */
export interface DescribeOptions {
  /** 是否启用操作清理检查（默认：true） */
  sanitizeOps?: boolean;
  /** 是否启用资源清理检查（默认：true） */
  sanitizeResources?: boolean;
  /** 浏览器测试配置（可选，套件级别的默认配置） */
  browser?: BrowserTestConfig;
}

/**
 * HTTP Mock 配置
 */
export interface MockFetchOptions {
  /** HTTP 方法 */
  method?: string;
  /** 请求体 */
  requestBody?: unknown;
  /** 响应配置 */
  response: {
    /** 状态码 */
    status: number;
    /** 响应头 */
    headers?: Record<string, string>;
    /** 响应体 */
    body?: string | unknown;
  };
}

/**
 * HTTP Mock 函数
 */
export interface MockFetchFunction {
  /** 调用记录 */
  calls: Array<{
    url: string;
    options?: RequestInit;
  }>;
  /** 恢复原始 fetch */
  restore(): void;
}

// Expect 类在 expect.ts 中定义，这里只声明类型
// 使用前向声明避免循环依赖
declare class Expect {
  constructor(actual: unknown);
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toMatch(regex: RegExp | string): void;
  toContain(item: unknown): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeInstanceOf(expected: new (...args: any[]) => any): void;
  toHaveProperty(path: string, value?: unknown): void;
  toBeCloseTo(expected: number, numDigits?: number): void;
  toBeNaN(): void;
  toHaveLength(expected: number): void;
  toBeArray(): void;
  toBeString(): void;
  toBeNumber(): void;
  toBeBoolean(): void;
  toBeFunction(): void;
  toBeEmpty(): void;
  toStrictEqual(expected: unknown): void;
  toThrow(
    expectedError?: string | RegExp | (new (...args: any[]) => Error),
  ): void;
  get not(): Expect;
}

/**
 * 期望值函数类型
 */
export interface ExpectFunction {
  (actual: unknown): Expect;
  /**
   * 使测试失败
   * @param message 失败消息
   */
  fail(message?: string): never;
}
