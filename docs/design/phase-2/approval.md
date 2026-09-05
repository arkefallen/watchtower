# P2-D01 Approval Record: Phase 2 Stitch Designs

**Status:** `APPROVED`  
**Approval Date:** 2026-09-05  
**Approved by:** Product Owner  
**Stitch Project:** `projects/17665303442847236685`  
**Design System Asset:** `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

---

## Approved Screen References

The following screen design in Google Stitch project `projects/17665303442847236685` is explicitly approved for Phase 2 frontend implementation:

1. **`/graph` (Interaction Graph & Bubble Map)**
   - **Stitch Screen ID:** `22476ea9a4f340ee855b247b5cc6d12a`
   - **Local Assets:** `docs/design/phase-2/assets/graph.png`, `docs/design/phase-2/assets/graph.html`
   - **Approved Features:**
     - Cytoscape force-directed canvas with compound cluster boundaries (e.g. Cluster #04 in dashed amber).
     - Node styling: Alert state border colors (`ARMED` in amber, `TRIGGERED` in red, `IDLE` in muted hairline), fill color = cluster color, size toggle (size tag vs. stable balance).
     - Edge styling: Directional arrows, center pill labels formatted `TICKER · $USD` (e.g. `PEPE · $45.2K`, `USDC · $12.0K`, `ETH · $1.5K`), stroke width proportional to volume.
     - Top toolbar: Timeframe selector (24h, 7d, 30d, all), min USD filter ($100), token filter, node size toggle, secondary node toggles (funders, primary wallets), Fit View, and Export PNG button.
     - Right inspection drawer: Selected node stats (`vitalik.eth`), address chip, cluster tag, and the Independence Verdict Panel (FR-3.6) with explicit connection claims.
     - Edge breakdown drawer / modal: Per-token transfer table with counts, directional splits, and sample transaction explorer links.
     - Bottom-left legend: Border state encoding, size encoding, edge volume weight, and compound cluster key.
