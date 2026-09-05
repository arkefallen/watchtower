# P3-D01 Stitch Prompts: Narrative Radar

Stitch project: `projects/17665303442847236685`  
Design system asset: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

Phase 3 designs were generated using Google Stitch under the approved "Observatory" design system:
- **Visual Atmosphere:** Dark, cockpit-dense onchain intelligence console. Density 8/10, Variance 5/10, Motion 3/10.
- **Palette:** Observatory Canvas (`#101214`), Graphite Surface (`#171A1D`), Raised Slate (`#1E2327`), Hairline Border (`#30373D`), Primary Text (`#E8ECEF`), Muted Text (`#929BA3`), Signal Amber (`#D7A84B`), Verified Green (`#79B79A`), Risk Red (`#D87870`).
- **Shapes:** Strict 0px border-radius (sharp corners) across all panels, tables, buttons, inputs, and chips.
- **Typography:** Geist (headings and UI labels), Geist Mono (addresses, hashes, numbers, USD values, timestamps).
- **Reusable Chrome:** Standard 240px Left Navigation Sidebar with active Amber highlight on `Radar` (`/radar`).

---

## Screen: `/radar` — Narrative Radar & Real-Time Movement Feed

- **Stitch Screen ID:** `7e46a46b78ec4058ac1484df2345df17`
- **Title:** Watchtower Narrative Radar
- **Route:** `/radar`
- **Local Assets:** `docs/design/phase-3/assets/radar.png`, `docs/design/phase-3/assets/radar.html`

### Prompt Content:
```text
Design the Watchtower Narrative Radar screen (/radar) for onchain wallet intelligence.

Global Context & Theme:
- Desktop-first 1440px cockpit-dense onchain intelligence console under the approved Watchtower Intelligence design system (Observatory Canvas #101214, Graphite Surface #171A1D, Raised Slate #1E2327, Hairline Border #30373D, Signal Amber #D7A84B, 0px sharp corners, Geist font for UI chrome, Geist Mono for addresses, numbers, USD, and timestamps).
- Fixed 240px Left Sidebar (reusable shared sidebar): Logo 'WATCHTOWER' with eye icon and 'EVM INTEL CORE', Navigation items: Dashboard, Wallets, Clusters, Graph, Radar (ACTIVE with amber left indicator and active background #1E2327), Alerts, Self-tracking, Token lookup, Settings, Health. Bottom footer: green dot 'CORE ONLINE v0.1.0'.

Main Workspace:
Top Header & Intelligence Banner:
- Page title 'NARRATIVE RADAR', subtitle 'Real-time onchain movement detection, independent co-accumulation, and netflow radar'.
- Top KPI & Breadth Bar:
  - Card 1: 'RADAR BREADTH (24H)' -> '42.0%' (21 / 50 priority wallets active in last 24h). Subtext: 'Status: ELEVATED ACTIVITY' (green dot).
  - Card 2: 'CO-ACCUMULATION SIGNALS' -> '3 Active Groups' in 24h window.
  - Card 3: 'CLUSTER CO-ENTRY WARNINGS' -> '1 Coordinated Entry' (warning indicator).
  - Card 4: 'NETFLOW LEADER (24H)' -> 'PEPE (+$248.5K net)'.
- Radar Controls Toolbar:
  - Time Window: [1H | 6H | 24H | 48H] (button group with 24H active).
  - Live Stream status: '● STREAMING (5m cadence)' with manual [Evaluate Now] button.
  - Quick Search / Filter input: 'Filter by token, wallet, or cluster...'.

Main Split Layout:
Left Column (Width ~65%):
1. 'MOVEMENT FEED' (Chronological, real-time list of meaningful watchlist actions):
   - Table Toolbar: Filter tabs [All Actions | Swaps (Buy/Sell) | Stable Park/Spend | CEX Flows | New Token Entries]. Showing 50 rows per page with cursor pagination controls.
   - Dense table columns: Time (local time / block toggle), Wallet (Address/ENS chip with tags like 'SMART-RIDER [W]', watch priority badge, and cluster color dot), Action badge (BUY in green, SELL in red, STABLE_PARK in amber, CEX_DEPOSIT in purple/muted, NEW_TOKEN_ENTRY in amber outline), Token (Ticker, avatar, contract link), Amount USD (Geist Mono, e.g. '$42,500.00'), Market Cap at Action (e.g. '$14.2M'), Token Age at Action (e.g. '3.2 days'), Tx Link icon ([↗] to explorer).
   - Sample Rows:
     - Row 1: 13:08:12 | vitalik.eth [SMART-RIDER, W, Cluster #04] | BUY | PEPE | $42,500.00 | MC $14.2M | Age 3.2d | 0x4f...89 [↗]
     - Row 2: 13:04:45 | 0x71c...a1b2 [DEX-DEGEN, M] | BUY | PEPE | $18,200.00 | MC $14.1M | Age 3.2d | 0x9b...11 [↗] (isFirstEntryForWallet badge)
     - Row 3: 12:55:01 | 0x33b...aa90 [ALPHA-WHALE, W, Cluster #04] | STABLE_PARK | USDC | $150,000.00 | — | — | 0x12...fa [↗]
     - Row 4: 12:42:19 | 0x99a...beef [BOT-RUNNER, S] | CEX_DEPOSIT | Binance 14 | $88,000.00 PEPE | MC $13.9M | Age 3.2d | 0x77...bc [↗]
     - Row 5: 12:30:00 | 0x44d...6045 [SWING-TRADER, M] | SELL | BRETT | $15,400.00 | MC $48.5M | Age 14.1d | 0x33...de [↗]

Right Column (Width ~35%):
1. 'CO-ACCUMULATION & CO-DISTRIBUTION DETECTIONS':
   - Movement Group Card 1 (CO_ACCUMULATION):
     - Header: 'CO-ACCUMULATION: PEPE' (Window: 24h, Time span: 4.2 hours).
     - Combined Stats: '$60,700.00 USD Bought' · '2 Mutually Independent Wallets' · '0.42% of Token Supply'.
     - Member Wallets: vitalik.eth (Grade: A, $42.5K) and 0x71c...a1b2 (Grade: B+, $18.2K).
     - Expandable 'INDEPENDENCE EVIDENCE' section:
       - '✓ Different Root Funders (Kraken vs Coinbase)'
       - '✓ Zero Direct Transfer Edges on Base'
       - '✓ Distinct Clusters'
       - Tx Hash links for each buyer.
   - Movement Group Card 2 (CLUSTER_CO_ENTRY - Distinct Warning Card):
     - Warning Header with hazard indicator: '⚠️ CLUSTER CO-ENTRY DETECTED: WOJAK'
     - Callout text: 'Warning: Coordinated cluster entry (2 wallets of Cluster #04 entered within 18 minutes). Insider / single-actor signal.'
     - Cluster Info: Cluster #04 (Shared Funder: Binance 14).
     - Members: vitalik.eth ($25K) and 0x33b...aa90 ($30K).

2. 'NETFLOW RADAR (24H / 7D / 30D)':
   - Tabs: [24H | 7D | 30D].
   - Table of aggregated net USD flow (Buys - Sells - CEX Deposits):
     - Token PEPE: Net +$248,500.00 (Buys $310K, Sells $40K, CEX $21.5K) | 8 Wallets
     - Token BRETT: Net -$84,200.00 (Buys $12K, Sells $75K, CEX $21.2K) | 4 Wallets
     - Token DEGEN: Net +$32,100.00 (Buys $45K, Sells $12.9K, CEX $0) | 3 Wallets
```
