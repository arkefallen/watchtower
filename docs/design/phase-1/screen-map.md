# P1-D01 Screen Map

Stitch project: `projects/17665303442847236685`
Design System: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)
Viewport Contract: Desktop 1440px (Stitch exported references at 2560×2048 / 3040×2048 canvas scale)

---

## Screen Inventory & State Coverage

| Screen / Route | Device | Required Content & Components | State Coverage & Acceptance Signal | Stitch Screen ID | Local Assets |
|---|---|---|---|---|---|
| **`/wallets`** (Wallet Registry) | Desktop 1440px | Dense virtualized data table (`WalletTable`), filter bar (`WalletFilters`), floating bulk action bar (`BulkActionBar`), status badges (`StateBadge`), cluster color chips, timezone toggle | **Normal, Filtered, Selected, Empty, Loading.** Multi-chain filters, 0x/ENS search, checkbox selection, bulk actions docked bar, local Asia/Jakarta vs UTC toggle. Empty state: *"No wallets yet — import a CSV"*. | `d43930667c704cba8a170092c86596e0` | `assets/registry.png`<br>`assets/registry.html` |
| **`/wallets/new`** (Wallet Intake) | Desktop 1440px | Single Add Form with live Universal Resolver ENS check, Batch CSV import textarea with syntax validator, docked BullMQ 14-stage intake pipeline monitor (`JobProgress`) | **Normal, Error Callout, Progress.** Resolves `vitalik.eth` to 0x address. Flags line-by-line CSV errors (e.g. line 3 invalid hex length). Shows live 68% progress across 14-stage intake (`trace:funding`). Non-blocking UI. | `28684a82b3344b739b0608500b3d2e20` | `assets/intake.png`<br>`assets/intake.html` |
| **`/wallets/[chain]/[address]`** (Profile & Stats) | Desktop 1440px | Header with ENS/address/badges, Tag Editor (`TagEditor`, `LabelPreview`), 6 Profile Stats cards, Activity Heatmap (`ActivityHeatmap`), Parking Timeline (`ParkingTimeline`) | **Normal, Habitual vs. Recent Toggle, Degraded/Dormant.** Dual heatmap modes (168 cells, full history vs. rolling 7-day). Parking inflow/outflow timeline with CEX counterparty entity tags. Tag editing with `{EDGE}-{STYLE} [{SIZE}]`. | `a4a6c83fb18d4442a7a2740f5b7c28dd` | `assets/detail.png`<br>`assets/detail.html` |
| **`/wallets/[chain]/[address]` (Funding) & `/clusters`** | Desktop 1440px | Recursive Funding Tree (`FundingTree`, `FundingNode`), Terminal CEX leaf, Primary Wallet warning badge (`PrimaryWalletBadge`), Deep Trace button (`DeepTraceButton`), Cluster Banner & Evidence Drawer | **Multi-hop Tree, Terminal Leaf, Primary Warning, Depth-Limited, Shared Funder.** Binance hot wallet as terminal leaf. 0x33b8 labeled `PRIMARY WALLET` with tooltip evidence (Condition A: 4 fundings, Condition B: 31.4% return). `DEPTH_LIMIT` node with inline Deep Trace 6-hop progress. Shared funder auto-cluster banner (`Cluster #04`). Custom entity label override. | `dd1d971058614326bf583a87f141482f` | `assets/funding.png`<br>`assets/funding.html` |

---

## State Matrix (Phase 1 DoD Checklist)

| System State | Visual Treatment & Location | Requirement / SRS § Reference |
|---|---|---|
| **Normal / Synced** | Dense table rows with `● SYNCED` in Verified Green (`#79B79A`) | FR-1.7, NFR-8 |
| **Loading / Syncing** | Inline table row with `● RUNNING 65%` and hairline progress bar; docked BullMQ monitor | NFR-2, NFR-7 |
| **Empty Registry** | Preserves table frame with centered empty state message: *"No wallets tracked yet — import a CSV or add an address above"* | SRS §7 UI Inventory |
| **Invalid CSV Lines** | Risk Red (`#D87870`) alert callout directly above textarea naming line number and specific syntax defect (e.g. *"Line 3: Invalid hex address length (expected 42 chars, got 21) — will be skipped"*) | FR-1.1, FR-1.8 |
| **Terminal Entity Leaf** | Terminal entity node styled with Verified Green outline pill `[TERMINAL ENTITY: CEX]`, named label (e.g. `Binance 14`), and explicit stop reason: *"TERMINAL_ENTITY — Cease upstream recursion"*. No further hops or adapter calls. | FR-2.2, FR-2.3 |
| **Primary Wallet Warning** | Signal Amber solid badge `[⚠️ PRIMARY WALLET]` on funder node, with hover tooltip detailing Condition A (count ≥ 2) and Condition B (outflow ratio ≥ 20.0%) and exact observed values | FR-2.4, SRS §10.6 |
| **Depth-Limited Branch** | Muted text pill `[DEPTH LIMIT (Depth 3/3 reached)]` with Signal Amber outline button `[+ Deep Trace (Extend to 6 Hops)]`. On click, button transitions inline to active progress without page reload. | FR-2.7 |
| **Contract Internal Only Funder** | Tag `[INTERNAL TX ONLY]` on funding node, proving internal trace ingestion for contract gas funding | FR-2.1, SRS §10.4 |
| **Unknown USD / Price** | Displays em-dash `—` in Geist Mono with hover tooltip explaining source status (`usdSource: UNKNOWN`); never renders fabricated `0` | SRS §10.3, Risk R2 |
| **Shared-Funder Auto Cluster** | Top banner in Signal Amber announcing shared funder and auto-created cluster; right evidence drawer displays cluster member list, combined stable balance, and deterministic cluster color chip | FR-2.6 |
