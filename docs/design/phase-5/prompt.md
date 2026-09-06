# P5-D01 Stitch Prompts: Self-Tracking, Edge Decay, Dashboard & Manual Trades

Stitch project: `projects/17665303442847236685`  
Design system asset: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

Phase 5 designs were generated using Google Stitch under the approved "Observatory" design system:
- **Visual Atmosphere:** Dark, cockpit-dense onchain intelligence console. Density 8/10, Variance 5/10, Motion 3/10.
- **Palette:** Observatory Canvas (`#101214`), Graphite Surface (`#171A1D`), Raised Slate (`#1E2327`), Hairline Border (`#30373D`), Primary Text (`#E8ECEF`), Muted Text (`#929BA3`), Signal Amber (`#D7A84B`), Verified Green (`#79B79A`), Risk Red (`#D87870`).
- **Shapes:** Strict 0px border-radius (sharp corners) across all panels, tables, buttons, inputs, and chips.
- **Typography:** Geist (headings and UI labels), Geist Mono (addresses, hashes, numbers, USD values, timestamps).
- **Reusable Chrome:** Standard 240px Left Navigation Sidebar with active Amber highlight on `Self-tracking` (`/self`).

---

## Screen 1: `/self` — Self-Tracking Dashboard & Edge Decay

- **Stitch Screen ID:** `92a397724bcc442f89b15538087f50d1`
- **Title:** Watchtower Self-Tracking Dashboard
- **Route:** `/self`

### Prompt Content:
```text
Watchtower Self-Tracking & Edge Decay Dashboard (/self).
Observatory design system: canvas #101214, surface #171A1D, raised slate #1E2327, hairline borders #30373D, signal amber #D7A84B, 0px sharp corners.
240px sidebar with 'Self-tracking' active.
Header: 'SELF_TRACKING // EDGE_RIDER' with registered self wallet selector and 'Log Manual Trade' action button.
Top KPI bar: Win Rate (68.4%), Realized PnL (+$24,850.00), Unrealized (+$3,210.00), Average Follow Lag (38m), Linked Trades (19).
Section 1: Edge Decay Curve (FR-6.4).
- Followed Wallet Filter: all / specific smart wallet.
- Side-by-side Recharts curve and accessible metrics table with buckets '0-1h', '1-6h', '6-24h', '>24h', showing trade count, avg user ROI, avg wallet ROI, and win rate.
- Highlighted 0-1h golden capture zone.
Section 2: Personal PnL Breakdown (FR-6.5).
- Breakdown by Followed Wallet, Token, and Lag Bucket.
Section 3: Trade Comparison View (FR-6.6).
- Table with columns: TIMESTAMP, TOKEN, FOLLOWED_WALLET, LAG (MINUTES), MC_DELTA, USER_ROI, WALLET_ROI, VERDICT (CAPTURED / DECAYED), THESIS.
```

---

## Screen 2: `/self/trades` — Manual Trade Log & Thesis Form

- **Stitch Screen ID:** `9adbcafa7a8b42318532575a14e869a3`
- **Title:** Watchtower Manual Trade Log & Thesis Form
- **Route:** `/self/trades`

### Prompt Content:
```text
Watchtower Manual Trade Log & Thesis Form screen (/self/trades).
Layout: 240px sidebar (Self-tracking active), breadcrumbs 'Self-Tracking / Log Trade'.
Main Content: Dense trade entry console (surface #171A1D, sharp 0px corners, hairline borders #30373D).
Form Fields:
- Own Wallet selector (monitored wallets dropdown).
- Token Address & Chain selector (Base, BSC, Robinhood options).
- Side: BUY / SELL segmented control using Signal Amber (#D7A84B) for active state.
- Amount USD: Geist Mono input with '$' prefix.
- Entry Timestamp: UTC date-time picker.
- Optional Followed Wallet: dropdown of smart wallets; if selected, show 'isLinkPinned: true' badge.
- Required Thesis (FR-6.3): Multi-line textarea for 'What narrative I judged / rationale for entry'. Red warning text (#D87870) ready for empty submission: 'Thesis required for manual trade logging'.
- Submit button: 'RECORD TRADE' in Signal Amber with dark text.
Recent Manual Trades Table: Below the form, show a table of logged manual trades with columns for Timestamp, Side, Token, Amount, Followed Wallet (with pinned icon), and Thesis (truncated preview).
Visual Style: Dark cockpit, Observatory tokens, canvas #101214, 0px sharp corners, Geist/Geist Mono fonts. 1440px max-width content area.
```
