// 直接使用 jsr: 协议导入子路径
import { createLogger } from "jsr:@dreamer/logger@1.0.0-beta.7/client";

const logger = createLogger("test-jsr-direct");
logger.info("Test JSR protocol direct import");

export { logger };
