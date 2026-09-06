# Watchtower Phase 6 Handoff Document

Date: 2026-09-06  
Author: Senior Full-Stack Engineer  
Current Phase: **Phase 6 — Token Lookup & Grading** (COMPLETED)  
Next Phase Options: **Phase 7 (Solana - Optional)** or **Phase 8 (Documentation & Walkthrough)** (AWAITING HUMAN APPROVAL)

---

## 1. What Was Completed in Phase 6

1. **Stitch Design Gate (P6-D01)**:
   - Screen 1 (`/tokens/[chain]/[address]`): `cda198fa23bd4abf9c241a948985dbcd` (Contract intelligence, SLA duration indicator, holder table with status and auto-grade badges, netflow chart, promoter warnings, cluster alerts).
   - Screen 2 (`/health` & `/settings`): `7e24c4866b9d4d8d808010b79d7a474e` (Backup staleness reminder banner, live quota meters, manual prune utility with typed confirmation, derivation rebuild buttons).
   - Approved design artifacts created under `docs/design/phase-6/`.

2. **Backend Engine & Services (P6-T01 through P6-T04)**:
   - `src/server/services/wallet/grade.ts`: Multi-position auto-grading computation evaluating Win Rate, Realized PnL, Entry-Timing Ratio, and minimum sample gating (< 3 closed positions).
   - `src/server/services/token/red-flags.ts`: Pure heuristic evaluation detecting deployer-to-tracked-wallet transfers (paid-promoter warning), top-10 explorer share, and contract age.
   - `src/lib/chains/etherscan-v2-adapter.ts`: Added `getTokenHolderSummary` for top-10 holder concentration summaries.
   - `src/server/services/token/lookup.ts`: Local-only token intelligence service with factual status derivation (`HOLDING`, `DISTRIBUTED`, `EXITED`), windowed netflow aggregation, and local DB execution timing (< 3s SLA).
   - `src/server/services/maintenance/prune.ts`: Manual prune token history utility strictly enforcing typed confirmation `"PRUNE"` with row counts per table.
   - `src/server/workers/processors/maintenance-prune.ts`: Asynchronous BullMQ processor for large background prune jobs.
   - `scripts/prune-token-history.ts`: CLI utility for manual offline pruning.
   - `src/server/trpc/routers/token.ts`: Endpoints `token.lookup`, `token.redFlags`, and `token.refresh`.
   - `src/server/trpc/routers/maintenance.ts`: Endpoints `maintenance.pruneToken`, `maintenance.backupInfo`, `maintenance.quotaReport`, and `maintenance.rebuildDerivations`.
   - `src/server/trpc/root.ts`: Mounted `token` and `maintenance` routers.

3. **Frontend UI Components & App Pages (P6-T01 through P6-T04)**:
   - `src/components/wallets/GradeCard.tsx`: Dedicated auto-grade card with Win Rate, Realized PnL, Entry-Timing Ratio, and status.
   - `src/app/wallets/[chain]/[address]/page.tsx`: Embedded `GradeCard` with interactive recomputation.
   - `src/components/tokens/TokenLookupForm.tsx`: Search bar with automatic chain selection and contract validation.
   - `src/components/tokens/HolderTable.tsx`: Tracked holder table rendering grades, entry MCs, holding/distributed/exited status, and share of supply.
   - `src/components/tokens/TokenNetflowChart.tsx`: Windowed netflow metrics (24h/7d/30d) and historical inflow/outflow bars.
   - `src/components/tokens/RedFlagList.tsx`: Prominent paid-promoter alert banner, cluster warnings, supply concentration, and token age.
   - `src/app/tokens/page.tsx`: Token search entry route.
   - `src/app/tokens/[chain]/[address]/page.tsx`: Full token intelligence console.
   - `src/components/settings/MaintenancePanel.tsx`: Maintenance & Data Retention console with live quota observability, backup reminder, and prune utility.
   - `src/app/health/HealthConsole.tsx`: Mounted maintenance controls.

4. **Testing & Acceptance Verification (P6-T05)**:
   - Vitest unit suites: `grade.test.ts` (6 tests), `token-red-flags.test.ts` (7 tests), `token-lookup.test.ts` (9 tests), `maintenance.test.ts` (9 tests), `phase6-acceptance.test.tsx` (5 tests) — 36/36 tests passing.
   - Full repository test suite: 62 test files, 413 unit/integration tests passing (0 failures).
   - Playwright E2E acceptance suite: `tests/e2e/phase6.spec.ts` passing all 4 tests in 3.0s.
   - Scenario fixture: `tests/fixtures/scenarios/phase6-bundle.json`.
   - TypeScript compilation: 0 errors (`pnpm typecheck`).

---

## 2. Next Phase Options: Phase 7 vs Phase 8

Per `watchtower-srs.md` (§8, §1 Non-Goals) and `watchtower-implementation-plan.md` (§5 Phase 7 & Phase 8, §0 D-12):

1. **Phase 7 (Optional, Later) — Solana via Helius behind ChainAdapter**:
   - Out of scope for v1 MVP (SRS §1 explicitly marks Solana as non-goal for v1; §8 marks Phase 7 as optional).
   - All chain abstractions are frozen and verified; `ChainAdapter` interface allows adding `SOLANA` additively without refactoring.
2. **Phase 8 (Required for v1 Completion) — Documentation & Walkthrough**:
   - Per §0 D-12: A clean-room walkthrough and comprehensive documentation covering system architecture, decisions, operations, backup/restore, and maintenance.
   - Can run directly after Phase 6 acceptance without requiring Phase 7.

---

## 3. Human Approval Boundary (Operating Rule)

> **STOPPING CONDITION**:
> Per the Operating Rules in `AGENTS.md`:
> - Execute exactly one phase per work cycle.
> - Deliver the full phase, verify with fresh test evidence, report status and traceability, and STOP.
> - Explicit human authorization is required to continue to the next phase.
