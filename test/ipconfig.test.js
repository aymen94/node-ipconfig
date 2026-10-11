import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseIpconfig } from "../src/parser.js";
import { createRunner, IpconfigError } from "../src/command.js";
import { createIpconfig } from "../src/index.js";
import { createRequire } from "node:module";

const fixture = (name) =>
  readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("parses adapter fields, address families, multiline DNS and gateways", async () => {
  const config = parseIpconfig(await fixture("all.txt"));
  assert.equal(config.adapters.length, 3);
  const ethernet = config.adapters[0];
  assert.equal(ethernet.macAddress, "AA-BB-CC-DD-EE-FF");
  assert.equal(ethernet.dhcpEnabled, true);
  assert.deepEqual(
    ethernet.addresses.map(({ family }) => family),
    [6, 6, 4],
  );
  assert.deepEqual(ethernet.dnsServers, ["192.168.1.1", "2001:db8::53"]);
  assert.deepEqual(ethernet.defaultGateways, ["192.168.1.1", "fe80::1%12"]);
  assert.equal(config.adapters[2].mediaState, "Media disconnected");
  assert.deepEqual(config.adapters[2].addresses, []);
});

test("parses localized German labels", async () => {
  const adapter = parseIpconfig(await fixture("german.txt")).adapters[0];
  assert.equal(adapter.dhcpEnabled, true);
  assert.equal(adapter.macAddress, "AA-BB-CC-DD-EE-FF");
  assert.equal(adapter.subnetMask, "255.255.255.0");
  assert.equal(adapter.defaultGateways[0], "192.168.0.1");
});

test("empty and malformed output are safe", () => {
  assert.deepEqual(parseIpconfig(""), { adapters: [] });
  assert.deepEqual(parseIpconfig("Windows IP Configuration"), { adapters: [] });
  assert.throws(() => parseIpconfig(null), TypeError);
});

test("runner rejects unsupported platforms without invoking a process", async () => {
  const run = createRunner({
    platform: "linux",
    exec: () => assert.fail("must not execute"),
  });
  await assert.rejects(
    run(),
    (error) => error instanceof IpconfigError && error.code === "ENOTSUP",
  );
});

test("runner invokes executable with separate arguments and maps errors", async () => {
  const calls = [];
  const run = createRunner({
    platform: "win32",
    exec: (...args) => {
      calls.push(args);
      args.at(-1)(null, "ok", "");
    },
  });
  assert.equal(await run(["/all"]), "ok");
  assert.equal(calls[0][0], "ipconfig.exe");
  assert.deepEqual(calls[0][1], ["/all"]);
  const failed = createRunner({
    platform: "win32",
    exec: (...args) =>
      args.at(-1)(
        Object.assign(new Error("denied"), { code: "EACCES" }),
        "",
        "",
      ),
  });
  await assert.rejects(failed(), (error) => error.code === "EACCES");
});

test("API uses the runner, validates options, and runs side effects only explicitly", async () => {
  const calls = [];
  const api = createIpconfig({
    platform: "win32",
    exec: (file, args, options, callback) => {
      calls.push(args);
      callback(
        null,
        "Ethernet adapter Test:\n   IPv4 Address. . . . . . . . . . . : 127.0.0.1",
        "",
      );
    },
  });
  const config = await api.getConfig();
  assert.equal(config.adapters[0].addresses[0].address, "127.0.0.1");
  assert.deepEqual(calls, [[]]);
  await assert.rejects(api.getConfig({ command: "/release" }), TypeError);
  await api.flushDns();
  assert.deepEqual(calls[1], ["/flushdns"]);
});

test("parser supplies normalized schema, hostname, prefix, and unknown fields", async () => {
  const config = parseIpconfig(await fixture("all.txt"));
  assert.equal(config.hostname, "workstation");
  const ethernet = config.adapters[0];
  assert.deepEqual(ethernet.ipv4, ["192.168.1.20"]);
  assert.deepEqual(ethernet.ipv6, ["2001:db8::10", "fe80::abcd%12"]);
  assert.equal(ethernet.ipv4PrefixLength, 24);
  const unicode = parseIpconfig(await fixture("unicode.txt"));
  assert.match(unicode.adapters[0].description, /[^\x00-\x7f]/);
  assert.equal(
    unicode.adapters[0].fields["Vendor-specific unfamiliar label"],
    "retained value",
  );
  assert.deepEqual(unicode.adapters[1].ipv4, []);
  assert.equal(unicode.adapters[1].addresses[0].prefixLength, 64);
});

test("all public APIs use allowlisted arguments and normalized results", async () => {
  const output = await fixture("all.txt");
  const calls = [];
  const api = createIpconfig({
    platform: "win32",
    exec: (file, args, options, callback) => {
      calls.push([...args]);
      callback(
        null,
        args.length && !["/all"].includes(args[0]) ? "action complete" : output,
        "",
      );
    },
  });
  assert.equal(
    (await api.getRawOutput({ all: true })).includes("Ethernet adapter"),
    true,
  );
  assert.equal((await api.getConfig()).adapters.length, 3);
  assert.equal((await api.getAdapter("ethernet")).name, "Ethernet");
  assert.equal((await api.getAdapter(1)).name, "Wi-Fi");
  assert.deepEqual(await api.getIPv4(), ["192.168.1.20", "10.0.0.9"]);
  assert.deepEqual(await api.getIPv6(), ["2001:db8::10", "fe80::abcd%12"]);
  assert.deepEqual(await api.getDefaultGateway(), [
    { adapter: "Ethernet", address: "192.168.1.1" },
    { adapter: "Ethernet", address: "fe80::1%12" },
  ]);
  assert.deepEqual(await api.getDnsServers(), [
    { adapter: "Ethernet", address: "192.168.1.1" },
    { adapter: "Ethernet", address: "2001:db8::53" },
  ]);
  assert.deepEqual(await api.getMacAddresses(), [
    { adapter: "Ethernet", address: "AA-BB-CC-DD-EE-FF" },
    { adapter: "Wi-Fi", address: "11-22-33-44-55-66" },
    { adapter: "Bluetooth Network Connection", address: "00-00-00-00-00-00" },
  ]);
  assert.ok(await api.getHostname());
  await api.flushDns();
  await api.displayDns();
  await api.registerDns();
  await api.release({ adapter: "Wi-Fi" });
  await api.release({ ipv6: true });
  await api.renew({ adapter: "Ethernet", ipv6: true });
  await api.showClassId({ adapter: "Ethernet" });
  await api.setClassId({ adapter: "Ethernet", classId: "class 1" });
  await api.showClassId6({ adapter: "Wi-Fi" });
  await api.setClassId6({ adapter: "Wi-Fi" });
  assert.deepEqual(calls.slice(-10), [
    ["/flushdns"],
    ["/displaydns"],
    ["/registerdns"],
    ["/release", "Wi-Fi"],
    ["/release6"],
    ["/renew6", "Ethernet"],
    ["/showclassid", "Ethernet"],
    ["/setclassid", "Ethernet", "class 1"],
    ["/showclassid6", "Wi-Fi"],
    ["/setclassid6", "Wi-Fi"],
  ]);
  await assert.rejects(api.execute("release; malicious"), TypeError);
  await assert.rejects(
    api.execute("release", { adapter: "/release" }),
    TypeError,
  );
  await assert.rejects(api.execute("showclassid"), TypeError);
  await assert.rejects(api.flushDns({ adapter: "x" }), TypeError);
  await assert.rejects(
    api.getAdapter("missing"),
    (error) => error.code === "ENOADAPTER",
  );
  await assert.rejects(api.getConfig({ timeout: 0 }), TypeError);
});

test("getConfig defaults to structured JSON and serializes standard formats on request", async () => {
  const output = await fixture("all.txt");
  const api = createIpconfig({
    platform: "win32",
    exec: (file, args, options, callback) => callback(null, output, ""),
  });
  const config = await api.getConfig();
  assert.equal(typeof config, "object");
  assert.equal((await api.getConfig({ format: "json" })).adapters.length, 3);
  const xml = await api.getConfig({ format: "xml" });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<name>Ethernet<\/name>/);
  assert.match(await api.getConfig({ format: "yaml" }), /adapters:/);
  assert.match(
    await api.getConfig({ format: "csv" }),
    /^name,type,description/m,
  );
  assert.match(
    await api.getConfig({ format: "ndjson" }),
    /"adapter":\{"name":"Ethernet"/,
  );
  await assert.rejects(api.getConfig({ format: "html" }), TypeError);
  await assert.rejects(api.getAdapters({ format: "xml" }), TypeError);
});

test("execution returns diagnostics/results and handles timeout, abort, and unavailable executable", async () => {
  const resultApi = createIpconfig({
    platform: "win32",
    exec: (file, args, options, callback) => {
      callback(
        Object.assign(new Error("exit"), { code: 3 }),
        "",
        "native diagnostic",
      );
    },
  });
  const result = await resultApi.execute("config", { rawResult: true });
  assert.deepEqual(result, {
    stdout: "",
    stderr: "native diagnostic",
    exitCode: 3,
  });
  await assert.rejects(
    resultApi.execute("config"),
    (error) => error.code === 3 && error.stderr === "native diagnostic",
  );
  for (const code of ["ETIMEDOUT", "ENOENT", "ABORT_ERR"]) {
    const failing = createIpconfig({
      platform: "win32",
      exec: (file, args, options, callback) =>
        callback(Object.assign(new Error(code), { code }), "", ""),
    });
    await assert.rejects(
      failing.getRawOutput(),
      (error) => error.code === code,
    );
  }
  const controller = new AbortController();
  controller.abort();
  const abortApi = createIpconfig({
    platform: "win32",
    exec: (file, args, options, callback) => {
      const error = Object.assign(new Error("aborted"), {
        name: "AbortError",
        code: "ABORT_ERR",
      });
      callback(error, "", "");
    },
  });
  await assert.rejects(
    abortApi.getRawOutput({ signal: controller.signal }),
    (error) => error.code === "ABORT_ERR",
  );
});

test("CommonJS entry exposes promise-based public API", async () => {
  const require = createRequire(import.meta.url);
  const cjs = require("../src/index.cjs");
  assert.equal(typeof cjs.getIPv4, "function");
  assert.equal(typeof cjs.execute, "function");
  assert.ok(await cjs.getHostname());
});
