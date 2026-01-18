// 测试没有 package.json 时的相对路径导入
// Bun 应该能够从缓存读取 npm 包，相对路径也能正常工作
import { helperFunction } from "./utils/helper.ts";

const result = helperFunction();
export { result };
