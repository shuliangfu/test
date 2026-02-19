/**
 * 快照测试模块
 * 提供快照测试功能
 */

import {
  IS_BUN,
  IS_DENO,
  join,
  mkdir,
  readTextFile,
  resolve,
  writeTextFile,
} from "@dreamer/runtime-adapter";
import { $tr } from "./i18n.ts";
import type { TestContext } from "./types.ts";

/**
 * 将测试名称转为安全的文件名（Windows 兼容，并防止路径穿越）
 * 移除或替换 Windows 不允许的字符: \ / : * ? " < > |
 * 移除 ".." 防止路径穿越
 */
function sanitizeSnapshotFilename(name: string): string {
  return name
    .replace(/\s+/g, "-")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\.\./g, "") // 防止路径穿越
    .replace(/-+/g, "-") // 合并连续连字符
    .replace(/^-|-$/g, "") || "snapshot";
}

/**
 * 快照测试
 * @param t 测试上下文（可选，如果未提供则使用默认值）
 * @param value 要快照的值
 * @param hint 快照提示（可选）
 */
export async function assertSnapshot(
  t: TestContext | undefined,
  value: unknown,
  hint?: string,
): Promise<void> {
  const snapshotDir = resolve(".snapshots");
  // 如果没有提供测试上下文，使用默认名称
  const testName = t?.name || "unknown-test";
  const testFile = sanitizeSnapshotFilename(testName);
  const snapshotFile = hint ? `${testFile}-${hint}.snap` : `${testFile}.snap`;
  const snapshotPath = join(snapshotDir, snapshotFile);

  const serialized = JSON.stringify(value, null, 2);

  // 确保快照目录存在并读取/写入文件
  if (IS_DENO) {
    // Deno 环境
    try {
      await mkdir(snapshotDir, { recursive: true });
    } catch {
      // 目录可能已存在
    }

    // 读取现有快照
    let existingSnapshot: string | undefined;
    try {
      existingSnapshot = await readTextFile(snapshotPath);
    } catch {
      // 快照文件不存在，创建新快照
    }

    if (existingSnapshot === undefined) {
      // 首次运行，创建快照
      await writeTextFile(snapshotPath, serialized);
      return;
    }

    // 对比快照
    if (existingSnapshot !== serialized) {
      throw new Error(
        $tr("snapshot.mismatch", {
          expected: existingSnapshot,
          received: serialized,
        }),
      );
    }
  } else if (IS_BUN) {
    // 确保快照目录存在
    try {
      await mkdir(snapshotDir, { recursive: true });
    } catch {
      // 目录可能已存在
    }

    // 先尝试读取文件来检查快照是否存在
    const file = (globalThis as any).Bun.file(snapshotPath);
    const exists = await file.exists();

    // 读取现有快照
    let existingSnapshot: string | undefined;
    if (exists) {
      try {
        existingSnapshot = await file.text();
      } catch {
        // 读取失败，视为文件不存在
      }
    }

    if (existingSnapshot === undefined) {
      // 首次运行，创建快照（Bun.write 会自动创建目录）
      await (globalThis as any).Bun.write(snapshotPath, serialized);
      return;
    }

    // 对比快照
    if (existingSnapshot !== serialized) {
      throw new Error(
        $tr("snapshot.mismatch", {
          expected: existingSnapshot,
          received: serialized,
        }),
      );
    }
  } else {
    // 其他环境：不支持快照测试
    throw new Error($tr("snapshot.notSupported"));
  }
}
