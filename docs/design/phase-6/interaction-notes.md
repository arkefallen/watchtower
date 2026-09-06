# Phase 6 Interaction Notes & Evidentiary Contracts

## 1. Token Lookup & Latency SLA (< 3s Local Read)
- **Local DB Exclusivity:** Pasting a token address loads all holders, netflow history, red flags, and cluster co-presence warnings exclusively from indexed PostgreSQL tables (`Token`, `Position`, `Wallet`, `MovementEvent`, `Cluster`, `Transaction`).
- **Zero Blocking External Calls:** No Etherscan, DexScreener, or RPC network calls occur during the page query.
- **Refresh Enqueueing:** Pressing "Refresh Metadata" submits an async BullMQ job (`token.refresh`) and provides visual status (`Pending`, `Active`, `Done`) without halting navigation.
- **Unknown Token Handling:** If a token address is not in the local database, the panel displays a clean, non-crashing empty state: "Token not yet observed in local transaction history. Enqueue background discovery or paste a tracked asset."

## 2. Red-Flag Heuristics & Forensic Transparency
- **Paid-Promoter Check:** Evaluates transactions on the token where `from` equals `Token.deployerAddress` (case-insensitive) and `to` is in the tracked watchlist.
  - When triggered, displays:
    - Target wallet address / ENS
    - Direct transaction hash with explorer link
    - Amount received and timestamp
  - If multiple tracked wallets received tokens from the deployer, each wallet is individually listed.
- **Top-10 Supply Concentration:**
  - Obtained from explorer data (`getTokenHolderSummary`).
  - When available: displays numeric percentage (e.g. `42.8%`).
  - When unavailable from the explorer: explicitly renders `UNAVAILABLE` badge. Never defaults to `0%` or misleading estimates.
- **Token Age:** Computed dynamically from `deployedAt` relative to UTC now (e.g. `184d ago`, `< 24h ago`). If `deployedAt` is null, displays `UNKNOWN`.
- **Cluster Presence Warnings:**
  - Identifies if multiple wallets belonging to the same `Cluster` hold active positions in the token.
  - Warns the operator of potential coordinated insider accumulation or distribution.

## 3. Auto-Grade Evidentiary Contract
- **Calculation Rules:**
  - `winRate`: closed positions with `realizedUsd > 0` ÷ total closed positions (`isOpen === false`).
  - `realizedPnlUsd`: exact sum of `realizedUsd` across closed positions only. Open positions are strictly excluded.
  - `entryTimingRatio`: average `entryMarketCap` across positions ÷ peak market cap across positions, yielding a value in `(0, 1]`.
- **Low-Sample Safeguard:**
  - If a wallet has fewer than 3 closed positions (`sampleSize < 3`), the grade is explicitly reported as `UNAVAILABLE` with reason `INSUFFICIENT_SAMPLE`. No speculative or misleading score is shown.
- **Grade Label Sync:**
  - Reflected label matches `formatWalletLabel({ edge, style, size })` (FR-1.6), e.g. `SMART-RIDER [W]`.

## 4. Manual Token History Pruning (NFR-5, P6-T04)
- **Safety Gate:** Deletion is permanently irreversible.
- **Modal Confirmation:** The user must explicitly type the string `"PRUNE"` into a verification input before the deletion action is unlocked.
- **Exact Audit Reporting:** The response reports exact deleted counts per affected table:
  - `transactions`
  - `movements`
  - `snapshots`
  - `positions`
  - `flows`
- **Isolation:** Deletion is strictly filtered by `tokenAddress` and `chain`. Other tokens' data remain 100% untouched.
- **No Automatic Scheduling:** In accordance with NFR-5 and §0 D-10, no cron or background worker is permitted to auto-delete records.

## 5. Backup Reminder (NFR-6)
- **Staleness Threshold:** 7 days.
- **Trigger Conditions:**
  - Visible if no backup exists in `./backups/`.
  - Visible if the newest backup is > 7 days old.
  - Hidden / healthy if newest backup is ≤ 7 days old.
- **Non-blocking:** Displays as an ambient operations banner that never impedes navigation or data viewing.
