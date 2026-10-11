# API guide

`node-ipconfig` wraps Windows `ipconfig.exe`. Its command methods return Promises and require Windows; `parseIpconfig()` and the format examples can be used on any supported Node.js platform. The package has no runtime dependencies.

## Install

```sh
npm install node-ipconfig
```

Requires Node.js 18 or newer.

## Get started

### ECMAScript modules

```js
import ipconfig from 'node-ipconfig';

const config = await ipconfig.getConfig({ all: true });
console.log(config.hostname);
for (const adapter of config.adapters) {
  console.log(adapter.name, adapter.ipv4, adapter.ipv6);
}
```

### CommonJS

```js
const ipconfig = require('node-ipconfig');

async function main() {
  const adapters = await ipconfig.getAdapters({ all: true });
  console.log(adapters);
}
main().catch(console.error);
```

## Configuration and formats

`getConfig(options?)` executes `ipconfig` and parses its output. Set `all: true` to execute `ipconfig /all`. By default it returns a JavaScript `Config` object (JSON-compatible data):

```js
const config = await ipconfig.getConfig();
const detailed = await ipconfig.getConfig({ all: true });
```

Set `format` to serialize the parsed configuration. JSON is the default and remains an object; the other formats return strings.

```js
const jsonData = await ipconfig.getConfig({ format: 'json' });
const xml = await ipconfig.getConfig({ all: true, format: 'xml' });
const yaml = await ipconfig.getConfig({ all: true, format: 'yaml' });
const csv = await ipconfig.getConfig({ all: true, format: 'csv' });
const ndjson = await ipconfig.getConfig({ all: true, format: 'ndjson' });
```

CSV has one row per adapter; nested values are JSON-encoded in cells. NDJSON has one adapter record per line. XML values are escaped. YAML is emitted as a YAML document. Supported format names are `json`, `xml`, `yaml`, `csv`, and `ndjson`; unsupported names throw `TypeError`.

`getRawOutput(options?)` returns the original decoded text. Set `rawResult: true` to receive `{ stdout, stderr, exitCode }` instead.

## Discovery methods

| Method | Result |
| --- | --- |
| `getConfig(options?)` | Parsed configuration, or serialized output when a non-JSON format is selected |
| `getAdapters(options?)` | Adapter array |
| `getAdapter(nameOrIndex, options?)` | One adapter by case-insensitive name or zero-based index |
| `getIPv4()` / `getIPv6()` | Flat arrays of IP address strings |
| `getDefaultGateway()` | `{ adapter, address }` records |
| `getDnsServers()` | `{ adapter, address }` records |
| `getMacAddresses()` | `{ adapter, address }` records |
| `getHostname()` | Host name from Node.js `os.hostname()` |
| `getRawOutput(options?)` | Native command output as text or execution result |
| `parseIpconfig(text)` | Synchronous parser for captured output; no command execution |

Detailed fields include adapter type and description, MAC address, IPv4 and IPv6 addresses, subnet mask and prefix length, gateways, DNS servers, DHCP and autoconfiguration state, DHCP server, lease timestamps, media state, and preserved unknown labeled fields. Parsing recognizes common English, German, and Spanish labels; it is best-effort across Windows versions and locales.

## Options

Configuration queries accept:

- `all`: boolean, defaults to `false`.
- `format`: `json`, `xml`, `yaml`, `csv`, or `ndjson`; only supported by `getConfig` and defaults to `json`.
- `timeout`: positive milliseconds, defaults to 15000.
- `signal`: `AbortSignal` to cancel execution.
- `encoding`: Node.js text encoding, defaults to `utf8`.
- `rawResult`: return `{ stdout, stderr, exitCode }` for raw command methods.

Unknown options and invalid values throw `TypeError`.

## Explicit commands

Operations that change network state are only executed when called explicitly. `execute(command, options?)` accepts the allowlisted names below; it never accepts arbitrary command text.

| Method | `execute` name / native switch | Notes |
| --- | --- | --- |
| `execute('config')` | `ipconfig` | Read current configuration |
| `execute('all')` | `/all` | Detailed configuration |
| `flushDns()` | `/flushdns` | Clears the DNS resolver cache |
| `displayDns()` / `getDnsCache()` | `/displaydns` | Displays cached DNS records |
| `registerDns()` | `/registerdns` | Initiates manual DNS registration |
| `release(options?)` | `/release` or `/release6` | Releases DHCP configuration; may interrupt connectivity |
| `renew(options?)` | `/renew` or `/renew6` | Renews DHCP configuration; may interrupt connectivity |
| `showClassId({ adapter })` | `/showclassid` | Displays a DHCP class ID |
| `setClassId({ adapter, classId? })` | `/setclassid` | Sets or clears a DHCP class ID |
| `showClassId6({ adapter })` | `/showclassid6` | IPv6 class ID operation |
| `setClassId6({ adapter, classId? })` | `/setclassid6` | Sets or clears an IPv6 class ID |

`release()` and `renew()` accept `{ adapter, ipv6 }`; set `ipv6: true` to choose the IPv6 command. `adapter` and `classId` values are passed as separate process arguments, not through a shell. Read-only discovery never runs a state-changing command.

Run release, renew, DNS registration, and class ID changes only when their effects are appropriate. DHCP release/renew can disrupt connectivity. Windows may require an appropriately authorized terminal for some operations.

## Errors and platform support

Command methods reject with `IpconfigError`. Its `code` identifies unsupported platforms (`ENOTSUP`), missing executables (`ENOENT`), permissions (`EACCES`), timeouts (`ETIMEDOUT`), cancellation (`ABORT_ERR`), or command failures. Available command, stdout, stderr, exit code, and cause are attached to the error. Unsupported option names, command names, or argument values throw `TypeError`.

## Testing with a custom runner

`createIpconfig()` makes the command runner injectable for tests:

```js
import { createIpconfig } from 'node-ipconfig';

const api = createIpconfig({
  platform: 'win32',
  exec(file, args, options, callback) {
    callback(null, 'Windows IP Configuration', '');
  }
});
const config = await api.getConfig();
```

The parser can also be tested directly with fixture text, without mocking or requiring Windows.
