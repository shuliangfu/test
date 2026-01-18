// 测试相对路径导入
import { helperFunction } from "./utils/helper.ts";
import { settings } from "./config/settings.ts";

const result = helperFunction();
const config = settings;

export { result, config };
