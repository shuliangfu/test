/**
 * Document Mock 模块
 * 提供 document.cookie 等浏览器环境 Mock，行为与浏览器一致（多次 set 累积，不覆盖）
 */

/**
 * 创建类似浏览器的 document.cookie mock
 *
 * - 多次对 document.cookie 赋值会累积多个 cookie（按 name 更新/删除），而不是整串覆盖
 * - 赋值空值或过期即删除对应 name
 * - 适用于依赖 document.cookie 的 Cookie 管理测试
 *
 * @returns 带有 get/set cookie 的 document 形状对象，可赋给 (globalThis as any).document
 * @example
 * ```ts
 * (globalThis as any).document = createCookieDocument();
 * document.cookie = "a=1; Path=/";
 * document.cookie = "b=2; Path=/";
 * console.log(document.cookie); // "a=1; b=2"
 * ```
 */
export function createCookieDocument(): { cookie: string } {
  const store: Record<string, string> = {};

  return {
    get cookie(): string {
      return Object.entries(store)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("; ");
    },
    set cookie(val: string) {
      const [first] = val.split(";");
      const eq = first.indexOf("=");
      if (eq < 0) return;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      try {
        const nameDec = decodeURIComponent(name);
        const valueDec = value ? decodeURIComponent(value) : "";
        // 空值视为删除（如 remove 或 Expires=过去）
        if (valueDec === "") {
          delete store[nameDec];
        } else {
          store[nameDec] = valueDec;
        }
      } catch {
        if (value === "") {
          delete store[name];
        } else {
          store[name] = value;
        }
      }
    },
  };
}
