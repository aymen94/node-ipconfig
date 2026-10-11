const FORMATS = new Set(["json", "xml", "yaml", "csv", "ndjson"]);

function escapeXml(value) {
  return String(value).replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
}

function xmlNode(name, value) {
  if (Array.isArray(value))
    return `<${name}>${value.map((item) => xmlNode("item", item)).join("")}</${name}>`;
  if (value && typeof value === "object")
    return `<${name}>${Object.entries(value)
      .map(([key, item]) =>
        xmlNode(key.replace(/[^A-Za-z0-9_.-]/g, "_") || "field", item),
      )
      .join("")}</${name}>`;
  return `<${name}>${escapeXml(value ?? "")}</${name}>`;
}

function yamlScalar(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function yamlLines(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value))
    return value.length
      ? value.flatMap((item) => {
          if (item && typeof item === "object") {
            const lines = yamlLines(item, indent + 2);
            return [
              `${pad}- ${lines[0]?.trimStart() ?? "{}"}`,
              ...lines.slice(1),
            ];
          }
          return [`${pad}- ${yamlScalar(item)}`];
        })
      : [`${pad}[]`];
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length
      ? entries.flatMap(([key, item]) => {
          const safeKey = /^[A-Za-z_][\w.-]*$/.test(key)
            ? key
            : JSON.stringify(key);
          if (item && typeof item === "object")
            return [`${pad}${safeKey}:`, ...yamlLines(item, indent + 2)];
          return [`${pad}${safeKey}: ${yamlScalar(item)}`];
        })
      : [`${pad}{}`];
  }
  return [`${pad}${yamlScalar(value)}`];
}

function csvCell(value) {
  const text =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Format a parsed configuration as JSON data or a serialized JSON, XML, YAML, CSV, or NDJSON document. */
export function formatConfig(config, format = "json") {
  if (!FORMATS.has(format))
    throw new TypeError(
      `Unsupported format: ${format}. Choose json, xml, yaml, csv, or ndjson.`,
    );
  if (format === "json") return config;
  if (format === "xml")
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlNode("config", config)}`;
  if (format === "yaml") return `${yamlLines(config).join("\n")}\n`;
  if (format === "ndjson")
    return `${config.adapters.map((adapter) => JSON.stringify({ ...(config.hostname ? { hostname: config.hostname } : {}), adapter })).join("\n")}${config.adapters.length ? "\n" : ""}`;
  const columns = [
    "name",
    "type",
    "description",
    "macAddress",
    "ipv4",
    "ipv6",
    "subnetMask",
    "ipv4PrefixLength",
    "defaultGateways",
    "dnsServers",
    "dhcpEnabled",
    "autoconfigurationEnabled",
    "dhcpServer",
    "leaseObtained",
    "leaseExpires",
    "connectionSpecificDnsSuffix",
    "mediaState",
    "addresses",
    "fields",
  ];
  return (
    [
      columns.join(","),
      ...config.adapters.map((adapter) =>
        columns.map((key) => csvCell(adapter[key])).join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}

export const CONFIG_FORMATS = Object.freeze([...FORMATS]);
