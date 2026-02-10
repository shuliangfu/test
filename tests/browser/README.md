# Browser tests

Tests that use `@dreamer/test` browser integration (Playwright + Chromium).

## How to run

- **Install Chromium** (first time or if you see "Executable doesn't exist"):

  ```bash
  npx playwright install chromium
  ```

- **Recommended** (run browser tests sequentially to avoid multiple Chromium
  launches and hangs):

  ```bash
  deno test -A tests/browser
  ```

  Deno runs test files in parallel by default; to run one file at a time, run a
  single file (see below) or run with `deno test -A tests/browser/` and avoid
  opening many test files in parallel.

- Single file (one Chromium per file, no parallel file contention):

  ```bash
  deno test -A tests/browser/beforeall-execution.test.ts
  ```

## If tests hang

1. Stop the run (`Ctrl+C`).
2. Kill any leftover Chrome/Chromium processes (e.g.
   `pkill -9 -f "Google Chrome"` and `pkill -9 -f Chromium` on macOS, or close
   from Activity Monitor).
3. Run again as above (single file or full `tests/browser`).

First run can be slow while Chromium is launched or downloaded.

## 如何指定“用浏览器跑测试”

在 `describe` 的第二个参数里启用并配置 `browser` 即可：

```typescript
import { describe, expect, it } from "@dreamer/test";

describe("我的浏览器测试", {
  browser: {
    enabled: true, // 启用浏览器测试
    headless: true, // 无头模式（默认 true）
    browserType: "chromium", // 可选 "chromium" | "firefox" | "webkit"，默认 "chromium"
    // browserSource: "test",  // 仅 chromium 时有效：用 Playwright 自带浏览器
  },
}, () => {
  it("在浏览器里跑", async (t) => {
    const n = await t.browser!.evaluate(() => 1 + 1);
    expect(n).toBe(2);
  });
});
```

单条用例也可单独配 `browser`（会覆盖 describe 的配置）。

## 如何指定浏览器引擎（browserType）

- **chromium**（默认）：Playwright Chromium，先执行
  `npx playwright install chromium`
- **firefox**：Playwright Firefox，先执行 `npx playwright install firefox`
- **webkit**：Playwright WebKit，先执行 `npx playwright install webkit`

在配置里加上 `browserType: "firefox"` 或 `browserType: "webkit"`
即可用对应引擎跑同一套测试。

## Browser source（仅 Chromium）

- **Playwright 自带浏览器**（`browserSource: "test"`，不尝试系统浏览器）：\
  Uses Playwright's bundled Chromium. Install with
  `npx playwright install chromium`.

- **System Chrome** (`browserSource: "system"` or unset with
  `preferSystemChrome: true`):\
  Uses the Chrome/Chromium already installed on the machine (e.g. from PATH or
  well-known paths).

## “卡过一次后一直打不开，必须重启”的恢复办法（无需重启电脑）

若出现“只要卡过一次，后面 Chrome
就一直打不开，只能重启电脑”的情况，可按下面步骤**不重启**恢复：

1. **结束所有 Chrome/Chromium 进程**（任选一种执行即可）：
   - **macOS**：
     ```bash
     pkill -9 -f "Google Chrome"
     # 若用 Chromium：
     pkill -9 -f Chromium
     ```
   - 或在 **活动监视器** 中搜索 “Chrome” / “Chromium”，全部强制结束。

2. **（可选）清理 Playwright 缓存**，避免损坏的配置影响下次启动：
   ```bash
   rm -rf /tmp/.org.chromium.Chromium* 2>/dev/null
   # Playwright 浏览器缓存（按需清理，清理后需重新 npx playwright install chromium）
   # macOS 多为 ~/Library/Caches/ms-playwright，Linux 多为 ~/.cache/ms-playwright
   rm -rf "$HOME/Library/Caches/ms-playwright" 2>/dev/null
   rm -rf "$HOME/.cache/ms-playwright" 2>/dev/null
   ```

3. 再次运行浏览器测试（建议只跑单个文件或整目录，避免多文件并行抢资源）：
   ```bash
   deno test -A tests/browser
   # 或单文件
   deno test -A tests/browser/beforeall-execution.test.ts
   ```

4. **若仍报 “launch timed out”**：在测试配置里尝试 `browserSource: "test"` 或
   `dumpio: false`，再重跑。

**可选：一条命令完成步骤 1 + 3（不删缓存）**（在项目 `test` 目录下执行）：

```bash
pkill -9 -f "Google Chrome" 2>/dev/null; pkill -9 -f Chromium 2>/dev/null; deno test -A tests/browser/beforeall-execution.test.ts
```

本包在关闭浏览器时会做**超时处理**：若 `browser.close()` 在约 8
秒内未完成，会拒绝等待，减少僵尸进程导致的“卡过一次就再也打不开”现象。
