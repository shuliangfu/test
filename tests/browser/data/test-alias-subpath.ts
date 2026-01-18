import { createLogger } from "@dreamer/logger/client";

const logger = createLogger("test");
logger.info("Test alias subpath");

export { logger };
