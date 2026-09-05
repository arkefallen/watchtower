# P2-D01 Interaction Notes: Phase 2 Interaction Graph

Stitch project: `projects/17665303442847236685`
Design system asset: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)
Screen: `/graph` (Stitch Screen ID: `22476ea9a4f340ee855b247b5cc6d12a`)

---

## 1. Graph Canvas Interaction Hierarchy

### Canvas Layout & Engine
- **Engine:** Cytoscape.js 3.x with `cytoscape-fcose` 2.2 force-directed compound layout.
- **Background:** Observatory Canvas (`#101214`) with subtle dot-matrix grid (32px spacing, `#1E2327`).
- **Cluster Compounds:** Wallets belonging to the same cluster are placed into compound parent nodes. The compound node renders as a subtle rectangular boundary with a dashed 1px border colored by the cluster's assigned hex palette (`Cluster.colorHex`), with an uppercase label in Geist Mono (e.g., `CLUSTER #04 · 3 MEMBERS`).
- **Navigation Controls:**
  - **Pan:** Click and drag empty canvas area.
  - **Zoom:** Mouse wheel scroll or trackpad pinch.
  - **Node Drag:** Click and hold a node to drag it. Its position is pinned until user releases or resets layout.
  - **Fit View:** Button in top toolbar triggers animated Cytoscape `fit()` with 40px padding.

### Performance Controls (NFR-7: >30 fps with 300 nodes / 1,000 edges)
- `hideEdgesOnViewport: true` during fast pan/zoom.
- `textureOnViewport: true` for GPU rasterization during continuous interaction.
- Layout runs asynchronously off the initial paint with `randomize: false` during filter changes to avoid violent layout jumping.

---

## 2. Nodes & Edge Styling Rules

### Node Encodings (FR-3.5)
1. **Fill Color:**
   - Clustered wallet: Cluster color (`Cluster.colorHex`).
   - Unclustered wallet: Graphite Surface (`#171A1D`).
   - Secondary funder / terminal entity: Muted slate (`#1E2327`) with diamond/hexagon shape.
2. **Border Encoding (Alert State):**
   - `IDLE`: 1.5px Hairline Border (`#30373D`).
   - `ARMED`: 2px Signal Amber (`#D7A84B`) solid border.
   - `TRIGGERED`: 2.5px Risk Red (`#D87870`) solid border with gentle pulse animation.
3. **Size Scaling Toggle:**
   - Mode A (`tag`): Based on manual `size` tag: `W` = 48px diameter, `M` = 36px, `S` = 24px, untagged = 30px.
   - Mode B (`balance`): Monotonically scaled with current parked stablecoin balance from min 20px ($0) to max 64px ($500K+).
4. **Node Labels:**
   - Display resolved ENS name if available, otherwise truncated address (`0xd8da...6045`) in Geist Mono 11px with dark text outline for contrast.

### Edge Encodings (FR-3.2, FR-3.3)
1. **Edge Direction:** Directed arrow from sender to receiver. When transfers exist in both directions, the arrow points towards the net recipient (or bidirectional marker if equal).
2. **Edge Label Formatting:**
   - Rendered as a center pill on the edge: `TICKER · $USD` (e.g. `PEPE · $45.2K`).
   - Native asset transfers render using the chain's native symbol (`ETH · $3.2K` on Base, `BNB · $1.4K` on BSC).
   - Ticker is the largest-value token on this edge (`topTokenSymbol`).
   - Compact USD notation: `< $1K` formatted as exact dollar (e.g. `$450`), `≥ $1K` formatted as `$1.5K`, `≥ $1M` formatted as `$2.4M`.
3. **Edge Stroke Width:** Proportional to `totalUsd` (range 1px for $100 to 6px for $100K+).

---

## 3. Side Panel & Breakdown Drawers

### Selected Node Panel (`NodeSidePanel`, FR-3.8)
Opened when clicking any node:
- **Header:** ENS / Address chip with copy action and chain badge.
- **Tags & Metadata:** `{EDGE}-{STYLE} [{SIZE}]`, cluster pill, watch priority.
- **Key Metrics:** First seen date, total transaction count, parked stablecoin balance, current alert state badge.
- **Independence Verdict (FR-3.6):**
  - Displays the exact list of relationships computed by `computeWalletVerdict`:
    - `"Connected to 0x71c...a1b2 via direct transfers (23 txs, $45.2K)"`
    - `"Connected to 0x33b8...aa90 via shared funder Binance 14"`
    - `"Connected to 0x123...4567 via co-entry (3 tokens within 24h)"`
  - For completely unconnected wallets, renders verbatim:
    `"INDEPENDENT — no funding, transfer, or co-entry relationship with any other tracked wallet."`
- **Action Link:** Button navigating to full wallet detail page `/wallets/[chain]/[address]`.

### Edge Breakdown Panel (`EdgeBreakdownPanel`, FR-3.3)
Opened when clicking any edge:
- **Header:** Pair identity (`0x1000...02 ↔ 0x1000...03`) and aggregate summary ($USD volume, total transfer count, first and last transfer date).
- **Per-Token Table:**
  - Token symbol + token contract address.
  - Total USD transferred.
  - Transfer count.
  - Direction breakdown: `A → B ($USD, count)` vs `B → A ($USD, count)`.
  - Sample transaction hashes with external block explorer links (`[↗]`).

---

## 4. PNG Export Specification (FR-3.7)
- Button styled with Signal Amber outline in top toolbar.
- On click, invokes Cytoscape's `cy.png({ full: false, bg: '#101214', scale: 2 })`.
- Preserves the dark theme background (never transparent) at 2x resolution.
- Filename format: `watchtower-graph-YYYY-MM-DD-HHmm.png`.
- Shows brief visual indicator (`EXPORTED`) on completion.
