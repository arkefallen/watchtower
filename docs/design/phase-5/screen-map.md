# P5-D01 Screen Map & Component Hierarchy

## Routes & Screens

### 1. `/self` — Self-Tracking Dashboard & Edge Decay
- **Purpose:** Primary hub for monitoring self-registered wallet performance, edge decay against followed smart wallets, PnL breakdowns, and execution comparisons.
- **Chrome:** Standard 240px Navigation Sidebar (`/self` highlighted), Top Status Header with Self Wallet Selector, 'Log Trade' Quick Action.
- **Component Breakdown:**
  1. `SelfWalletCard` / Header: Registered self wallet overview, address, chain, total trades, sync status.
  2. `SelfMetricsBar`: Top KPI row with 5 cards:
     - Win Rate (`%`)
     - Realized PnL (`$USD`)
     - Unrealized PnL (`$USD`)
     - Average Follow Lag (`minutes`)
     - Linked Trades Count
  3. `EdgeDecayChart` (FR-6.4):
     - Followed Wallet Filter selector (All / specific followed wallet)
     - Split View:
       - Accessible data table: Buckets `0-1h`, `1-6h`, `6-24h`, `>24h` with Trade Count, Avg User ROI, Avg Wallet ROI, Win Rate.
       - Recharts Line Chart with Golden highlight for `0-1h` Capture Zone.
       - Low sample alert when `sampleSize < 5`: states sample is insufficient rather than drawing misleading conclusions.
  4. `PnlBreakdown` (FR-6.5):
     - Segmented tabs: 'By Followed Wallet', 'By Token', 'By Lag Bucket'.
     - Clean tabular breakdown of trade counts, net PnL, and average lag.
  5. `ComparisonTable` (FR-6.6):
     - Granular table of linked trades.
     - Columns: `TIMESTAMP`, `TOKEN`, `FOLLOWED_WALLET`, `LAG`, `MC_DELTA`, `USER_ROI`, `WALLET_ROI`, `VERDICT` (`CAPTURED` in Amber / `DECAYED` in Coral / `—` for unknown wallet ROI).

---

### 2. `/self/trades` — Manual Trade Log & Thesis Form
- **Purpose:** Operator interface for manually recording trades with mandatory narrative thesis enforcement and optional pinned smart wallet signal linkage.
- **Component Breakdown:**
  1. Breadcrumbs: `Self-Tracking / Log Trade`
  2. `TradeLogForm` (FR-6.3):
     - Own Wallet selection dropdown (auto-populated with `isSelf` wallets)
     - Token Address input & Chain selector (Base, BSC, Robinhood)
     - Side selector (BUY / SELL)
     - Amount USD input
     - Entry Timestamp picker (UTC)
     - Optional Followed Wallet dropdown (sets `isLinkPinned: true`)
     - Mandatory Thesis field (textarea with validation message "Thesis required for manual trade logging")
     - Server-side error display on empty or whitespace-only submission
  3. Recent Manual Trades list:
     - Audit log showing recorded manual trades with source `MANUAL`, thesis preview, and pinned status indicator.
