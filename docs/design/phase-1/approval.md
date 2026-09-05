# P1-D01 Approval Record: Phase 1 Stitch Designs

**Status:** `APPROVED`  
**Approval Date:** 2026-09-05  
**Approved by:** Product Owner  
**Stitch Project:** `projects/17665303442847236685`  
**Design System Asset:** `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

---

## Approved Screen References

The following 4 screen designs in Google Stitch project `projects/17665303442847236685` are explicitly approved for Phase 1 frontend implementation:

1. **`/wallets` (Wallet Registry & Bulk Management)**
   - **Stitch Screen ID:** `d43930667c704cba8a170092c86596e0`
   - **Local Assets:** `assets/registry.png`, `assets/registry.html`
   - **Approved Features:** Dense virtualized table (8/10 density), address/ENS search, multi-chain dropdowns, alert badges, cluster color chips, timezone toggle (Local Asia/Jakarta vs UTC vs Block), and bottom-docked floating bulk action bar.

2. **`/wallets/new` (Wallet Intake & Batch CSV Progress)**
   - **Stitch Screen ID:** `28684a82b3344b739b0608500b3d2e20`
   - **Local Assets:** `assets/intake.png`, `assets/intake.html`
   - **Approved Features:** Two-column intake workspace (Single Add with Universal Resolver ENS verification badge; CSV import textarea with syntax error callout; docked BullMQ 14-stage intake pipeline progress monitor).

3. **`/wallets/[chain]/[address]` (Profile Stats, Dual Heatmap, Parking Timeline)**
   - **Stitch Screen ID:** `a4a6c83fb18d4442a7a2740f5b7c28dd`
   - **Local Assets:** `assets/detail.png`, `assets/detail.html`
   - **Approved Features:** Identity header, inline compact tag editor (`SMART`, `RIDER`, `W`, `isSelf`), 6 profile statistics cards, dual-mode 168-cell Activity Heatmap (Habitual Timing vs. Rolling 7-day toggle), and chronological Stablecoin Parking Timeline.

4. **`/wallets/[chain]/[address]/funding` & `/clusters` (Funding Tracer & Clusters)**
   - **Stitch Screen ID:** `dd1d971058614326bf583a87f141482f`
   - **Local Assets:** `assets/funding.png`, `assets/funding.html`
   - **Approved Features:** Hierarchical recursive funding tree, Terminal CEX leaf (`Binance 14 Hot Wallet` in green outline pill), Primary Wallet warning badge with hover tooltip evidence (Conditions A & B), depth-limited node with Deep Trace 6-hop extension progress, internal-tx-only funding node, shared-funder cluster banner, and right evidence & cluster drawer.
