# P2-D01 Stitch Prompts: Interaction Graph

Stitch project: `projects/17665303442847236685`
Design system asset: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

Phase 2 designs were generated using Google Stitch under the approved "Observatory" design system:
- **Visual Atmosphere:** Dark, cockpit-dense onchain intelligence console. Density 8/10, Variance 5/10, Motion 3/10.
- **Palette:** Observatory Canvas (`#101214`), Graphite Surface (`#171A1D`), Raised Slate (`#1E2327`), Hairline Border (`#30373D`), Primary Text (`#E8ECEF`), Muted Text (`#929BA3`), Signal Amber (`#D7A84B`), Verified Green (`#79B79A`), Risk Red (`#D87870`).
- **Shapes:** Strict 0px border-radius (sharp corners) across all panels, tables, buttons, inputs, and chips.
- **Typography:** Geist (headings and UI labels), Geist Mono (addresses, hashes, numbers, USD values, timestamps).

---

## Screen: `/graph` — Full-Screen Interaction Bubble Map

- **Stitch Screen ID:** `22476ea9a4f340ee855b247b5cc6d12a`
- **Title:** Watchtower Interaction Graph
- **Route:** `/graph`
- **Local Assets:** `assets/graph.png`, `assets/graph.html`

### Prompt Content:
```text
Create the Watchtower Interaction Graph screen (/graph) for onchain wallet intelligence.

Visual direction: Observatory Canvas (#101214), Graphite Surface (#171A1D), Raised Slate (#1E2327), Hairline Border (#30373D), Signal Amber (#D7A84B), Verified Green (#79B79A), Risk Red (#D87870). Strict 0px sharp corners, Geist font for UI chrome, Geist Mono for addresses, numbers, USD, and timestamps. High density (8/10).

Layout:
- Fixed 240px Left Sidebar: Logo 'WATCHTOWER', Nav links: Dashboard, Wallets, Clusters, Graph (ACTIVE, amber indicator #D7A84B), Radar, Alerts, Self-tracking, Token lookup, Settings, Health.
- Main Workspace: Full-screen interactive graph canvas with top toolbar, bottom legend, and right-side inspection drawer.

Top Toolbar (Graphite Surface #171A1D, 1px border #30373D):
- Title 'INTERACTION GRAPH', Subtitle 'Bubble map of direct wallet-to-wallet transfers and cluster compounds'
- Filters:
  - Time Range: [24H | 7D | 30D | ALL] (button group)
  - Min USD Filter: '$ Min' input (default $100)
  - Token Selector: Dropdown 'All Tokens (PEPE, USDC, ETH, DEGEN)'
  - Direction: [Both | A → B | B → A]
  - Node Size Toggle: [Size Tag (W/M/S) | Stablecoin Balance]
  - Secondary Nodes Toggles: [x] Funders [ ] Primary Wallets
  - Action Buttons: [Fit View] (Graphite outline), [Export PNG] (Signal Amber #D7A84B outline, camera/download icon)

Main Canvas Area:
- Dark grid background (#101214 with subtle 32px dots or gridlines).
- Force-directed compound nodes with bounding boxes for Clusters (e.g. 'Cluster #04' bounding box with subtle dashed amber border, containing 4 nodes).
- Nodes:
  - Node 1: 'vitalik.eth' (0xd8da...6045), Large bubble, Amber border (ARMED), Cluster #04 fill, stable balance '$142.5K'.
  - Node 2: '0x71c...a1b2', Medium bubble, Red border (TRIGGERED), Cluster #04 fill.
  - Node 3: 'arbiscan.eth', Medium bubble, Muted border (IDLE), Cluster #12 (Cyan fill).
  - Node 4: '0x99a...beef', Small bubble, Muted border (IDLE), Independent / unclustered (dark surface fill).
- Directed Edges with arrows:
  - Edge between vitalik.eth and 0x71c...a1b2: Thick amber-tinted line with arrowhead, center pill label 'PEPE · $45.2K' (Geist Mono).
  - Edge between vitalik.eth and arbiscan.eth: Medium line, center pill label 'USDC · $12.0K'.
  - Edge between 0x71c...a1b2 and 0x99a...beef: Thin line, center pill label 'ETH · $1.5K'.

Right Drawer / Inspection Panel (Width 360px, Graphite Surface #171A1D, 1px border):
- Tab 1: Selected Node ('vitalik.eth'):
  - Address chip with copy button, Chain: BASE, Tags: SMART-RIDER [W], Cluster #04 (Amber dot).
  - Key Stats: First Tx: 2024-03-12, Total Txs: 1,420, Stable Balance: $142,500.00 USDC, Alert State: ● ARMED (A1 Gas Inflow).
  - Independence Verdict Panel (FR-3.6):
    - Header 'INDEPENDENCE VERDICT' (Geist Mono 12px, uppercase).
    - Verdict statement list:
      - '● Connected to 0x71c...a1b2 via direct transfers (23 txs, $45.2K)'
      - '● Connected to 0x33b8...aa90 via shared funder Binance 14'
      - '● Connected to 0x123...4567 via co-entry (3 tokens within 24h)'
  - Link: 'Open Full Profile →' (/wallets/base/0xd8da6bf26964af9d7eed9e03e53415d37aa96045)
- Edge Breakdown Drawer / Popover (Clicked edge vitalik.eth ↔ 0x71c...a1b2):
  - Header 'EDGE BREAKDOWN: vitalik.eth ↔ 0x71c...a1b2'
  - Summary: Total $45,200.00 USD · 23 Transfers · First: 2026-08-10 · Last: 2026-09-04
  - Table:
    - Col 1: Token ('PEPE')
    - Col 2: Total USD ('$38,200.00')
    - Col 3: Tx Count ('18 txs')
    - Col 4: Direction ('vitalik.eth → 0x71c... ($28K) / 0x71c... → vitalik.eth ($10.2K)')
    - Col 5: Sample Tx links ('0x8f2a... [↗]')

Bottom-Left Legend (Floating docked card, Raised Slate #1E2327, 1px border #30373D):
- Node Borders: ● IDLE (Muted #30373D) · ● ARMED (Amber #D7A84B) · ● TRIGGERED (Red #D87870)
- Node Size: Size Tag [W/M/S] or USD Balance
- Edge Width: Volume ($100 to $100K+)
- Compounds: Dashed boundary = Shared Funder Cluster
```
