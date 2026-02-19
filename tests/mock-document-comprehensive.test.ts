/**
 * Document/Cookie Mock 全面测试
 * 验证 createCookieDocument 的累积行为（不覆盖）
 */

import { createCookieDocument, describe, expect, it } from "../src/mod.ts";

describe("createCookieDocument", () => {
  it("应返回带 cookie getter/setter 的对象", () => {
    const doc = createCookieDocument();
    expect(doc).toBeDefined();
    expect(typeof doc.cookie).toBe("string");
    doc.cookie = "a=1";
    expect(doc.cookie).toBe("a=1");
  });

  it("应累积多个 cookie，不覆盖", () => {
    const doc = createCookieDocument();
    doc.cookie = "token1=value1; Path=/";
    doc.cookie = "token2=value2; Path=/";
    expect(doc.cookie).toContain("token1=value1");
    expect(doc.cookie).toContain("token2=value2");
    expect(doc.cookie).toBe("token1=value1; token2=value2");
  });

  it("应支持按 name 更新同一 cookie", () => {
    const doc = createCookieDocument();
    doc.cookie = "sid=old; Path=/";
    doc.cookie = "sid=new; Path=/";
    expect(doc.cookie).toBe("sid=new");
  });

  it("应支持空值删除 cookie", () => {
    const doc = createCookieDocument();
    doc.cookie = "toRemove=something; Path=/";
    expect(doc.cookie).toContain("toRemove=something");
    doc.cookie = "toRemove=; Path=/";
    expect(doc.cookie).not.toContain("toRemove");
    expect(doc.cookie).toBe("");
  });

  it("应对 name/value 做 encode/decode", () => {
    const doc = createCookieDocument();
    doc.cookie = "a%20b=val%3Due; Path=/";
    expect(doc.cookie).toContain("a%20b=val%3Due");
    const doc2 = createCookieDocument();
    doc2.cookie = "key=hello%20world";
    expect(doc2.cookie).toBe("key=hello%20world");
  });

  it("每次调用应返回独立 store", () => {
    const doc1 = createCookieDocument();
    const doc2 = createCookieDocument();
    doc1.cookie = "x=1";
    expect(doc2.cookie).toBe("");
    expect(doc1.cookie).toBe("x=1");
  });
});
