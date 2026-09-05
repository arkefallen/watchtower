# P2-D01 Screen Map: Phase 2 Interaction Graph

Stitch project: `projects/17665303442847236685`
Design System: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)
Viewport Contract: Desktop 1440px (Stitch exported reference at 2560×2048 canvas scale)

---

## Screen Inventory & State Coverage

| Screen / Route | Device | Required Content & Components | State Coverage & Acceptance Signal | Stitch Screen ID | Local Assets |
|---|---|---|---|---|---|
| **`/graph`** (Interaction Graph) | Desktop 1440px | Cytoscape Force-Directed Bubble Map (`GraphCanvas`), Compound Cluster boxes, Filter Toolbar (`GraphFilters`), Edge Breakdown Panel (`EdgeBreakdownPanel`), Node Side Panel (`NodeSidePanel`), Independence Verdict Panel (`IndependenceVerdict`), Legend (`GraphLegend`), PNG Export (`PngExportButton`) | **Normal, Clustered, Filtered, Selected Node, Selected Edge, Empty, Loading.** Displays imported wallet nodes, compound clusters grouping members, edge labels formatted `TICKER · $USD`, directional arrows, click opens edge token breakdown, node click opens profile stats and Independence Verdict statements. | `22476ea9a4f340ee855b247b5cc6d12a` | `assets/graph.png`<br>`assets/graph.html` |

---

## State Matrix (Phase 2 DoD Checklist)

| System State | Visual Treatment & Location | Requirement / SRS § Reference |
|---|---|---|
| **Normal / Synced Graph** | Full-screen interactive force-directed canvas with sharp 0px chrome, node drag, pan/zoom, fit view | FR-3.1, FR-3.7, NFR-7, NFR-8 |
| **Edge Labeling** | Directional arrows with center pill label formatted exactly as `TICKER · $USD` (e.g. `PEPE · $45.2K`, `ETH · $1.5K`) in Geist Mono. Edge width scales with USD volume. | FR-3.2, FR-3.3 |
| **Edge Breakdown** | Click/hover on edge opens slide-out drawer or popover listing every token transferred on that edge, tx counts, direction split (A→B vs B→A), date range, and working explorer tx links. | FR-3.3, FR-4.8 |
| **Node Alert State Border** | Node border color indicates alert state: `IDLE` (Muted `#30373D`), `ARMED` (Signal Amber `#D7A84B`), `TRIGGERED` (Risk Red `#D87870` with pulse). | FR-3.5, FR-5.1 |
| **Node Size Scaling** | Toggle between: (1) `size` tag (W = 48px, M = 36px, S = 24px) and (2) current stablecoin balance (monotonically scaled). | FR-3.5 |
| **Cluster Compounds** | Tracked wallets sharing a cluster are grouped inside a compound parent container with dashed cluster border and cluster color fill. | FR-3.5, FR-3.7 |
| **Secondary Nodes Toggle** | Toggleable funder nodes, primary wallet nodes, and cluster-mates with distinct visual treatment (e.g. diamond or hexagon shapes). | FR-3.1 |
| **Independence Verdict Panel** | Side panel section for selected wallet listing explicit connection claims: `"Connected to X via shared funder..."`, `"Connected to Y via direct transfers..."`, `"Connected to Z via co-entry..."` or the verbatim line: `"INDEPENDENT — no funding, transfer, or co-entry relationship with any other tracked wallet."` | FR-3.6, SRS §10.7 |
| **PNG Export** | Button generates non-empty PNG download with dark background (`#101214`) and timestamped filename (`watchtower-graph-YYYY-MM-DD-HHmm.png`). | FR-3.7 |
| **Empty Graph State** | Preserves canvas frame with centered dark card: *"No interaction edges found for the active filters"* with a button to reset filters. | SRS §7 UI Inventory |
| **Performance Gate** | Pan/zoom sustains >30 fps with 300 nodes and 1,000 edges using Cytoscape optimizations (`hideEdgesOnViewport`, `textureOnViewport`). | NFR-7 |
