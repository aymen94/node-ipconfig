export type AddressFamily = 4 | 6;
export interface IpAddress {
  address: string;
  family: AddressFamily;
  scope?: "link-local";
  prefixLength?: number;
}
export interface Adapter {
  name: string;
  type: string;
  description?: string;
  macAddress?: string;
  addresses: IpAddress[];
  ipv4: string[];
  ipv6: string[];
  ipv4Address?: string;
  ipv6Address?: string;
  linkLocalIpv6Address?: string;
  subnetMask?: string;
  ipv4PrefixLength?: number;
  defaultGateways: string[];
  dnsServers: string[];
  dhcpEnabled?: boolean | string;
  autoconfigurationEnabled?: boolean | string;
  dhcpServer?: string;
  leaseObtained?: string;
  leaseExpires?: string;
  connectionSpecificDnsSuffix: string | null;
  mediaState?: string;
  fields?: Record<string, string>;
  [field: string]: unknown;
}
export interface Config {
  hostname?: string;
  adapters: Adapter[];
}
export type ConfigFormat = "json" | "xml" | "yaml" | "csv" | "ndjson";
export type FormattedConfig<F extends ConfigFormat> = F extends "json"
  ? Config
  : string;
export interface ExecutionOptions {
  timeout?: number;
  signal?: AbortSignal;
  encoding?: BufferEncoding;
  rawResult?: boolean;
}
export interface QueryOptions extends ExecutionOptions {
  all?: boolean;
}
export interface ConfigOptions extends QueryOptions {
  format?: ConfigFormat;
}
export interface CommandOptions extends ExecutionOptions {
  adapter?: string;
  classId?: string;
}
export type IpconfigCommand =
  | "config"
  | "all"
  | "release"
  | "release6"
  | "renew"
  | "renew6"
  | "flushdns"
  | "displaydns"
  | "registerdns"
  | "showclassid"
  | "setclassid"
  | "showclassid6"
  | "setclassid6";
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
export class IpconfigError extends Error {
  code: string;
  command?: string[];
  stdout: string;
  stderr: string;
  exitCode?: number;
}
export function parseIpconfig(output: string): Config;
export function createIpconfig(options?: {
  platform?: NodeJS.Platform | string;
  exec?: Function;
}): IpconfigApi;
export interface IpconfigApi {
  execute(
    command: IpconfigCommand,
    options?: CommandOptions,
  ): Promise<string | ExecutionResult>;
  getRawOutput(options?: QueryOptions): Promise<string | ExecutionResult>;
  getConfig<F extends ConfigFormat = "json">(
    options?: ConfigOptions & { format?: F },
  ): Promise<FormattedConfig<F>>;
  getAdapters(options?: QueryOptions): Promise<Adapter[]>;
  getAdapter(
    nameOrIndex: string | number,
    options?: QueryOptions,
  ): Promise<Adapter>;
  getIPv4(): Promise<string[]>;
  getIPv6(): Promise<string[]>;
  getDefaultGateway(): Promise<Array<{ adapter: string; address: string }>>;
  getDnsServers(): Promise<Array<{ adapter: string; address: string }>>;
  getMacAddresses(): Promise<Array<{ adapter: string; address: string }>>;
  getHostname(): Promise<string>;
  flushDns(options?: ExecutionOptions): Promise<string | ExecutionResult>;
  displayDns(options?: ExecutionOptions): Promise<string | ExecutionResult>;
  getDnsCache(options?: ExecutionOptions): Promise<string | ExecutionResult>;
  registerDns(options?: ExecutionOptions): Promise<string | ExecutionResult>;
  release(
    options?: ExecutionOptions & { adapter?: string; ipv6?: boolean },
  ): Promise<string | ExecutionResult>;
  renew(
    options?: ExecutionOptions & { adapter?: string; ipv6?: boolean },
  ): Promise<string | ExecutionResult>;
  showClassId(
    options: ExecutionOptions & { adapter: string },
  ): Promise<string | ExecutionResult>;
  setClassId(
    options: ExecutionOptions & { adapter: string; classId?: string },
  ): Promise<string | ExecutionResult>;
  showClassId6(
    options: ExecutionOptions & { adapter: string },
  ): Promise<string | ExecutionResult>;
  setClassId6(
    options: ExecutionOptions & { adapter: string; classId?: string },
  ): Promise<string | ExecutionResult>;
}
export const ipconfig: IpconfigApi;
export default ipconfig;
