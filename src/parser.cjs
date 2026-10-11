"use strict";
exports.parseIpconfig = (...args) =>
  import("./parser.js").then(({ parseIpconfig }) => parseIpconfig(...args));
