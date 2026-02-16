/**
 * 供 timeout 测试用的 fixture：单用例故意超时（sleep 长于 timeout），
 * 仅由 timeout.test.ts 通过子进程运行，用于断言超时后报错。
 * 命名为 .run.ts 避免被 deno test tests/ 或 bun test 自动发现而拉高整库失败数。
 */

import { describe, it } from "../src/mod.ts";

describe("timeout fixture", () => {
  it("故意超时：sleep 400ms，timeout 150ms", async () => {
    await new Promise((r) => setTimeout(r, 400));
  }, { timeout: 150 });
});
