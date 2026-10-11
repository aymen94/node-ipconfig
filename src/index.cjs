"use strict";
const load = () => import("./index.js");
const api = {};
for (const name of [
  "execute",
  "getRawOutput",
  "getConfig",
  "getAdapters",
  "getAdapter",
  "getIPv4",
  "getIPv6",
  "getDefaultGateway",
  "getDnsServers",
  "getMacAddresses",
  "getHostname",
  "release",
  "renew",
  "flushDns",
  "getDnsCache",
  "displayDns",
  "registerDns",
  "showClassId",
  "setClassId",
  "showClassId6",
  "setClassId6",
]) {
  api[name] = (...args) =>
    load().then(({ ipconfig }) => ipconfig[name](...args));
}
api.parseIpconfig = (...args) =>
  load().then(({ parseIpconfig }) => parseIpconfig(...args));
api.createIpconfig = (options) => {
  const instance = {};
  for (const name of [
    "execute",
    "getRawOutput",
    "getConfig",
    "getAdapters",
    "getAdapter",
    "getIPv4",
    "getIPv6",
    "getDefaultGateway",
    "getDnsServers",
    "getMacAddresses",
    "getHostname",
    "release",
    "renew",
    "flushDns",
    "getDnsCache",
    "displayDns",
    "registerDns",
    "showClassId",
    "setClassId",
    "showClassId6",
    "setClassId6",
  ]) {
    instance[name] = (...args) =>
      load().then(({ createIpconfig }) =>
        createIpconfig(options)[name](...args),
      );
  }
  return instance;
};
module.exports = api;
