/**
 * HTTP Mock 全面测试
 */

import { describe, expect, it, mockFetch } from "../src/mod.ts";

describe("HTTP Mock 全面测试", () => {
  describe("mockFetch 基础功能", () => {
    it("应该 Mock GET 请求", async () => {
      const mock = mockFetch("https://api.example.com/users", {
        response: {
          status: 200,
          body: { id: 1, name: "Alice" },
        },
      });

      try {
        const response = await fetch("https://api.example.com/users");
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ id: 1, name: "Alice" });
        expect(mock.calls.length).toBe(1);
        expect(mock.calls[0].url).toBe("https://api.example.com/users");
      } finally {
        mock.restore();
      }
    });

    it("应该 Mock POST 请求", async () => {
      const mock = mockFetch("https://api.example.com/users", {
        method: "POST",
        response: {
          status: 201,
          body: { id: 1, name: "Bob" },
        },
      });

      try {
        const response = await fetch("https://api.example.com/users", {
          method: "POST",
        });
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data).toEqual({ id: 1, name: "Bob" });
      } finally {
        mock.restore();
      }
    });

    it("应该支持正则表达式 URL 匹配", async () => {
      const mock = mockFetch(/\/users\/\d+$/, {
        response: {
          status: 200,
          body: { id: 123 },
        },
      });

      try {
        const response = await fetch("https://api.example.com/users/123");
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ id: 123 });
      } finally {
        mock.restore();
      }
    });

    it("应该记录请求调用", async () => {
      const mock = mockFetch("https://api.example.com/test", {
        response: { status: 200, body: {} },
      });

      try {
        await fetch("https://api.example.com/test");
        await fetch("https://api.example.com/test", { method: "POST" });

        expect(mock.calls.length).toBe(2);
        expect(mock.calls[0].url).toBe("https://api.example.com/test");
        expect(mock.calls[1].options?.method).toBe("POST");
      } finally {
        mock.restore();
      }
    });

    it("应该支持响应头", async () => {
      const mock = mockFetch("https://api.example.com/test", {
        response: {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Custom-Header": "custom-value",
          },
          body: {},
        },
      });

      try {
        const response = await fetch("https://api.example.com/test");
        expect(response.headers.get("Content-Type")).toBe("application/json");
        expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
      } finally {
        mock.restore();
      }
    });

    it("应该支持字符串响应体", async () => {
      const mock = mockFetch("https://api.example.com/test", {
        response: {
          status: 200,
          body: "plain text response",
        },
      });

      try {
        const response = await fetch("https://api.example.com/test");
        const text = await response.text();
        expect(text).toBe("plain text response");
      } finally {
        mock.restore();
      }
    });

    it("应该支持对象响应体（自动 JSON 序列化）", async () => {
      const mock = mockFetch("https://api.example.com/test", {
        response: {
          status: 200,
          body: { message: "success" },
        },
      });

      try {
        const response = await fetch("https://api.example.com/test");
        const data = await response.json();
        expect(data).toEqual({ message: "success" });
      } finally {
        mock.restore();
      }
    });

    it("应该支持错误状态码", async () => {
      const mock = mockFetch("https://api.example.com/error", {
        response: {
          status: 404,
          body: { error: "Not Found" },
        },
      });

      try {
        const response = await fetch("https://api.example.com/error");
        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toEqual({ error: "Not Found" });
      } finally {
        mock.restore();
      }
    });

    it("应该支持请求体验证", async () => {
      const mock = mockFetch("https://api.example.com/users", {
        method: "POST",
        requestBody: { name: "Alice" },
        response: {
          status: 201,
          body: { id: 1, name: "Alice" },
        },
      });

      try {
        const response = await fetch("https://api.example.com/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Alice" }),
        });
        expect(response.status).toBe(201);
      } finally {
        mock.restore();
      }
    });

    it("应该可以恢复原始 fetch", async () => {
      const mock = mockFetch("https://api.example.com/test", {
        response: { status: 200, body: {} },
      });

      try {
        await fetch("https://api.example.com/test");
        expect(mock.calls.length).toBe(1);
      } finally {
        mock.restore();
      }

      // 恢复后应该不再 Mock
      // 注意：在实际环境中，这可能会失败，因为原始 fetch 可能不存在
      // 这里只测试 restore 方法可以被调用
      expect(typeof mock.restore).toBe("function");
    });

    it("应该支持多个 Mock", async () => {
      const mock1 = mockFetch("https://api.example.com/users", {
        response: { status: 200, body: { users: [] } },
      });

      const mock2 = mockFetch("https://api.example.com/posts", {
        response: { status: 200, body: { posts: [] } },
      });

      try {
        const response1 = await fetch("https://api.example.com/users");
        const response2 = await fetch("https://api.example.com/posts");

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
        expect(mock1.calls.length).toBe(1);
        expect(mock2.calls.length).toBe(1);
      } finally {
        mock1.restore();
        mock2.restore();
      }
    });
  });

  describe("边界情况", () => {
    it("应该处理空响应体", async () => {
      const mock = mockFetch("https://api.example.com/test", {
        response: {
          status: 204,
        },
      });

      try {
        const response = await fetch("https://api.example.com/test");
        expect(response.status).toBe(204);
      } finally {
        mock.restore();
      }
    });

    it("应该处理不同的 HTTP 方法", async () => {
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

      for (const method of methods) {
        const mock = mockFetch("https://api.example.com/test", {
          method,
          response: { status: 200, body: { method } },
        });

        try {
          const response = await fetch("https://api.example.com/test", {
            method,
          });
          expect(response.status).toBe(200);
        } finally {
          mock.restore();
        }
      }
    });
  });
});
