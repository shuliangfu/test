// 测试路径别名解析
// 使用 @/ 别名指向 ./src/
import { formatMessage } from "@/utils.ts";
// 使用 @/lib/ 别名指向 ./src/lib/
import { add, multiply } from "@/lib/math.ts";
// 使用 ~/ 别名指向 ./
import { helperFunction } from "~/utils/helper.ts";
// 使用 ~config/ 别名指向 ./config/
import { settings } from "~config/settings.ts";

const msg = formatMessage("Hello");
const sum = add(1, 2);
const product = multiply(3, 4);
const helper = helperFunction();
const config = settings;

export { msg, sum, product, helper, config };
