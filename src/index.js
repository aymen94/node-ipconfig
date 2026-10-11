import { hostname as systemHostname } from "node:os";
import { createRunner, IpconfigError } from "./command.js";
import { parseIpconfig } from "./parser.js";
import { formatConfig } from "./format.js";

const EXECUTION_OPTIONS = new Set([
  "timeout",
  "signal",
  "encoding",
  "rawResult",
]);
const QUERY_OPTIONS = new Set([...EXECUTION_OPTIONS, "all"]);
const CONFIG_OPTIONS = new Set([...QUERY_OPTIONS, "format"]);
const COMMANDS = Object.freeze({
  config: [],
  all: ["/all"],
  release: ["/release"],
  release6: ["/release6"],
  renew: ["/renew"],
  renew6: ["/renew6"],
  flushdns: ["/flushdns"],
  displaydns: ["/displaydns"],
  registerdns: ["/registerdns"],
  showclassid: ["/showclassid"],
  setclassid: ["/setclassid"],
  showclassid6: ["/showclassid6"],
  setclassid6: ["/setclassid6"],
});

function validateOptions(options, allowed) {
  if (options === undefined) options = {};
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw new TypeError("options must be an object");
  for (const key of Object.keys(options))
    if (!allowed.has(key)) throw new TypeError(`Unsupported option: ${key}`);
  if (
    options.timeout !== undefined &&
    (!Number.isInteger(options.timeout) || options.timeout <= 0)
  )
    throw new TypeError("timeout must be a positive integer");
  if (
    options.signal !== undefined &&
    (typeof options.signal !== "object" ||
      typeof options.signal.aborted !== "boolean")
  )
    throw new TypeError("signal must be an AbortSignal");
  if (options.encoding !== undefined && typeof options.encoding !== "string")
    throw new TypeError("encoding must be a supported Node.js encoding name");
  if (options.rawResult !== undefined && typeof options.rawResult !== "boolean")
    throw new TypeError("rawResult must be a boolean");
  return options;
}

function queryOptions(options) {
  validateOptions(options, QUERY_OPTIONS);
  if (options.all !== undefined && typeof options.all !== "boolean")
    throw new TypeError("all must be a boolean");
  const { all, ...execution } = options;
  return {
    args: all ? ["/all"] : [],
    execution: { ...execution, rawResult: false },
  };
}

function adapterArgument(value, label = "adapter") {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 256 ||
    /[\0\r\n]/.test(value) ||
    value.trim().startsWith("/")
  ) {
    throw new TypeError(
      `${label} must be a non-empty adapter name without control characters or option prefixes`,
    );
  }
  return value.trim();
}
function classIdArgument(value) {
  if (
    typeof value !== "string" ||
    value.length > 256 ||
    /[\0\r\n]/.test(value) ||
    value.startsWith("/")
  ) {
    throw new TypeError(
      "classId must be a string without control characters or option prefixes",
    );
  }
  return value;
}
function commandOptions(options, command) {
  const adapterAllowed = [
    "release",
    "release6",
    "renew",
    "renew6",
    "showclassid",
    "setclassid",
    "showclassid6",
    "setclassid6",
  ].includes(command);
  const classIdAllowed = ["setclassid", "setclassid6"].includes(command);
  validateOptions(
    options,
    new Set([
      ...EXECUTION_OPTIONS,
      ...(adapterAllowed ? ["adapter"] : []),
      ...(classIdAllowed ? ["classId"] : []),
    ]),
  );
  const args = [...COMMANDS[command]];
  if (
    ["release", "release6", "renew", "renew6"].includes(command) &&
    options.adapter !== undefined
  )
    args.push(adapterArgument(options.adapter));
  if (command === "showclassid" || command === "showclassid6")
    args.push(adapterArgument(options.adapter));
  if (command === "setclassid" || command === "setclassid6") {
    args.push(adapterArgument(options.adapter));
    if (options.classId !== undefined)
      args.push(classIdArgument(options.classId));
  }
  const { adapter, classId, ...execution } = options;
  return { args, execution };
}

function flatten(adapters, field) {
  return adapters.flatMap((adapter) =>
    (adapter[field] ?? []).map((address) => ({
      adapter: adapter.name,
      address,
    })),
  );
}

export function createIpconfig({ platform = process.platform, exec } = {}) {
  const run = createRunner({ platform, ...(exec ? { exec } : {}) });
  async function execute(command, options = {}) {
    if (typeof command !== "string" || !Object.hasOwn(COMMANDS, command))
      throw new TypeError(`Unsupported ipconfig command: ${String(command)}`);
    const { args, execution } = commandOptions(options, command);
    return run(args, execution);
  }
  async function getRawOutput(options = {}) {
    const { args, execution } = queryOptions(options);
    return run(args, { ...execution, rawResult: options.rawResult ?? false });
  }
  async function getConfig(options = {}) {
    validateOptions(options, CONFIG_OPTIONS);
    const { format = "json", ...query } = options;
    if (!["json", "xml", "yaml", "csv", "ndjson"].includes(format))
      throw new TypeError(
        "format must be one of: json, xml, yaml, csv, ndjson",
      );
    const { args, execution } = queryOptions(query);
    const output = await run(args, execution);
    const config = parseIpconfig(output);
    config.hostname ??= systemHostname();
    return formatConfig(config, format);
  }
  async function getAdapters(options) {
    validateOptions(options, QUERY_OPTIONS);
    return (await getConfig(options)).adapters;
  }
  async function getAdapter(nameOrIndex, options) {
    if (!(typeof nameOrIndex === "string" || Number.isInteger(nameOrIndex)))
      throw new TypeError(
        "adapter selector must be a name or zero-based integer index",
      );
    const adapters = await getAdapters(options);
    const found =
      typeof nameOrIndex === "number"
        ? adapters[nameOrIndex]
        : adapters.find(
            ({ name }) =>
              name.toLocaleLowerCase() ===
              nameOrIndex.trim().toLocaleLowerCase(),
          );
    if (!found)
      throw new IpconfigError(`Network adapter not found: ${nameOrIndex}`, {
        code: "ENOADAPTER",
      });
    return found;
  }
  async function addresses(family) {
    return (await getAdapters({ all: true })).flatMap(
      (adapter) => adapter[family],
    );
  }
  async function release(options = {}) {
    validateOptions(
      options,
      new Set([...EXECUTION_OPTIONS, "adapter", "ipv6"]),
    );
    if (options.ipv6 !== undefined && typeof options.ipv6 !== "boolean")
      throw new TypeError("ipv6 must be a boolean");
    const { ipv6 = false, ...rest } = options;
    return execute(ipv6 ? "release6" : "release", rest);
  }
  async function renew(options = {}) {
    validateOptions(
      options,
      new Set([...EXECUTION_OPTIONS, "adapter", "ipv6"]),
    );
    if (options.ipv6 !== undefined && typeof options.ipv6 !== "boolean")
      throw new TypeError("ipv6 must be a boolean");
    const { ipv6 = false, ...rest } = options;
    return execute(ipv6 ? "renew6" : "renew", rest);
  }
  return {
    execute,
    getRawOutput,
    getConfig,
    getAdapters,
    getAdapter,
    getIPv4: async () => addresses("ipv4"),
    getIPv6: async () => addresses("ipv6"),
    getDefaultGateway: async () =>
      flatten(await getAdapters({ all: true }), "defaultGateways"),
    getDnsServers: async () =>
      flatten(await getAdapters({ all: true }), "dnsServers"),
    getMacAddresses: async () =>
      (await getAdapters({ all: true })).flatMap(({ name, macAddress }) =>
        macAddress ? [{ adapter: name, address: macAddress }] : [],
      ),
    getHostname: async () => systemHostname(),
    flushDns: (options = {}) => execute("flushdns", options),
    displayDns: (options = {}) => execute("displaydns", options),
    registerDns: (options = {}) => execute("registerdns", options),
    release,
    renew,
    showClassId: (options = {}) => execute("showclassid", options),
    setClassId: (options = {}) => execute("setclassid", options),
    showClassId6: (options = {}) => execute("showclassid6", options),
    setClassId6: (options = {}) => execute("setclassid6", options),
    getDnsCache: (options = {}) => execute("displaydns", options),
  };
}

export const ipconfig = createIpconfig();
export { parseIpconfig, IpconfigError, createRunner };
export default ipconfig;
