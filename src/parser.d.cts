declare const parser: {
  parseIpconfig(
    output: string,
  ): Promise<{ hostname?: string; adapters: unknown[] }>;
};
export = parser;
