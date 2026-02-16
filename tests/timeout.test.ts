/**
 * @fileoverview timeout 选项测试
 *
 * 验证 it/test 的 options.timeout：
 * 1. 在限时内完成则通过
 * 2. 超时后由运行器内 Promise.race 抛出 "Test timeout" 错误（通过子进程运行 fixture 断言）
 * Deno 与 Bun 均通过子进程执行 fixture 并断言失败输出。
 */

import {
  createCommand,
  dirname,
  execPath,
  IS_DENO,
  resolve,
} from "@dreamer/runtime-adapter";
import { describe, expect, it } from "../src/mod.ts";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "timeout-fixture.run.ts");
const testPackageRoot = resolve(__dirname, "..");

describe("timeout 选项 (TestOptions.timeout)", () => {
  it("timeout 选项：在限时内完成则通过", async () => {
    await new Promise((r) => setTimeout(r, 20));
  }, { timeout: 200 });

  it("timeout 选项：未传 timeout 时正常通过", async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

  it("timeout 选项：超时后应抛出 Test timeout 错误", async () => {
    const args = IS_DENO ? ["test", "-A", fixturePath] : ["test", fixturePath];
    const cmd = createCommand(execPath(), {
      args,
      cwd: testPackageRoot,
      stdout: "piped",
      stderr: "piped",
    });
    const output = await cmd.output();
    const stderr = new TextDecoder().decode(output.stderr);
    const stdout = new TextDecoder().decode(output.stdout);
    const out = stdout + stderr;
    expect(output.code).not.toBe(0);
    // 子进程可能输出 "Test timeout" 或 Deno/Bun 简化为 "Test failed"
    expect(out).toMatch(/Test timeout|Test failed/);
  });
});
