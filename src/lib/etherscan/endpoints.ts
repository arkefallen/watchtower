/** Etherscan V2 endpoint names used by adapters and cache keys. */
export const ETHERSCAN_ENDPOINTS = {
  normalTransactions: "account.txlist",
  internalTransactions: "account.txlistinternal",
  tokenTransfers: "account.tokentx",
  tokenSupply: "stats.tokensupply",
  blockByTimestamp: "block.getblocknobytime",
  latestBlock: "proxy.eth_blockNumber",
} as const;

export type EtherscanEndpoint = (typeof ETHERSCAN_ENDPOINTS)[keyof typeof ETHERSCAN_ENDPOINTS];
