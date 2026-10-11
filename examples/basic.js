import ipconfig from "node-ipconfig";

const { adapters } = await ipconfig.getConfig({ all: true });
for (const adapter of adapters) {
  console.log(
    `${adapter.name}: ${adapter.addresses.map(({ address }) => address).join(", ") || "no address"}`,
  );
}
