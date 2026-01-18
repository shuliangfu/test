/**
 * 测试相对路径导入
 */

import { createSocketClient } from "./client-socket-io.ts";

export function testRelativeImport() {
  const result = createSocketClient("http://localhost:30000");
  return result.success;
}

(globalThis as any).testReady = true;
