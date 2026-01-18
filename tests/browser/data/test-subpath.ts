// 测试子路径导出
import { createLogger } from "@dreamer/logger/client";

const logger = createLogger("test-subpath");
logger.info("Test subpath export");

export { logger };
