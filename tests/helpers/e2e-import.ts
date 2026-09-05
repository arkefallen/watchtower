export const PHASE1_WALLETS = [
  { address: "0x1000000000000000000000000000000000000001", chain: "bsc", label: "CEX Funded Target" },
  { address: "0x1000000000000000000000000000000000000002", chain: "base", label: "Cluster Member A" },
  { address: "0x1000000000000000000000000000000000000003", chain: "base", label: "Cluster Member B" },
  { address: "0x1000000000000000000000000000000000000004", chain: "base", label: "Cluster Member C" },
  { address: "0x1000000000000000000000000000000000000005", chain: "base", label: "Internal Trace Target" },
  { address: "0x1000000000000000000000000000000000000006", chain: "base", label: "Depth Limited Target" },
  { address: "0x1000000000000000000000000000000000000007", chain: "base", label: "Parking Target" },
  { address: "0x1000000000000000000000000000000000000008", chain: "base", label: "Outflow Target" },
  { address: "0x1000000000000000000000000000000000000009", chain: "base", label: "Active Target 1" },
  { address: "0x1000000000000000000000000000000000000010", chain: "base", label: "Active Target 2" },
] as const;

export function buildPhase1Csv(): string {
  return PHASE1_WALLETS.map((w) => `${w.address},${w.chain},${w.label}`).join("\n");
}
