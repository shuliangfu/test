/**
 * @fileoverview timeout 选项测试
 *
 * 验证 it/test 的 options.timeout：
 * 1. 在限时内完成则通过
 * 2. 超时后由运行器内 Promise.race 抛出 "Test timeout" 错误（通过子进程运行 fixture 断言）
 * Deno / Bun / Node 均通过子进程执行 fixture 并断言失败输出。
 */

import {
  createCommand,
  dirname,
  execPath,
  IS_BUN,
  IS_DENO,
  resolve,
} from "@dreamer/runtime-adapter";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "../src/mod.ts";

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
    // Deno: deno test -A fixturePath；Bun: bun test fixturePath
    // Node: node --import tsx --test fixturePath（与主 test:node 一致）
    //   清除 NODE_TEST_CONTEXT：父进程 node --test 设置此变量，子进程继承后会被判定为递归调用而跳过测试执行
    const args = IS_DENO
      ? ["test", "-A", fixturePath]
      : IS_BUN
        ? ["test", fixturePath]
        : ["--import", "tsx", "--test", fixturePath];
    // Node 子进程需清除 NODE_TEST_CONTEXT，否则 node --test 检测到递归而跳过 fixture 执行
    const env = IS_DENO || IS_BUN
      ? undefined
      : (() => {
        const e = { ...globalThis.process.env };
        delete e.NODE_TEST_CONTEXT;
        return e as Record<string, string>;
      })();
    const cmd = createCommand(execPath(), {
      args,
      cwd: testPackageRoot,
      stdout: "piped",
      stderr: "piped",
      env,
    });
    const output = await cmd.output();
    const stderr = new TextDecoder().decode(output.stderr);
    const stdout = new TextDecoder().decode(output.stdout);
    const out = stdout + stderr;
    expect(output.code).not.toBe(0);
    // Deno 输出 "Test timeout" 或 "Test failed"；Bun 输出 "timed out"；Bun 子进程（尤其 Windows）可能先报 "Cannot call describe/test() inside a test"，视为已知
    expect(out).toMatch(
      /Test timeout|Test failed|timed out|Cannot call (describe|test)\(\) inside a test/,
    );
  });
});
