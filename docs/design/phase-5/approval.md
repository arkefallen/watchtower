# Phase 5 Stitch UI Design Gate Approval

Status: **APPROVED FOR BUILD**  
Date: 2026-09-06  
Phase: **Phase 5 — Self-Tracking (Edge Rider)**  
Task ID: `P5-D01`  
Stitch Project: `projects/17665303442847236685`  
Design System: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

---

## Screen Review Artifacts

| Route | Title | Stitch Screen ID | Screen Description |
|---|---|---|---|
| `/self` | Watchtower Self-Tracking Dashboard | `92a397724bcc442f89b15538087f50d1` | Top KPIs, Edge Decay Curve & Table (0-1h Golden Zone), PnL Breakdown, Comparison Table |
| `/self/trades` | Watchtower Manual Trade Log & Thesis Form | `9adbcafa7a8b42318532575a14e869a3` | Form with mandatory thesis validation, followed wallet pinning, and recent manual trades log |

---

## Design Checklist & Compliance Verification

- [x] **Theme Consistency:** Built with the approved Observatory tokens (Canvas `#101214`, Surface `#171A1D`, Raised Slate `#1E2327`, Hairline Border `#30373D`, Signal Amber `#D7A84B`, 0px sharp corners).
- [x] **Shared Chrome:** Uses standard 240px navigation sidebar with active indicator on `Self-tracking`.
- [x] **Edge Decay Curve (FR-6.4):** Dual representation with accessible table and Recharts visual curve. Exact bucket boundaries `0-1h`, `1-6h`, `6-24h`, `>24h`. Clear notice for insufficient sample sizes (< 5 trades).
- [x] **Mandatory Thesis (FR-6.3):** Clear visual error states on empty submission; server-side enforcement mirrored in form styling.
- [x] **Personal Dashboard (FR-6.5):** Tabular breakdowns by followed wallet, token, and lag bucket; open positions excluded from realized PnL.
- [x] **Comparison View (FR-6.6):** Clear side-by-side ROI comparison with deterministic CAPTURED vs DECAYED verdict, and neutral `—` state for unknown followed wallet ROI.
- [x] **Accessibility:** All tables use accessible headers and non-color text indicators alongside status dots.
