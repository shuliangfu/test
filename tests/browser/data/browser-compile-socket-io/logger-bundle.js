var LoggerTest = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tests/browser/data/client-logger.ts
  var client_logger_exports = {};
  __export(client_logger_exports, {
    testLoggerFunctions: () => testLoggerFunctions
  });
  var import_client = __require("https://esm.sh/jsr/@dreamer/logger@1.0.0-beta.4/client");
  var logger = (0, import_client.createLogger)({
    level: "info",
    prefix: "[LoggerTest]",
    debug: true
  });
  function testLoggerFunctions() {
    logger.debug("\u8C03\u8BD5\u4FE1\u606F");
    logger.info("\u4FE1\u606F\u65E5\u5FD7");
    logger.warn("\u8B66\u544A\u65E5\u5FD7");
    logger.error("\u9519\u8BEF\u65E5\u5FD7");
    return {
      success: true,
      hasLogger: logger !== null && logger !== void 0,
      hasDebug: typeof logger.debug === "function",
      hasInfo: typeof logger.info === "function",
      hasWarn: typeof logger.warn === "function",
      hasError: typeof logger.error === "function"
    };
  }
  globalThis.loggerTestReady = true;
  return __toCommonJS(client_logger_exports);
})();

if (typeof window !== 'undefined') {
  window.LoggerTest = LoggerTest;
}