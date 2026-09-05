# P3-D01 Interaction Notes: Phase 3 Narrative Radar

Stitch project: `projects/17665303442847236685`  
Design system asset: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)  
Screen: `/radar` (Stitch Screen ID: `7e46a46b78ec4058ac1484df2345df17`)

---

## 1. Information Architecture & Workspace Layout

The Narrative Radar (/radar) uses a **high-density split workspace** designed for an active monitoring operator:

1. **Left Navigation Rail (240px Fixed):**
   - Reusable shared `Sidebar` component.
   - Item `Radar` active with Signal Amber left indicator and raised slate background (`#1E2327`).

2. **Top Intelligence Banner (Full Width):**
   - Page Title and Subtitle.
   - **4 KPI Metric Cards:**
     - *Radar Breadth (24h):* Active priority wallet percentage with live/quiet indicator.
     - *Co-accumulation Signals:* Count of active multi-wallet accumulation groups.
     - *Cluster Co-entry Warnings:* Prominent warning pill if insider coordination is flagged.
     - *Netflow Leader:* Highest net inflow token in current window.
   - **Radar Controls Toolbar:**
     - Window selector tabs: `1H` | `6H` | `24H` | `48H` (default: `24H`).
     - Cadence indicator: `● STREAMING (5m cadence)`.
     - Action button: `Evaluate Now` for manual triggering.
     - Quick search filter.

3. **Primary Content (Split 65% / 35%):**
   - **Left Column (65%) — Movement Feed:**
     - Sticky toolbar with filter tabs: *All Actions*, *Swaps*, *Stable Park/Spend*, *CEX Flows*, *New Token Entries*.
     - High-density table: 50 rows per cursor page.
     - Action chips with semantic color coding (BUY green, SELL red, STABLE amber, CEX muted slate).
     - Hover row highlighting with Geist Mono data cells.
     - Clickable external transaction explorer links in rightmost column.
   - **Right Column (35%) — Signal & Netflow Rail:**
     - **Movement Group Cards:**
       - Co-accumulation cards with token badge, combined USD, supply %, time span, and member list.
       - Expandable accordion for **Independence Evidence** (explicit root funders, transfer check, cluster check).
     - **Cluster Co-Entry Cards:**
       - Distinct amber-striped warning container.
       - Clear callout text: *"Coordinated cluster entry... Insider / single-actor signal"*.
       - Identification of the cluster and root funder.
     - **Netflow Radar Table:**
       - Timeframe tabs: `24H` | `7D` | `30D`.
       - Compact table ranking tokens by net USD flow with directional positive/negative coloring.

---

## 2. Degraded & Edge States Specification

1. **Market Quiet State (FR-4.7):**
   - When no priority-watch wallets have executed actions in the window, Breadth Card displays:
     `● MARKET QUIET (0/50)` in muted text, explicitly stating quiet conditions rather than showing a misleading empty or broken state.
2. **Unpriced Token Movements (SRS §10.3, §4.6):**
   - When DexScreener/CoinGecko has no price for a young memecoin, the table renders `—` in USD and Market Cap cells.
   - Hovering the cell displays tooltip: *"USD value unavailable at ingest (untracked pair)"*. The movement row remains visible and intact.
3. **Unknown Supply Share (Decision D-9):**
   - If contract `totalSupply` is unverified or null, the co-accumulation card displays `Supply Share: —` with tooltip *"Total supply unknown"*, while continuing to display total USD bought.
4. **Empty Feed State:**
   - If a filter combination yields zero rows, displays a compact 0px graphite card:
     *"No watchlist movements detected matching active filters."* with a `Reset Filters` button.

---

## 3. Accessibility & Keyboard Navigation

- **Color Independence:** Warning states and group kinds use clear text badges (`CO-ACCUMULATION`, `CLUSTER WARNING`, `BUY`, `SELL`) and distinct icons alongside color.
- **Contrast:** Primary text `#E8ECEF` on `#171A1D` / `#101214` exceeds WCAG 2.2 AA (ratio > 11:1).
- **Focus Rings:** All interactive tabs, buttons, and links feature a 2px Signal Amber (`#D7A84B`) focus ring.
