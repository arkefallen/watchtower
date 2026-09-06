# P6-D01 Screen Map & Component Hierarchy

## Routes & Screens

### 1. `/tokens` and `/tokens/[chain]/[address]` — Token Intelligence Console
- **Purpose:** Primary token lookup panel (FR-7.1, FR-7.2) for pasting any token address and chain to display tracked-wallet holders, netflow history, cluster presence warnings, red-flag heuristics, and tracked supply concentration.
- **Chrome:** Standard 240px Navigation Sidebar (`/tokens` highlighted), Top Status Bar with chain picker (`Base`, `BSC`, `Robinhood`), Token address search bar, and Non-blocking metadata refresh button.
- **Component Breakdown:**
  1. `TokenLookupForm`:
     - Chain selector dropdown
     - Address input field with fast validation
     - Direct jump to `/tokens/[chain]/[address]`
  2. `TokenHeader`:
     - Token symbol, token name, formatted address chip with click-to-copy
     - Deployed age (days ago derived from `deployedAt` or `UNKNOWN`)
     - Deployer address chip
     - Real-time / latest price USD and market cap
     - Non-blocking "Refresh Metadata" button displaying BullMQ job progress
  3. `HolderTable` (FR-7.1):
     - Table of all tracked wallets holding or previously holding the token
     - Columns:
       - `WALLET / ENS`: address chip or resolved ENS name
       - `GRADE`: badge (`A`, `B`, `C` or `UNAVAILABLE`)
       - `LABEL`: computed tag label (e.g. `SMART-RIDER [W]`)
       - `ENTRY MC`: market cap at initial position entry
       - `STATUS`: status indicator badge:
         - `● HOLDING` (Emerald) when position is open and no CEX deposits/sells
         - `● DISTRIBUTED` (Amber) when position is open with CEX deposits or partial distributions
         - `● EXITED` (Crimson) when position is closed
       - `HOLDINGS USD`: current estimated value
       - `TRACKED SUPPLY %`: share of tracked wallet holdings
  4. `TokenNetflowChart` (FR-7.1):
     - Cumulative and bucketed netflow (buying vs selling) of tracked wallets on this token
     - 24h, 7d, and 30d netflow totals
  5. `RedFlagList` (FR-7.2, FR-7.1):
     - Paid-promoter warning: highlighted amber/crimson alert if any tracked wallet received tokens directly from the deployer address, naming the wallet and transaction hash
     - Top-10 holder share from explorer data (or explicit `UNAVAILABLE` badge, never 0%)
     - Token age risk indicator (flags tokens deployed < 24h or < 7d)
     - Cluster co-presence warnings: alerts if multiple wallets in the same cluster hold active positions in the token
     - Tracked wallet supply concentration KPI card

---

### 2. `/wallets/[chain]/[address]` — Auto-Grade Card Extension
- **Purpose:** Surfaces automated wallet grading (FR-1.4, Phase 6 DoD) directly on the wallet profile.
- **Component Breakdown:**
  1. `GradeCard`:
     - Win Rate (`%`): winning closed positions ÷ total closed positions
     - Realized PnL (`$USD`): exact sum across closed positions
     - Entry-Timing Ratio: average entry market cap ÷ peak market cap across positions (in `(0, 1]`)
     - Minimum sample size guard: displays `INSUFFICIENT SAMPLE (< 3 closed positions)` when closed positions < 3, preventing misleading metrics
     - Computed Label badge matching FR-1.6 (`gradeLabel`)

---

### 3. `/health` & `/settings` — Operations & Maintenance Console
- **Purpose:** System maintenance, safe data retention/pruning, quota observability, and backup staleness reminders (NFR-2, NFR-5, NFR-6, SRS §5).
- **Component Breakdown:**
  1. `BackupReminderBanner` (NFR-6):
     - Non-blocking banner displayed on `/health` and dashboard when no backup exists or newest backup is > 7 days old
     - Shows exact age of last backup and links to manual backup instructions (`npm run backup`)
  2. `MaintenancePanel` (NFR-5, P6-T04):
     - Manual "Prune Token History" utility
     - Chain selector + Token address input
     - Danger alert container with explicit confirmation requirement (must type `"PRUNE"`)
     - Real-time deletion audit displaying exact row counts per table (transactions, movements, snapshots, positions, flows)
     - Rebuild derivation actions (rebuilding positions, flows, graph without data loss)
  3. `QuotaMeter` / Provider Quota reporting:
     - Shows calls today, daily limit, remaining quota, and rate-limit hits for Etherscan, DexScreener, and RPC providers.
