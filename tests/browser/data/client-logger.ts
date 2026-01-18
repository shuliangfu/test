/**
 * 测试 logger client 编译
 */

import { createLogger, type Logger } from "@dreamer/logger/client";

// 创建 logger 实例
const logger: Logger = createLogger({
  level: "info",
  prefix: "[LoggerTest]",
  debug: true,
});

// 导出测试函数
export function testLoggerFunctions() {
  logger.debug("调试信息");
  logger.info("信息日志");
  logger.warn("警告日志");
  logger.error("错误日志");

  return {
    success: true,
    hasLogger: logger !== null && logger !== undefined,
    hasDebug: typeof logger.debug === "function",
    hasInfo: typeof logger.info === "function",
    hasWarn: typeof logger.warn === "function",
    hasError: typeof logger.error === "function",
  };
}

// 设置全局变量，表示模块已加载
(globalThis as any).loggerTestReady = true;
