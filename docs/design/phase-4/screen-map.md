# P4-D01 Screen Map: Phase 4 Alert Engine & Settings

Stitch project: `projects/17665303442847236685`  
Design System: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)  
Viewport Contract: Desktop 1440px (Stitch exported reference at 2560×2048 / 3040×2048 canvas scale)

---

## Screen Inventory & State Coverage

| Screen / Route | Device | Required Content & Components | State Coverage & Acceptance Signal | Stitch Screen ID | Local Assets |
|---|---|---|---|---|---|
| **/alerts** (Alert Center) | Desktop 1440px | Reusable 240px Sidebar with unread count badge `[3]`, Top KPI Bar (`Total Active`, `Armed`, `Triggered`, `Exit Risk`), Multi-dimensional Filter Bar (`AlertFilters`), Dense Alert Table (`AlertList`), Evidence Rail / Tooltip Popover (`EvidenceTooltip`), Pagination Footer | **All States (`ALL`, `ARMED`, `TRIGGERED`, `EXIT_RISK`), Rule Category Filter (A1–C4), Unread/Read Status, Evidence Inspection.** Displays chronological alerts with status indicators, token context, amount USD, and expandable evidence showing exact rule logic and tx links. | `c4914942d6f64a10b516c2aa9d84d61f` | [`alerts.png`](assets/alerts.png)<br>[`alerts.html`](assets/alerts.html) |
| **/settings** (Settings Console) | Desktop 1440px | Reusable 240px Sidebar with active state on `Settings`, Top Header with Save button and local DB status, Threshold Cards (`ThresholdForm`), System Cadence Inputs (`CadenceForm`), Telegram Controls (`TelegramForm`), Maintenance & Backup Banner (`MaintenancePanel`) | **Editable Thresholds (A1–C4), Cold-Start Explanation, Graded Definition Toggle, Self-Only Moon Discipline Toggle, Telegram Config, Backup Health & Pruning.** Direct form controls modifying rule thresholds, sync intervals, and manual backup utilities with irreversible-intent copy. | `1965883e606a40f79eae812c05b02490` | [`settings.png`](assets/settings.png)<br>[`settings.html`](assets/settings.html) |

---

## State Matrix (Phase 4 DoD Checklist)

| System State | Visual Treatment & Location | Requirement / SRS § Reference |
|---|---|---|
| **Unread Badge** | Amber counter badge `[3]` next to "Alerts" in the 240px navigation sidebar; updates dynamically without reload. | FR-5.2 |
| **Alert Risk States** | Distinct status indicators and text labels: `ARMED` (Signal Amber `#D7A84B`), `TRIGGERED` (Risk Coral `#D87870`), `EXIT_RISK` (Warning Orange `#E59866`), `IDLE` (Neutral Grey `#929BA3`). Never communicated by color alone. | FR-5.1, NFR-8 |
| **Cluster ARMED Escalation** | Distinct high-priority visual treatment for A5 cluster arming: glowing border, `A5 CLUSTER ARMING [ESCALATED]` badge, shared funder tag. | FR-2.6, A5, §4.8 |
| **Evidence Tooltip / Popover** | Expandable card/popover on any alert showing: (1) Rule ID & full title, (2) Exact rule logic, (3) Thresholds & binding arm, (4) Observed amounts & timestamps, (5) Window range, (6) Clickable block explorer transaction links `[↗]`. | FR-5.5, SRS §10.6 |
| **Malformed Evidence State** | If an evidence JSON blob is incomplete or invalid, renders explicit error state: `⚠️ MALFORMED EVIDENCE TRAIL: missing ruleText / txLinks` instead of blank UI. | P4-T09, DoD |
| **A2 Floor & Cold-Start Explanations** | Settings card for A2 displays floor `$100` alongside `3x median single-day inflow`, with explicit cold-start copy: *"Cold-start rule: floor-only ($100) binds until 7 qualifying daily flow days exist."* | Decision D-4, §4.8 |
| **Graded Definition Control** | Select dropdown in Settings with options: `ANY_TAG_OR_COMPUTED` (default: any edge/style/size tag or sufficient auto-grade) vs `EDGE_TAG_ONLY` (manual edge tag required). | Decision D-5, §4.8 |
| **C3 Scope Control** | Toggle in Settings for `c3SelfOnly` (default false): monitors all tracked wallets with prominent styling on `isSelf` trades, or filters exclusively to self-registered positions. | Decision D-7, §4.8 |
| **Optional Telegram Delivery** | Toggle, Bot Token, Chat ID fields, and interactive `Send Test Message` button with live feedback (`● TEST MESSAGE DELIVERED` / error string). | FR-5.3, NFR-1 |
| **Backup Staleness Banner** | Status card in Settings: `● BACKUP HEALTHY — Last backup: 2 days ago`. Triggers warning treatment when older than 7 days. | Decision D-10, NFR-6 |
| **Prune Token History Utility** | Maintenance action card with prominent `Irreversible Action` confirmation dialog requiring typing `PRUNE` before executing. | NFR-5 |
