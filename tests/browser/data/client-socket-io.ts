/**
 * 客户端测试入口文件
 * 测试 esbuild resolver 插件在浏览器编译时能否正确处理 socket-io client 和 logger client 依赖
 */

// 导入 JSR 包
import { ClientSocket } from "@dreamer/socket-io/client";
import { createLogger, type Logger } from "@dreamer/logger/client";

// 创建 logger 实例
const logger: Logger = createLogger({
  level: "info",
  prefix: "[Test]",
  debug: true,
});

// 导出测试函数
export function createSocketClient(url: string) {
  try {
    logger.info("创建 Socket 客户端", { url });

    // 创建 ClientSocket 实例
    const socket = new ClientSocket({
      url: url,
      autoConnect: false,
    });

    logger.debug("Socket 客户端创建成功");

    return {
      success: true,
      hasSocket: socket !== null && socket !== undefined,
      hasConnect: typeof socket.connect === "function",
      hasDisconnect: typeof socket.disconnect === "function",
      hasOn: typeof socket.on === "function",
      hasEmit: typeof socket.emit === "function",
      hasLogger: logger !== null && logger !== undefined,
      hasLoggerInfo: typeof logger.info === "function",
      hasLoggerError: typeof logger.error === "function",
    };
  } catch (error: any) {
    logger.error("创建 Socket 客户端失败", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 导出 logger 测试函数
export function testLogger() {
  logger.debug("调试信息");
  logger.info("信息日志");
  logger.warn("警告日志");
  logger.error("错误日志");

  return {
    success: true,
    hasLogger: logger !== null && logger !== undefined,
  };
}

// 设置全局变量，表示模块已加载
(globalThis as any).testReady = true;
