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
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
  tests: TestCase[];
  suites: TestSuite[];
  parent?: TestSuite;
  /** 标记 beforeAll 是否已执行（仅用于 Deno 环境） */
  _beforeAllExecuted?: boolean;
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
 * Setup/Teardown 钩子
 */
export interface TestHooks {
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
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
