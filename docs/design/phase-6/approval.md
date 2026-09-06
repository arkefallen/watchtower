# Phase 6 Stitch UI Design Gate Approval

Status: **APPROVED FOR BUILD**  
Date: 2026-09-06  
Phase: **Phase 6 — Token Lookup & Grading**  
Task ID: `P6-D01`  
Stitch Project: `projects/17665303442847236685`  
Design System: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

---

## Screen Review Artifacts

| Route | Title | Stitch Screen ID | Screen Description |
|---|---|---|---|
| `/tokens/[chain]/[address]` | Watchtower Token Intelligence: $PEPE | `cda198fa23bd4abf9c241a948985dbcd` | Token summary, Tracked Holders with status (HOLDING/DISTRIBUTED/EXITED) and grades, Netflow chart, Red Flags (Paid Promoter, Explorer Top 10, Cluster alerts), Tracked Supply Concentration |
| `/health` & `/settings` | Watchtower Operations & Maintenance Console | `7e24c4866b9d4d8d808010b79d7a474e` | Non-blocking backup staleness banner, Provider quota table with remaining calls and rate limits, Prune Token History with 'PRUNE' confirmation and per-table audit counts, Rebuild Derivations actions |

---

## Design Checklist & Compliance Verification

- [x] **Theme Consistency:** Built with Observatory tokens (Canvas `#101214`, Surface `#171A1D`, Raised Slate `#1E2327`, Hairline Border `#30373D`, Signal Amber `#D7A84B`, 0px sharp corners).
- [x] **Shared Chrome:** Standard 240px navigation sidebar with active indicator on Tokens / Health.
- [x] **Token Lookup SLA (SRS §8 Acceptance, FR-7.1):** Local DB reads render within 3s without external blocking requests.
- [x] **Holder Status Breakdown (FR-7.1):** Explicit states for `HOLDING` (emerald), `DISTRIBUTED` (amber), and `EXITED` (crimson).
- [x] **Red-Flag Forensics (FR-7.2):** Paid-promoter warning highlights deployer-to-wallet transfers with tx hash link; top-10 concentration explicitly flags unavailable explorer data.
- [x] **Auto-Grade Card (FR-1.4):** Displays Win Rate, Realized PnL, Entry-Timing Ratio; low sample (< 3 closed positions) is explicitly flagged as unavailable.
- [x] **Safe Pruning (NFR-5, P6-T04):** Requires explicit typing of `"PRUNE"` before deletion; per-table deletion counts reported; no automated data deletion.
- [x] **Backup Reminder (NFR-6):** Non-blocking notification if newest backup is older than 7 days or missing.
