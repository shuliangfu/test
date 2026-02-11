/**
 * HTTP Mock 模块
 * 提供 HTTP 请求 Mock 功能
 */

import type { MockFetchFunction, MockFetchOptions } from "./types.ts";

/**
 * Mock fetch 函数
 * @param urlPattern URL 模式（字符串或正则表达式）
 * @param options Mock 配置
 * @returns Mock 函数
 */
export function mockFetch(
  urlPattern: string | RegExp,
  options: MockFetchOptions,
): MockFetchFunction {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; options?: RequestInit }> = [];

  const mockFn = function (input: string | URL | Request, init?: RequestInit) {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

    // 检查 URL 是否匹配
    const matches = typeof urlPattern === "string"
      ? url === urlPattern
      : urlPattern.test(url);

    if (!matches) {
      // 不匹配，使用原始 fetch
      return originalFetch(input, init);
    }

    // 记录调用
    calls.push({ url, options: init });

    // 检查方法是否匹配
    const method = init?.method || "GET";
    if (
      options.method && method.toUpperCase() !== options.method.toUpperCase()
    ) {
      return originalFetch(input, init);
    }

    // 检查请求体是否匹配（安全序列化：Stream 等不可序列化时视为不匹配）
    if (options.requestBody !== undefined) {
      let requestBody: string | undefined;
      try {
        requestBody = init?.body
          ? (typeof init.body === "string"
            ? init.body
            : JSON.stringify(init.body))
          : undefined;
      } catch {
        return originalFetch(input, init);
      }
      const expectedBody = typeof options.requestBody === "string"
        ? options.requestBody
        : JSON.stringify(options.requestBody);

      if (requestBody !== expectedBody) {
        return originalFetch(input, init);
      }
    }

    // 返回 Mock 响应
    const responseBody = typeof options.response.body === "string"
      ? options.response.body
      : JSON.stringify(options.response.body);

    return Promise.resolve(
      new Response(responseBody, {
        status: options.response.status,
        headers: options.response.headers,
      }),
    );
  } as typeof fetch;

  // 替换全局 fetch
  globalThis.fetch = mockFn;

  const mock: MockFetchFunction = {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };

  return mock;
}
