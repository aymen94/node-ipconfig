const LABELS = [
  ['hostname', /^(?:host name|hostname|computer name|hostname del equipo|nombre de host)$/i],
  ['description', /^(?:description|beschreibung|descripción)$/i],
  ['macAddress', /^(?:physical address|physikalische adresse|dirección física|mac address)$/i],
  ['dhcpEnabled', /^(?:dhcp enabled|dhcp aktiviert|dhcp habilitado)$/i],
  ['autoconfigurationEnabled', /^(?:autoconfiguration enabled|autokonfiguration aktiviert)$/i],
  ['ipv4Address', /^(?:ipv4 address|ip address|ipv4-adresse|ip-adresse|dirección ipv4)(?: \((?:preferred|bevorzugt)\))?$/i],
  ['ipv6Address', /^(?:ipv6 address|ipv6-adresse|dirección ipv6)(?: \((?:preferred|bevorzugt)\))?$/i],
  ['subnetMask', /^(?:subnet mask|subnetzmaske|máscara de subred)$/i],
  ['defaultGateway', /^(?:default gateway|standardgateway|puerta de enlace predeterminada)$/i],
  ['dnsServers', /^(?:dns servers?|dns-server|servidores dns)$/i],
  ['connectionSpecificDnsSuffix', /^(?:connection-specific dns suffix|verbindungsspezifisches dns-suffix|sufijo dns específico para la conexión)$/i],
  ['linkLocalIpv6Address', /^(?:link-local ipv6 address|verbindungslokale ipv6-adresse|dirección ipv6 de vínculo local)$/i],
  ['leaseObtained', /^(?:lease obtained|lease erhalten|concesión obtenida)$/i],
  ['leaseExpires', /^(?:lease expires|lease läuft ab|la concesión expira)$/i],
  ['dhcpServer', /^(?:dhcp server|dhcp-server|servidor dhcp)$/i],
  ['winsServers', /^(?:wins servers?|wins-server)$/i],
  ['mediaState', /^(?:media state|medienstatus|estado de los medios)$/i],
  ['netbiosOverTcpip', /^(?:netbios over tcpip|netbios über tcpip aktiviert)$/i],
  ['ipv4PrefixLength', /^(?:ipv4 prefix length|ipv4-präfixlänge)$/i]
];

const LIST_FIELDS = new Set(["dnsServers", "defaultGateway", "winsServers"]);
const EMPTY_VALUES =
  /^(?:n\/a|not applicable|none|keine|nicht zutreffend|ninguno|no disponible)$/i;
const ADDRESS =
  /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$|^[0-9a-f]*:[0-9a-f:.%]+(?:\/\d{1,3})?$/i;

function tidy(value) {
  return value
    .trim()
    .replace(/^\.+$/, "")
    .replace(/\s*\((?:preferred|bevorzugt|preferido)\)$/i, "")
    .trim();
}
function bool(value) {
  if (/^(?:yes|true|ja|sí|si|enabled|aktiviert)$/i.test(value)) return true;
  if (/^(?:no|false|nein|disabled|deaktiviert)$/i.test(value)) return false;
  return value;
}
function fieldLabel(line) {
  return line.match(/^\s*(.+?)\s*:\s*(.*)$/);
}
function normalizeLabel(value) {
  return value
    .trim()
    .replace(/\s*\.\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function makeAdapter(type, name) {
  return {
    name: name.trim().replace(/^\*+\s*/, ""),
    type: type.trim(),
    addresses: [],
    ipv4: [],
    ipv6: [],
    dnsServers: [],
    defaultGateways: [],
  };
}
function addAddress(adapter, value, family, scope) {
  const address = value.replace(/\/\d+$/, "");
  const item = { address, family, ...(scope ? { scope } : {}) };
  adapter.addresses.push(item);
  (family === 4 ? adapter.ipv4 : adapter.ipv6).push(address);
  adapter[family === 4 ? "ipv4Address" : "ipv6Address"] = address;
  const prefix = value.match(/\/(\d+)$/)?.[1];
  if (prefix !== undefined) item.prefixLength = Number(prefix);
}

/** Parse localized ipconfig text into normalized adapter objects. */
export function parseIpconfig(output) {
  if (typeof output !== "string")
    throw new TypeError("ipconfig output must be a string");
  const adapters = [];
  let hostname;
  let adapter;
  let currentList;
  for (const rawLine of output.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      currentList = undefined;
      continue;
    }
    const header =
      line.match(/^(.+?)\s+adapter\s+(.+):$/i) ??
      line.match(/^(.+?)-Adapter\s+(.+):$/i) ??
      line.match(/^(.+?) adaptador\s+(.+):$/i) ??
      line.match(/^(.+?)-Adapter\s+(.+):$/i);
    if (header) {
      adapter = makeAdapter(header[1], header[2]);
      adapters.push(adapter);
      currentList = undefined;
      continue;
    }
    if (
      /(?:pseudo-interface|loopback interface)/i.test(line) &&
      line.endsWith(":")
    ) {
      adapter = makeAdapter("Loopback", line.slice(0, -1));
      adapters.push(adapter);
      currentList = undefined;
      continue;
    }
    const field = fieldLabel(rawLine);
    if (!adapter) {
      if (field) {
        const label = normalizeLabel(field[1]);
        const found = LABELS.find(
          ([key, regex]) => key === "hostname" && regex.test(label),
        );
        if (found && field[2].trim()) hostname = tidy(field[2]);
      }
      continue;
    }
    const valueLine = line.match(ADDRESS);
    if (currentList && valueLine) {
      const target =
        currentList === "defaultGateway"
          ? adapter.defaultGateways
          : adapter[currentList];
      target.push(tidy(valueLine[0]));
      continue;
    }
    if (!field) continue;
    const label = normalizeLabel(field[1]);
    const value = tidy(field[2]);
    const match = LABELS.find(([, regex]) => regex.test(label));
    if (!match) {
      if (label && value)
        ((adapter.fields ??= {}), (adapter.fields[label] = value));
      currentList = undefined;
      continue;
    }
    const key = match[0];
    if (key === "hostname") {
      if (value) hostname = value;
      continue;
    }
    if (LIST_FIELDS.has(key)) {
      currentList = key;
      const target =
        key === "defaultGateway"
          ? adapter.defaultGateways
          : key === "winsServers"
            ? (adapter.winsServers ??= [])
            : adapter.dnsServers;
      if (value && value !== "::" && !EMPTY_VALUES.test(value))
        target.push(value);
      continue;
    }
    currentList = undefined;
    if (!value || EMPTY_VALUES.test(value)) continue;
    if (key === "ipv4Address") addAddress(adapter, value, 4);
    else if (key === "ipv6Address") addAddress(adapter, value, 6);
    else if (key === "linkLocalIpv6Address") {
      adapter.linkLocalIpv6Address = value;
      addAddress(adapter, value, 6, "link-local");
    } else if (key === "dhcpEnabled" || key === "autoconfigurationEnabled")
      adapter[key] = bool(value);
    else if (key === "ipv4PrefixLength") {
      adapter.ipv4PrefixLength = Number(value);
    } else adapter[key] = value;
  }
  for (const item of adapters) {
    if (item.subnetMask && item.ipv4PrefixLength === undefined)
      item.ipv4PrefixLength = maskPrefix(item.subnetMask);
    if (item.connectionSpecificDnsSuffix === undefined)
      item.connectionSpecificDnsSuffix = null;
  }
  return { ...(hostname ? { hostname } : {}), adapters };
}

function maskPrefix(mask) {
  const octets = mask.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255))
    return undefined;
  const bits = octets.map((part) => part.toString(2).padStart(8, "0")).join("");
  if (!/^1*0*$/.test(bits)) return undefined;
  return bits.indexOf("0") < 0 ? 32 : bits.indexOf("0");
}
