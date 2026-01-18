var RelativeImportTest = (() => {
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

  // tests/browser/data/client-relative.ts
  var client_relative_exports = {};
  __export(client_relative_exports, {
    testRelativeImport: () => testRelativeImport
  });

  // tests/browser/data/client-socket-io.ts
  var import_client = __require("https://esm.sh/jsr/@dreamer/socket-io@1.0.0-beta.2/client");
  var import_client2 = __require("https://esm.sh/jsr/@dreamer/logger@1.0.0-beta.4/client");
  var logger = (0, import_client2.createLogger)({
    level: "info",
    prefix: "[Test]",
    debug: true
  });
  function createSocketClient(url) {
    try {
      logger.info("\u521B\u5EFA Socket \u5BA2\u6237\u7AEF", { url });
      const socket = new import_client.ClientSocket({
        url,
        autoConnect: false
      });
      logger.debug("Socket \u5BA2\u6237\u7AEF\u521B\u5EFA\u6210\u529F");
      return {
        success: true,
        hasSocket: socket !== null && socket !== void 0,
        hasConnect: typeof socket.connect === "function",
        hasDisconnect: typeof socket.disconnect === "function",
        hasOn: typeof socket.on === "function",
        hasEmit: typeof socket.emit === "function",
        hasLogger: logger !== null && logger !== void 0,
        hasLoggerInfo: typeof logger.info === "function",
        hasLoggerError: typeof logger.error === "function"
      };
    } catch (error) {
      logger.error("\u521B\u5EFA Socket \u5BA2\u6237\u7AEF\u5931\u8D25", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  globalThis.testReady = true;

  // tests/browser/data/client-relative.ts
  function testRelativeImport() {
    const result = createSocketClient("http://localhost:30000");
    return result.success;
  }
  globalThis.testReady = true;
  return __toCommonJS(client_relative_exports);
})();

if (typeof window !== 'undefined') {
  window.RelativeImportTest = RelativeImportTest;
}