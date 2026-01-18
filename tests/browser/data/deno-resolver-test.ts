import { createLogger } from "@dreamer/logger/client";

const logger = createLogger("test");
logger.info("Test message from Deno resolver");

export { logger };
