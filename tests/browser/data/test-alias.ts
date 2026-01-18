// 测试路径别名（通过 deno.json imports 配置）
// 这里使用 @dreamer/logger/client 作为别名测试（避免 Node.js 内置模块问题）
import { createLogger } from "@dreamer/logger/client";

const logger = createLogger("test-alias");
logger.info("Test path alias");

export { logger };
