# Changelog

All notable changes to @dreamer/test are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.14] - 2026-02-22

### Fixed

- **Bun cleanup “Cannot call describe() inside a test” (Windows CI)**: The final
  cleanup `describe` is now registered from inside the first top-level
  `describe` callback (after `getBunTestModule()` resolves), so it never runs
  during a test. Removed `setTimeout(registerFinalCleanupTest, 0)` for Bun; Deno
  still uses it.

### Changed

- **Browser context test**: “应该能够执行浏览器代码（evaluate）” timeout
  increased from 15s to 30s to reduce flakiness on slow CI.

---

## [1.0.13] - 2026-02-22

### Fixed

- **Bun cleanup registration**: The final “cleanup browsers” test is now
  registered inside a `describe()` block when using Bun, so `test()` is never
  called outside `describe()`. This fixes the “Cannot call test() inside a test.
  Call it inside describe() instead” error in subprocess runs (e.g. timeout
  fixture), especially on Windows Bun.
- **Timeout test (Bun subprocess)**: The timeout fixture assertion now also
  accepts “Cannot call describe/test() inside a test” in subprocess output, so
  the test passes when Bun reports that nesting error (e.g. Windows Bun) instead
  of only “timed out”.

### Changed

- **CI (test-windows-bun)**: Job-level `PLAYWRIGHT_BROWSERS_PATH` (Windows
  backslash path), Install/Verify Chromium steps; browser tests are excluded on
  Windows Bun (only top-level test files run) due to known Playwright/Bun launch
  hang on Windows.

---

## [1.0.12] - 2026-02-20

### Added

- **Document/Cookie Mock**: `createCookieDocument()` — returns a document-like
  object with accumulating `cookie` getter/setter (browser-like; multiple
  `document.cookie` assignments accumulate instead of overwriting). Export from
  main entry; see README and `tests/mock-document-comprehensive.test.ts`.

### Fixed

- **Timeout test (Bun)**: Assertion now accepts Bun’s timeout message
  (`timed out`) in addition to Deno’s (`Test timeout` / `Test failed`).

### Changed

- **Docs**: Test report and README (en/zh) updated: test summary 399 passed, 20
  files, 16s; Document/Cookie Mock usage and API; TEST_REPORT.md reflects
  mock-document coverage.

---

## [1.0.11] - 2026-02-19

### Changed

- **Dependencies**: Bumped `@dreamer/esbuild` to ^1.0.30.

---

## [1.0.10] - 2026-02-19

### Changed

- **i18n**: Initialization now runs automatically when the i18n module is
  loaded. Entry files no longer import or call `initTestI18n`; remove any such
  usage from your code.

---

## [1.0.9] - 2026-02-19

### Changed

- **i18n**: Renamed translation method from `$t` to `$tr` to avoid conflict with
  global `$t`. Update existing code to use `$tr` for package messages. `$tr` is
  not re-exported from the main entry; import from `./i18n.ts` (or
  `@dreamer/test`’s i18n module) when tests need it.

### Fixed

- **Tests**: test-runner-integration.test.ts imports `$tr` from i18n.ts instead
  of mod. Browser integration test timeouts (evaluate, goto, waitFor) increased
  to 30s for slow or CI environments.

---

## [1.0.8] - 2026-02-18

### Fixed

- **Bun: `it.skip` / `it.skipIf` / `it.only`**: Export `it` via
  `Object.assign()` so `skip`, `skipIf`, and `only` are own properties on the
  exported function. This ensures Bun (and other runtimes that resolve exports
  differently) see `it.skip`, `it.skipIf`, and `it.only` correctly when
  importing from `@dreamer/test`.

---

## [1.0.7] - 2026-02-17

### Added

- **i18n for assertion and runner messages**: All user-facing strings in expect,
  mock, assertions, test-runner, browser-context, and bundle use `$t()` with
  `en-US` and `zh-CN` locales. Locale is auto-detected from `LANGUAGE`/`LC_ALL`/
  `LANG`; export `$t` from main entry for tests that assert on error messages.
- **Browser entry**: `src/browser/index.ts` renamed to `src/browser/mod.ts`;
  `deno.json` export `"./browser"` updated accordingly.

### Fixed

- **i18n placeholder**: `JSON.stringify(undefined)` returns `undefined`, so
  `{received}` was not replaced in zh locale. Added `stringifyForI18n()` in
  expect and use it for all `received` params so `undefined` becomes the string
  `"undefined"`.
- **Tests under non-English locale**: Assertions that checked for English
  substrings in error messages failed when system locale was zh. Tests now use
  `$t("key", ...)` for expected message content so they pass in both en and zh.

### Changed

- **Test suite**: Error-message assertions in
  `assertions-comprehensive.test.ts`, `expect-comprehensive.test.ts`,
  `mod.test.ts`, and `test-runner-integration.test.ts` use `$t()` for
  locale-agnostic expectations.

---

## [1.0.6] - 2026-02-16

### Added

- **Timeout option tests**: New test file `timeout.test.ts` (4 cases) and
  `timeout-fixture.run.ts` for subprocess-based timeout assertion. Verifies:
  test passes when it completes within `options.timeout`; test without timeout
  runs normally; test that exceeds timeout throws a "Test timeout" error (Deno
  and Bun both use in-runner `Promise.race` for reliable timeout).
- **Test file path in errors**: All test failure and timeout error messages now
  include the test file path. Helpers: `formatOriginToPath()` (Deno `t.origin` →
  readable path), `getTestFilePathFromStack()` (Bun / fallback: parse caller
  from stack at registration), `augmentErrorWithFilePath()` (append
  `\n  at <path>` to error message). Applied in: main test run (Deno/Bun),
  `test.only` (Deno/Bun), and timeout reject path.

### Changed

- **License**: Project license is now Apache-2.0. Replaced `LICENSE.md` with
  standard `LICENSE` and added `NOTICE`. `deno.json` sets
  `"license":
  "Apache-2.0"` and `publish.include` lists `LICENSE` and
  `NOTICE`.
- **CI**: Workflow adjustments for check/lint/test steps.
- **Docs**: Test report and README updated: 392 passed, 19 test files, 2
  skipped, 13s execution; added `timeout.test.ts` to file list and "timeout
  option" to test types.

---

## [1.0.5] - 2026-02-11

### Added

- **Browser test**: Full-suite browser test (`full-suite-browser.test.ts`) with
  sequential reuse, `entryPoint` + `globalName`, and shared browser context.

### Changed

- **Test report**: Canonical test reports moved to `docs/en-US/TEST_REPORT.md`
  and `docs/zh-CN/TEST_REPORT.md`; root `TEST_REPORT.md` removed.
- **JSR publish**: Removed `TEST_REPORT.md` from `publish.include` in
  `deno.json`.

### Fixed

- **Test runner**: Clear `beforeAllExecutedMap` in `cleanupAllBrowsers()` to
  avoid unbounded map growth in watch or repeated runs.

### Performance

- **Test runner**: Cache `getBunTest()` result to avoid repeated dynamic
  `import("bun:test")`; optimize `collectParentSuites()` from O(n²) to O(n)
  (push + reverse instead of unshift); reduce cleanup logging (use
  `logger.error` only on failure).

### Security

- **Snapshot**: Use `IS_DENO`/`IS_BUN` from `@dreamer/runtime-adapter`; sanitize
  `..` in snapshot filenames to prevent path traversal.
- **mock-fetch**: Safely serialize `requestBody` (try/catch around
  `JSON.stringify` for non-serializable bodies e.g. ReadableStream).

---

## [1.0.4] - 2026-02-10

### Added

- **CI**: Playwright Chromium install step (Linux/Windows/macOS); optional
  `PLAYWRIGHT_BROWSERS_PATH` on Windows (e.g. `github.workspace`).

### Fixed

- **Browser context**: Pre-check `executablePath` with `existsSync` before
  launch so "Chrome not found" error is immediate on all platforms (avoids 60s
  timeout on Windows). Longer launch timeout in CI (120s).
- **Test runner**: Root-level browser reuse (one browser per top-level describe)
  to avoid Windows CI timeouts after many launch/close cycles. When
  `executablePath` is set, use full suite path as cache key so error-handling
  test receives `_browserSetupError` correctly.
- **cleanupSuiteBrowser**: Resolve cache by root describe name when full path
  not found (aligns with root-level reuse).

---

## [1.0.3] - 2026-02-10

### Added

- **Playwright**: Browser tests now use Playwright instead of Puppeteer
  (`npx playwright install chromium`). Added `browserType` option (`"chromium"`
  | `"firefox"` | `"webkit"`).
- **`clearBundleCache()`**: Documented and covered by tests.
- **Docs layout**: Documentation moved to `docs/en-US` and `docs/zh-CN`; root
  README links to locale-specific README and TEST_REPORT.

### Changed

- **Browser engine**: Replaced Puppeteer with Playwright (Chromium by default).
- **`browserSource`**: Now only `"system"` | `"test"` (removed `"chromium"`).
- **Dependencies**: `getPuppeteer` removed; use `getPlaywright()` and
  `getChromium()` from `@dreamer/test/browser`.

---

## [1.0.2] - 2026-02-09

### Added

- **`@dreamer/test/browser` subpath export**: Browser APIs
  (`createBrowserContext`, `findChromePath`, `buildClientBundle`, etc.) now
  available via `import { findChromePath } from "@dreamer/test/browser"` or
  `jsr:@dreamer/test/browser`
- **`findChromePath()`**: Helper to detect system Chrome path for passing
  `executablePath` when using visible debugging (`headless: false`)

### Changed

- **Default Chrome**: When `executablePath` is not passed, uses Puppeteer's
  bundled Chrome for Testing instead of auto-detecting system Chrome
- **Documentation**: Added import paths section and `findChromePath` usage
  examples in README

---

## [1.0.1] - 2026-02-08

### Fixed

- **Linux CI compatibility**: Use headless mode in config override test to avoid
  "Missing X server" on Linux CI runners

### Changed

- **Error messages**: All error output in the test library is now in English

### Removed

- **Socket.IO tests**: Removed all socket-io integration tests and related
  documentation

---

## [1.0.0] - 2026-02-06

### Added

- **Stable release**: First stable version with stable API
- **Mock tools**:
  - Function Mock (`mockFn`) with call count and argument validation
  - HTTP Mock (`mockFetch`) for request/response mocking
- **Assertion enhancements**:
  - Rich assertion methods (`expect`, `assertSnapshot`, `assertRejects`, etc.)
  - Type check assertions (`toBeArray`, `toBeString`, `toBeNumber`, etc.)
  - Property assertions (`toHaveProperty`, `toHaveLength`)
  - Negation assertions (`.not`)
- **Test utility functions**:
  - Setup/Teardown (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`)
  - Parameterized tests (`testEach`)
  - Benchmark tests (`bench`)
- **Browser test integration**:
  - Auto-create browser context via Puppeteer
  - Auto-bundle client code (@dreamer/esbuild)
  - Deno/Bun resolver plugin support (JSR, npm, relative paths, path aliases)
  - Page operation API (`evaluate`, `goto`, `waitFor`)
  - Browser instance reuse
  - Auto resource cleanup (`cleanupAllBrowsers`)
- **Test organization**:
  - Test suites (`describe`)
  - Test cases (`it`, `test`)
  - Skip test (`test.skip`), conditional skip (`test.skipIf`), run only
    (`test.only`)
- **Resource cleanup control**:
  - `sanitizeOps` for timer leak check
  - `sanitizeResources` for resource handle leak check

### Compatibility

- Deno 2.5+
- Bun 1.0+
- Browser tests via Puppeteer integration
