# ADR 0001: Robinhood Chain read provider

Status: Accepted for Phase 0 implementation
Date: 2026-09-05

## Decision

Use Alchemy read-only JSON-RPC and Data/Transfers API plus Blockscout PRO's
read-only internal-transaction endpoint for Robinhood Chain (`4663`). The
public `ChainAdapter` is the only boundary exposed to application services;
provider response shapes remain under `src/lib/robinhood/`. Both API keys are
optional at boot, and Robinhood is `ProviderNotConfigured` until configured.
Watchtower never signs, broadcasts, or stores private keys.

Alchemy's official Robinhood RPC endpoint is
`https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`. It supplies native
RPC, external transfers, ERC-20 transfers, and token metadata. Blockscout PRO
supplies internal transactions with cursor pagination at
`/4663/api/v2/addresses/{address}/internal-transactions`.

## Coverage and degradation

Provider records are normalized to native, internal, and ERC-20 records with
UTC timestamps, lowercase addresses, and stable trace IDs. Missing gas receipt
fields, deploy metadata, holder summaries, and historical block-by-time lookup
remain explicit unavailable values. Missing market pairs remain `UNKNOWN`,
never zero.

## Limits and budget gate

The live probe verified a 50-record first page from Blockscout and a cursor for
subsequent pages. Blockscout publishes 5 requests/second and 100,000 credits
per day for its free PRO plan. The conservative scheduler budget is 75,000
credits/day, reserving 25% for interactive work. The documented 100-wallet
tiered cadence is approximately 17,500 provider calls/day including
bulk-intake headroom; runtime credit accounting must stop at the 75,000 budget
and must not silently assume one call equals one credit.

Expected minimum calls per wallet sync are two Alchemy Transfers queries
(external and ERC-20), one or more Blockscout internal pages, and one latest
block check. Balance and token metadata are interactive/on-demand.

## Live proof record (2026-09-05)

Using the approved local keys and the supplied USDG contract address, Alchemy
returned HTTP 200 for `eth_chainId`, `eth_blockNumber`, `eth_getBalance`,
`eth_getBlockByNumber`, `alchemy_getTokenMetadata`, external Transfers, and
ERC-20 Transfers. The sample returned zero external and one ERC-20 record.

Alchemy internal Transfers, `trace_replayBlockTransactions`, and free-tier
`debug_traceBlockByNumber` were unavailable on Robinhood. Blockscout's PRO
internal endpoint returned HTTP 200 with 50 records on the first page. The
combined strategy covers normal, internal, and ERC-20 history for P0-T18.

## Verification

Run `corepack pnpm tsx scripts/probe-robinhood-provider.ts` for the offline
configuration check. Run it with `--live --address 0x...` only when the local
read-only keys are configured. The script never prints either key.

References: [Robinhood Chain connection guide](https://docs.robinhood.com/chain/connecting/),
[Alchemy Robinhood API overview](https://www.alchemy.com/docs/robinhood-chain/robinhood-chain-api-overview),
[Alchemy Transfers API](https://www.alchemy.com/docs/reference/transfers-api-quickstart),
[Blockscout requests and limits](https://docs.blockscout.com/devs/apis/requests-and-limits),
[Blockscout internal transactions API](https://docs.blockscout.com/api-reference/get-address-internal-transactions).
