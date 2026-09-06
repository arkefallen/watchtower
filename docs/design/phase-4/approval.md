# Phase 4 Stitch UI Design Gate Approval

Status: **APPROVED BY USER**  
Date: 2026-09-06  
Phase: **Phase 4 — Alert Engine & Wallet State Machine**  
Task ID: `P4-D01`  
Stitch Project: `projects/17665303442847236685`  
Design System: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

---

## Screen Review Artifacts

| Route | Title | Stitch Screen ID | Local Assets |
|---|---|---|---|
| `/alerts` | Watchtower Alert Center | `c4914942d6f64a10b516c2aa9d84d61f` | [`alerts.png`](assets/alerts.png)<br>[`alerts.html`](assets/alerts.html) |
| `/settings` | Watchtower Settings Console | `1965883e606a40f79eae812c05b02490` | [`settings.png`](assets/settings.png)<br>[`settings.html`](assets/settings.html) |

---

## Design Checklist & Compliance Verification

- [x] **Theme Consistency:** Built with the approved Observatory tokens (Canvas `#101214`, Surface `#171A1D`, Raised Slate `#1E2327`, Hairline Border `#30373D`, Signal Amber `#D7A84B`, 0px sharp corners).
- [x] **Shared Chrome:** Uses standard 240px navigation sidebar with active indicator and live unread counter badge `[3]`.
- [x] **Alert Center (FR-5.1, FR-5.2):** Multi-dimensional filters (state, rule category, wallet, token, unread), dense table (density 8/10), cursor pagination (50 rows), acknowledge / mark-read actions.
- [x] **Evidence Tooltip / Popover (FR-5.5, SRS §10.6):** Popover displays exact rule logic, configured thresholds vs binding arm, observed values, time windows, cluster context, and clickable block explorer tx links.
- [x] **Degraded & Malformed Evidence Handling:** Explicit visual error state for malformed evidence trails; null USD values never trip threshold comparisons.
- [x] **State Badge Continuity (FR-5.1, FR-3.5):** Clear visual distinction between `IDLE`, `ARMED` (Signal Amber), `TRIGGERED` (Risk Coral), and `EXIT_RISK` (Warning Orange) states across list, graph, and detail. High-priority escalated badge for A5 cluster arming.
- [x] **Settings Console (SRS §9, FR-5.4):** Forms for all A1–A6, T1–T5, and C1–C4 rules; A2 $100 floor and cold-start notice (Decision D-4); Graded definition dropdown (`ANY_TAG_OR_COMPUTED` vs `EDGE_TAG_ONLY`, Decision D-5); `c3SelfOnly` toggle with prominent `isSelf` treatment (Decision D-7); de-arm parameters.
- [x] **Optional Telegram Delivery (FR-5.3, NFR-1):** Clean toggle, secure credential inputs, and inline "Send Test Message" utility with live API status.
- [x] **Maintenance & Backup Staleness (NFR-5, NFR-6, Decision D-10):** Status-aware backup banner (>7d warning) and irreversible confirmation copy for token pruning.
- [x] **Accessibility & Non-Color Encoding:** All alert states and risks combine text labels, distinct shapes, and icons alongside color; contrast ratio exceeds 13:1.

---

## Sign-off Record

- **User Approval:** Granted on 2026-09-06. Approved to implement both UI screens (Alerts and Alert Settings) and execute backend & state machine.
