declare namespace nodeIpconfig {
  interface QueryOptions {
    all?: boolean;
    timeout?: number;
    signal?: AbortSignal;
    encoding?: BufferEncoding;
    rawResult?: boolean;
  }
  type ConfigFormat = "json" | "xml" | "yaml" | "csv" | "ndjson";
  interface ConfigOptions extends QueryOptions {
    format?: ConfigFormat;
  }
  interface ExecutionOptions {
    timeout?: number;
    signal?: AbortSignal;
    encoding?: BufferEncoding;
    rawResult?: boolean;
  }
  interface Adapter {
    name: string;
    type: string;
    addresses: Array<{
      address: string;
      family: 4 | 6;
      scope?: string;
      prefixLength?: number;
    }>;
    ipv4: string[];
    ipv6: string[];
    dnsServers: string[];
    defaultGateways: string[];
    [field: string]: unknown;
  }
  interface Config {
    hostname?: string;
    adapters: Adapter[];
  }
  interface Result {
    stdout: string;
    stderr: string;
    exitCode: number;
  }
  interface Api {
    execute(
      command: string,
      options?: ExecutionOptions & { adapter?: string; classId?: string },
    ): Promise<string | Result>;
    getRawOutput(options?: QueryOptions): Promise<string | Result>;
    getConfig<F extends ConfigFormat = "json">(
      options?: ConfigOptions & { format?: F },
    ): Promise<F extends "json" ? Config : string>;
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
    flushDns(options?: ExecutionOptions): Promise<string | Result>;
    displayDns(options?: ExecutionOptions): Promise<string | Result>;
    getDnsCache(options?: ExecutionOptions): Promise<string | Result>;
    registerDns(options?: ExecutionOptions): Promise<string | Result>;
    release(
      options?: ExecutionOptions & { adapter?: string; ipv6?: boolean },
    ): Promise<string | Result>;
    renew(
      options?: ExecutionOptions & { adapter?: string; ipv6?: boolean },
    ): Promise<string | Result>;
    showClassId(
      options: ExecutionOptions & { adapter: string },
    ): Promise<string | Result>;
    setClassId(
      options: ExecutionOptions & { adapter: string; classId?: string },
    ): Promise<string | Result>;
    showClassId6(
      options: ExecutionOptions & { adapter: string },
    ): Promise<string | Result>;
    setClassId6(
      options: ExecutionOptions & { adapter: string; classId?: string },
    ): Promise<string | Result>;
  }
  interface Module extends Api {
    parseIpconfig(output: string): Promise<Config>;
    createIpconfig(options?: { platform?: string; exec?: Function }): Api;
  }
}
declare const api: nodeIpconfig.Module;
export = api;
