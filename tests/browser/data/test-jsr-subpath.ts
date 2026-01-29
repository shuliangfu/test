import { createLogger } from "jsr:@dreamer/logger@1.0.0-beta.7/client";

const logger = createLogger("test");
logger.info("Test");

export { logger };
