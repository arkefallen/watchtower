# P3-D01 Screen Map: Phase 3 Narrative Radar

Stitch project: `projects/17665303442847236685`  
Design System: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)  
Viewport Contract: Desktop 1440px (Stitch exported reference at 2560×2048 canvas scale)

---

## Screen Inventory & State Coverage

| Screen / Route | Device | Required Content & Components | State Coverage & Acceptance Signal | Stitch Screen ID | Local Assets |
|---|---|---|---|---|---|
| **/radar** (Narrative Radar) | Desktop 1440px | Reusable Sidebar, KPI Breadth Bar (`BreadthIndicator`), Radar Controls, Movement Feed (`MovementFeed`), Movement Group Cards (`MovementGroupCard`, `GroupEvidence`), Warning Cluster Co-Entry Card (`ClusterCoEntryCard`), Netflow Table (`NetflowTable`) | **Streaming, Filtered, Quiet Market, Unpriced Token, Warning State, Pagination.** Streams chronological actions with USD, MC, age; groups independent buyers into co-accumulation cards; highlights cluster co-entries as distinct warning cards; populates 24h/7d/30d netflow and priority breadth. | `7e46a46b78ec4058ac1484df2345df17` | `assets/radar.png`<br>`assets/radar.html` |

---

## State Matrix (Phase 3 DoD Checklist)

| System State | Visual Treatment & Location | Requirement / SRS § Reference |
|---|---|---|
| **Active Movement Streaming** | Chronological feed updating at radar cadence (default 5m) with green dot `● STREAMING (5m cadence)` and manual evaluate button. | FR-4.1, FR-5.4 |
| **Movement Rows** | Columns: Time (local/block toggle), Wallet (ENS/address + tags + cluster dot), Action (BUY/SELL/STABLE_PARK/STABLE_SPEND/CEX_DEPOSIT/CEX_WITHDRAWAL/NEW_TOKEN_ENTRY), Token (ticker + avatar), USD Amount, Market Cap at action, Token Age at action, Tx Link ([↗]). | FR-4.1, FR-4.8 |
| **New Token Entry** | First-ever buy for wallet flagged with distinct amber `NEW ENTRY` badge. | FR-4.1, §4.9 |
| **Unpriced Token** | When USD / MC is unknown, renders `—` in Geist Mono with tooltip explaining unpriced state; row is preserved. | SRS §10.3, §4.6 |
| **Co-Accumulation Card** | Card displaying token, combined USD bought, time span, supply share %, member list with frozen grade badges, and expandable Independence Evidence. | FR-4.2, §0 D-9 |
| **Independence Evidence** | Expandable card section proving mutual independence: different funders, zero direct transfer edges, distinct clusters, and member tx links. | FR-4.2, FR-4.8, SRS §10.7 |
| **Co-Distribution Card** | Mirror of co-accumulation for sells + CEX deposits of the same token within 12h. | FR-4.3 |
| **Cluster Co-Entry Warning** | Separate warning card with risk indicator (`⚠️ CLUSTER CO-ENTRY DETECTED`), cluster name, shared funder, member entries within 1h. **Never mixed into co-accumulation feed.** | FR-4.4, §4.9 |
| **Netflow Table** | Aggregated net USD flow (Buys − Sells − CEX Deposits) over 24h/7d/30d tabs. Sortable by net or gross volume with top gainers/losers. | FR-4.5 |
| **Breadth Indicator** | % of priority-watch wallets active in 24h/7d. When zero, renders explicit `MARKET QUIET — 0 / N priority wallets active` rather than a blank state. | FR-4.7 |
| **Cluster Rotation View** | Cluster detail page subview: timeline of exits from token set A and entries into set B within 7d, with summary sentence. | FR-4.6 |
