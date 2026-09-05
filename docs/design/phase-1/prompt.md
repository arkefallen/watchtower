# P1-D01 Stitch Prompts

Stitch project: `projects/17665303442847236685`
Design system asset: `assets/ef5e0976c569407993cc376fc3c2698b`

Phase 1 designs were generated using Google Stitch under the approved "Observatory" design system:
- **Visual Atmosphere:** Dark, cockpit-dense onchain intelligence console. Density 8/10, Variance 5/10, Motion 3/10.
- **Palette:** Observatory Canvas (`#101214`), Graphite Surface (`#171A1D`), Raised Slate (`#1E2327`), Hairline Border (`#30373D`), Primary Text (`#E8ECEF`), Muted Text (`#929BA3`), Signal Amber (`#D7A84B`), Verified Green (`#79B79A`), Risk Red (`#D87870`).
- **Shapes:** Strict 0px border-radius (sharp corners) across all panels, tables, buttons, inputs, and chips. Circular status dots only.
- **Typography:** Geist (headings and UI labels), Geist Mono (addresses, hashes, numbers, USD values, timestamps).

---

## 1. Screen A: `/wallets` — Wallet Registry & Bulk Actions
- **Stitch Screen ID:** `d43930667c704cba8a170092c86596e0`
- **Title:** Watchtower Wallet Registry
- **Route:** `/wallets`
- **Local Assets:** `assets/registry.png`, `assets/registry.html`

### Prompt Content:
```text
Create the Watchtower Wallet Registry screen (/wallets). 
Visual direction: Observatory Canvas (#101214), Graphite Surface (#171A1D), 0px border-radius (sharp corners), Geist font for UI, Geist Mono for addresses, numbers, and timestamps.

Layout:
- Fixed 240px Sidebar: Dashboard, Wallets (ACTIVE, highlighted with amber indicator), Clusters, Graph, Radar, Alerts, Self-tracking, Token lookup, Settings, Health.
- Main Workspace Header: Title 'WALLETS', subtitle 'Tracked EVM watchlist and multi-chain profiling', Breadcrumb 'WATCHTOWER / WALLETS', top-right buttons: 'Import Wallets' (Signal Amber #D7A84B background, dark text) and 'Export CSV' (Graphite outline).

Filters Bar (Graphite Surface, Hairline Border #30373D):
- Search input: 'Search 0x address, ENS name, or label...'
- Dropdowns: 'All Chains (Base, BSC, Robinhood)', 'Edge / Style / Size', 'All Clusters', 'All (IDLE, ARMED, TRIGGERED)'.
- Numeric inputs: '$ Min - $ Max'.
- Active filter chips: [Chain: Base ✕], [Alert: ARMED ✕], [Clear All].
- Meta: 'Showing 42 of 128 tracked wallets'.
- Time Toggle: [Local (Asia/Jakarta) | UTC | Block].

Dense Data Table (1px Hairline #30373D rules, sticky header):
- Rows: 
  - Row 1: Selected. 'vitalik.eth' (0xd8da...6045), 'BASE' pill, 'SMART-RIDER [W]' label, Cluster #04 (Amber dot), '$142,500.00 USDC', '12m ago (2026-09-05 10:42)', '● ARMED (A1 Gas Inflow)' in amber, '● SYNCED' in green.
  - Row 2: Selected. '0x71c...a1b2', 'MAINNET' pill, 'EARLY-ACCUM [M]' label, Cluster #12, '$2,400.50 USDT', '1h ago', '● IDLE', '● SYNCED'.
  - Row 3: Selected. 'arbiscan.eth' (0x123...4567), 'ARBITRUM' pill, 'BOT-STYLE [L]' label, Cluster #04, '$89,200.00 DAI', '22m ago', '● TRIGGERED (C4)' in red, '● RUNNING 65%' with progress bar.

Floating Bulk Action Bar (Docked bottom-center, Graphite Surface, 2px amber accent top-border):
- '3 wallets selected' | [Re-sync Selected (Incremental)] [Set Priority Watch] [Export Selection] [Delete (Danger)] [✕ Clear Selection]
```

---

## 2. Screen B: `/wallets/new` — Wallet Intake & CSV Batch Progress
- **Stitch Screen ID:** `28684a82b3344b739b0608500b3d2e20`
- **Title:** Watchtower Wallet Intake
- **Route:** `/wallets/new`
- **Local Assets:** `assets/intake.png`, `assets/intake.html`

### Prompt Content:
```text
A high-density Wallet Intake screen for Watchtower. 

Layout: 
- Sidebar: Fixed 240px width. Navigation item 'Wallets' is ACTIVE with a Signal Amber indicator.
- Header: Title 'WALLET INTAKE', subtitle 'Register individual wallets or batch import via CSV format', Breadcrumb 'WATCHTOWER / WALLETS / INTAKE', and a [← Back to Wallets] button on the top-right.

Main Workspace (1440px desktop):
Two-column grid using CSS Grid with a 1px Hairline Border divider (#30373D).

Left Column (45%): 'Single Address Intake' card in Graphite Surface (#171A1D).
- Input for Address/ENS: 'vitalik.eth' with a resolved text badge '✓ Resolved to 0xd8da6bf26964af9d7eed9e03e53415d37aa96045 via L1 Universal Resolver'.
- Chain Selector: Dropdown set to 'Base (Chain 8453)'.
- Label Input: 'Vitalik Primary'.
- Flags: 'High Watch Priority' (Checked), 'Is Self' (Unchecked).
- Action: 'Add Wallet & Start Ingestion' button (Signal Amber #D7A84B, dark text).

Right Column (55%): 'Batch Import (CSV / Textarea)' card.
- Textarea in Geist Mono showing addresses including an invalid line: '0xbad_invalid_address,base,Malformed'.
- Validation Callout: Risk Red (#D87870) border with error 'Validation Issues Found (1 invalid line): Line 3: Invalid hex address length'.
- Stats: 'Ready to import: 95 valid wallets | 2 duplicates | 1 invalid line'.
- Action: 'Start Batch Intake (95 Wallets)' button (Graphite outline, amber hover).

Pipeline Progress (Docked Bottom Right):
- Raised Slate panel (#1E2327) with Signal Amber top border.
- Title: 'BATCH INTAKE PROGRESS — Job #intake-9821'.
- Progress Bar: 68% Signal Amber fill with Geist Mono label.
- Running Stage: 'Stage 9/14: trace:funding [● RUNNING 68%]'.
- List of completed stages (1-8) with green checkmarks and queued stages (10-11).
- Notice: 'Intake runs asynchronously... [View in Bull Board ↗]'.
```

---

## 3. Screen C: `/wallets/[chain]/[address]` — Profile, Heatmap, Parking Timeline
- **Stitch Screen ID:** `a4a6c83fb18d4442a7a2740f5b7c28dd`
- **Title:** Watchtower Wallet Detail: vitalik.eth
- **Route:** `/wallets/[chain]/[address]`
- **Local Assets:** `assets/detail.png`, `assets/detail.html`

### Prompt Content:
```text
Watchtower EVM intelligence console: /wallets/base/0xd8da6bf26964af9d7eed9e03e53415d37aa96045 - Wallet Detail.

Layout: 240px fixed left sidebar. Navigation: Wallets is ACTIVE (Amber). Main workspace is a fluid dark cockpit.

Top Identity Header (Graphite Surface #171A1D, 1px Hairline #30373D):
- Breadcrumb: WATCHTOWER / WALLETS / BASE / 0xD8DA...6045
- Title: 'vitalik.eth' (Geist 24px bold) | Address: 0xd8da6bf26964af9d7eed9e03e53415d37aa96045 (Geist Mono, copy icon, link icon).
- Badges: [BASE] (Pill), [SMART-RIDER [W]] (Amber Pill), [Cluster #04] (Amber indicator), [● ARMED (A1)], [● SYNCED 14m ago].
- Actions: [Re-sync Wallet (Incremental)] [Edit Tags] [Delete Wallet].

Tag Editor Toolbar (Inline, compact):
- Selects: Edge [SMART], Style [RIDER], Size [W (Whale)].
- Inputs: Label 'Vitalik Primary', Notes 'High conviction test wallet'.
- Toggles: Watch Priority (checked), Is Self (checked).

Profile Statistics Grid (6 cards, Graphite Surface #171A1D):
1. First Tx Date: 2023-08-09 (Block #2,140,512) | 574 days ago
2. Age at 1st Memecoin Trade: 142 days
3. Total Ingested Txs: 1,420 txs (980 normal, 312 internal, 128 ERC-20)
4. Distinct Tokens Traded: 38 tokens
5. Current Parked Stables: $142,500.00 USDC (Peak: $350,000.00)
6. Dormancy Status: Active (Last trade 2h ago)

Activity Heatmap Component (Raised Slate #1E2327):
- Title: ONCHAIN ACTIVITY HEATMAP.
- Toggles: [Habitual Timing (Full History)] (Active), [Rolling 7 Local Days].
- Context: Local Time: Asia/Jakarta (UTC+7).
- Grid: 7 rows (Sun-Sat) x 24 columns (00-23).
- Colors: Stepped amber (#171A1D, #4A3A1A, #85621F, #D7A84B).
- Summary: Habitual peak: Weekdays 13:00 - 17:00 UTC+7.

Stablecoin Parking Timeline (Graphite Surface #171A1D):
- Feed of 3 events:
  1. 2026-09-04 16:32 | [🟢 INFLOW] +$50,000.00 USDC | Counterparty: Binance 14 | Tx: 0x8f2...3a1
  2. 2026-08-28 11:15 | [🔴 OUTFLOW] -$25,000.00 USDC | Counterparty: Uniswap V3 Pool | Tx: 0x1b4...8c9
  3. 2026-08-10 09:04 | [🟢 INFLOW] +$117,500.00 USDC | Counterparty: 0x33b...aa90 (Cluster #04) | Tx: 0x99a...1e2
```

---

## 4. Screen D: `/wallets/[chain]/[address]/funding` & `/clusters` — Funding Tracer & Clusters
- **Stitch Screen ID:** `dd1d971058614326bf583a87f141482f`
- **Title:** Watchtower Funding Tracer: vitalik.eth
- **Route:** `/wallets/[chain]/[address]` (Funding Section) & `/clusters`
- **Local Assets:** `assets/funding.png`, `assets/funding.html`

### Prompt Content:
```text
Generate the 'Recursive Funding Tracer' screen for the Watchtower EVM intelligence console at 1440px desktop width.

Layout:
- SideNavBar (fixed 240px, 'Wallets' ACTIVE with amber indicator).
- Main Workspace:
  - Header: Breadcrumb 'WATCHTOWER / WALLETS / BASE / 0xD8DA...6045 / FUNDING TRACE'. Title 'vitalik.eth (0xd8da...6045)' with Chain 'BASE'. Subtext 'Inbound Funding Traced: $485,200.00 USD across 3 upstream hops'.
  - Alert Banner: '● SHARED FUNDER DETECTED: Upstream funder 0x33b8...aa90 is shared with 2 other tracked wallets (0x71c...a1b2, 0x992...3311) → Auto-created [Cluster #04] (View Cluster Index ↗)'. Signal Amber top-border, Graphite Surface background.
  - Main Area (Grid):
    - Left (Fluid): 'Recursive Funding Tree' canvas. Visual representation of a hierarchical node tree with nodes connected by 1px Hairline lines.
      - Root Node: 'Target: vitalik.eth (0xd8da...6045)', Tag [SMART-RIDER [W]], Data: Total Inbound $485,200.00 USD, 14 events, First Funded 2023-08-09.
      - Branch 1: Connecting line labeled '+$150,000.00 USDC (Native Inflow)'. Node 'Binance 14 (Hot Wallet)', Address '0x28c6...3982', Tag [TERMINAL ENTITY: CEX] (Green outline), Stop Reason: TERMINAL_ENTITY.
      - Branch 2: Connecting line labeled '+$217,700.00 USDC & ETH'. Node '0x33b8...aa90', Badge [⚠️ PRIMARY WALLET] (Amber solid). Tooltip-style evidence box visible: 'Primary Wallet Evidence (FR-2.4): ✓ Condition A satisfied... ✓ Condition B satisfied...'.
        - Sub-Branch (from Branch 2): Connecting line '+$75,000.00 ETH (Internal Trace #2)'. Node '0xfa89...11c4', Stop Reason [DEPTH LIMIT (Depth 3/3 reached)], Button '[+ Deep Trace (Extend to 6 Hops)]'. Show 'Deep trace in progress... Queued job #funding-deep-4421 [● 45%]' as an inline state.
      - Branch 3: Connecting line '+$117,500.00 ETH (100% Contract Internal Trace)'. Node '0x55d1...09eb', Tag [INTERNAL TX ONLY], Data: First Gas Funding 2023-08-09 04:12 UTC, Stop Reason: NO_INBOUND.
    - Right (360px): 'Evidence & Cluster Drawer'.
      - Title: 'FUNDING AUDIT & ENTITY METRICS'.
      - Cluster Rollup Card: Cluster #04, 3 Members, Combined Parked Stables: $231,700.00 USD. Members list: vitalik.eth, 0x71c...a1b2, 0x992...3311.
      - Override Tool: 'Mark 0xfa89...11c4 as Terminal Entity [Dropdown: CEX, Bridge, Router, Human]', Button 'Save Custom Label'.
```
