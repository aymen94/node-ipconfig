# node-ipconfig

Promise-based JavaScript access to Windows network configuration through the native `ipconfig.exe`. It has no runtime dependencies and never invokes a shell. Parsed configuration is returned as a JavaScript object by default (ready to use as JSON); you can also serialize it as JSON text, XML, YAML, CSV, or NDJSON.

## Requirements and compatibility

- Node.js 18 or newer.
- Command execution is supported on Windows only. The pure `parseIpconfig(text)` parser runs on Windows, macOS, and Linux.
- Both ESM and CommonJS package entry points are provided. Public command methods return Promises.

```sh
npm install node-ipconfig
```

The command wrapper requires Windows. The parser and output formatters can run on any supported Node.js platform.

## Quick start

### ESM

```js
import ipconfig from 'node-ipconfig';

const config = await ipconfig.getConfig({ all: true });
console.log(config.hostname);
for (const adapter of config.adapters) {
  console.log(adapter.name, adapter.ipv4, adapter.ipv6);
}
```

Select a serialized format when an integration needs a document rather than a JavaScript object:

```js
const xml = await ipconfig.getConfig({ all: true, format: 'xml' });
const yaml = await ipconfig.getConfig({ all: true, format: 'yaml' });
const csv = await ipconfig.getConfig({ all: true, format: 'csv' });
```

### CommonJS

```js
const ipconfig = require('node-ipconfig');

async function main() {
  const adapters = await ipconfig.getAdapters({ all: true });
  console.log(await ipconfig.getIPv4());
}
main().catch(console.error);
```

## API

Configuration methods accept `QueryOptions`: `all` (boolean, defaults to false), `timeout` (positive milliseconds, defaults to 15000), `signal` (`AbortSignal`), `encoding` (Node.js encoding name, defaults to UTF-8), and `rawResult` (boolean). `getConfig` additionally accepts `format`. Unknown keys and invalid values throw `TypeError`.

- `getConfig(options?)` runs `ipconfig` or `/all` and returns a `Config` object by default (`format: 'json'`). Supported formats are `json`, `xml`, `yaml`, `csv`, and `ndjson`. JSON returns the object; the other formats return a string. CSV has one row per adapter, with nested arrays and objects encoded as JSON cells. NDJSON emits one adapter record per line, including the hostname when available.
- `getRawOutput(options?)` returns stdout as a string. With `{ rawResult: true }`, it returns `{ stdout, stderr, exitCode }`.
- `getAdapters(options?)` returns `Adapter[]`.
- `getAdapter(nameOrIndex, options?)` returns one adapter; string matching is case-insensitive and the numeric index is zero-based. Missing adapters reject with `IpconfigError` code `ENOADAPTER`.
- `getIPv4()` / `getIPv6()` return flat arrays of address strings from detailed configuration.
- `getDefaultGateway()` / `getDnsServers()` return arrays of `{ adapter, address }` records.
- `getMacAddresses()` returns `{ adapter, address }` records for adapters with a physical address.
- `getHostname()` returns the host name reported by Node.js `os.hostname()`.
- `parseIpconfig(text)` synchronously parses captured text without running a process.
- `createIpconfig(options?)` creates an isolated API instance; its `platform` and `exec` options support testing with a mocked process runner.
- `execute(command, options?)` permits only the command names listed below. It returns stdout, or the execution result when `rawResult: true`.

### Output formats

```js
const config = await ipconfig.getConfig(); // Config object (default JSON data)
const jsonText = JSON.stringify(config, null, 2);
const xml = await ipconfig.getConfig({ format: 'xml' });
const yaml = await ipconfig.getConfig({ format: 'yaml' });
const csv = await ipconfig.getConfig({ format: 'csv' });
const lines = await ipconfig.getConfig({ format: 'ndjson' });
```

The formatter preserves the parsed configuration fields. XML values are escaped. YAML is emitted as a YAML document. CSV uses a header row and one row per adapter; complex values are JSON-encoded in their cells. NDJSON emits one JSON adapter record per line. The original native text is available separately through `getRawOutput()`.

### Data schema

`Config` is `{ hostname?: string, adapters: Adapter[] }`. Adapter fields include `name`, `type`, `addresses: IpAddress[]`, `ipv4: string[]`, `ipv6: string[]`, `dnsServers: string[]`, `defaultGateways: string[]`, and `connectionSpecificDnsSuffix` (string or `null`). When available, adapters also include `description`, `macAddress`, `subnetMask`, `ipv4PrefixLength`, `dhcpEnabled`, `autoconfigurationEnabled`, `dhcpServer`, `leaseObtained`, `leaseExpires`, and `mediaState`. Unknown labeled fields are preserved in `fields`. Older scalar fields such as `ipv4Address` and `ipv6Address` remain available for compatibility; when multiple addresses exist, those scalars contain the last parsed address. `IpAddress` contains `address`, `family` (4 or 6), and optional `scope` or `prefixLength`.

## Commands and side effects

`execute` accepts `config`, `all`, `release`, `release6`, `renew`, `renew6`, `flushdns`, `displaydns`, `registerdns`, `showclassid`, `setclassid`, `showclassid6`, or `setclassid6`. Command options are limited to `timeout`, `signal`, `encoding`, `rawResult`, plus `adapter` where needed and `classId` for `setclassid` variants. Adapter names and class IDs are passed as distinct process arguments and reject control characters and slash-prefixed option injection.

Convenience methods include `flushDns(options?)`, `displayDns(options?)`, `registerDns(options?)`, `release(options?)`, and `renew(options?)`. `release` and `renew` accept optional `{ adapter, ipv6 }`; IPv6 selects `/release6` or `/renew6`. `showClassId({ adapter })`, `setClassId({ adapter, classId? })`, and their `...6` counterparts wrap class ID operations.

Configuration reads, `/displaydns`, and `/showclassid` are read-only. `/flushdns` clears the DNS resolver cache. `/registerdns`, DHCP release/renew, and class ID setting can change network state. Those commands are only run when the corresponding method or `execute` call is explicitly invoked; discovery never runs them. DHCP operations can briefly interrupt connectivity. Windows permissions may vary; run an appropriately authorized terminal when Windows denies an operation.

| JavaScript method | Native command | Effect |
| --- | --- | --- |
| `getConfig()` / `getRawOutput()` | `ipconfig` | Read current configuration |
| `{ all: true }` | `ipconfig /all` | Read detailed adapter configuration |
| `flushDns()` | `ipconfig /flushdns` | Clear DNS resolver cache |
| `displayDns()` / `getDnsCache()` | `ipconfig /displaydns` | Read cached DNS records |
| `registerDns()` | `ipconfig /registerdns` | Refresh DHCP leases and register DNS names |
| `release({ adapter?, ipv6? })` | `/release` or `/release6` | Release DHCP configuration; may interrupt connectivity |
| `renew({ adapter?, ipv6? })` | `/renew` or `/renew6` | Renew DHCP configuration; may interrupt connectivity |
| `showClassId({ adapter })` / `showClassId6(...)` | `/showclassid` or `/showclassid6` | Read DHCP class ID |
| `setClassId({ adapter, classId? })` / `setClassId6(...)` | `/setclassid` or `/setclassid6` | Change DHCP class ID |

You may also call `execute` with an allowlisted command name (`config`, `all`, `release`, `release6`, `renew`, `renew6`, `flushdns`, `displaydns`, `registerdns`, `showclassid`, `setclassid`, `showclassid6`, `setclassid6`). Commands that change system state are never run during discovery.

## Raw output, encoding, and localization

`getRawOutput()` preserves the decoded command text, while `rawResult: true` also returns stderr and exit code. The default decoder is UTF-8; set `encoding` to a Node-supported encoding when the machine's OEM code page requires it. This avoids extra code-page dependencies, but callers must know the output encoding for their system. The parser recognizes common English, German, and Spanish labels, common adapter header forms, and preserves unknown labeled values. Windows localization and version changes mean parsing is best effort; use raw output when exact text matters.

## Errors and security

Unsupported operating systems reject with `IpconfigError` code `ENOTSUP`. Process startup, permission, timeout, cancellation, and command errors reject with `IpconfigError`, including available command, stdout, stderr, exit code, and cause details. A command can emit useful output alongside a non-zero exit status; that text is returned, and `{ rawResult: true }` exposes the exit code. No API accepts arbitrary command strings or starts a shell. All executable arguments come from a fixed allowlist and validated values.

## Examples

Runnable ESM example: [`examples/basic.js`](examples/basic.js).

For full API details, configuration fields, output format behavior, command effects, options, and errors, see the [API guide](docs/API.md).

```js
const gateways = await ipconfig.getDefaultGateway();
const dns = await ipconfig.getDnsServers();
const wifi = await ipconfig.getAdapter('Wi-Fi');
const raw = await ipconfig.getRawOutput({ all: true });

// Explicit operations: these can change machine state.
await ipconfig.flushDns();
await ipconfig.renew({ adapter: wifi.name });
```

## Development

`npm test` runs the platform-independent mocked suite. `npm run lint` performs JavaScript syntax checks, and `npm run typecheck` checks the published declarations with TypeScript. CI runs the suite on Windows, Linux, and macOS for supported Node.js releases.

MIT licensed; see [LICENSE](LICENSE).
