# Changelog

All notable changes to @dreamer/test are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
