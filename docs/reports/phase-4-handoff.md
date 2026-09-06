# Watchtower Phase 4 Handoff to Phase 5 Agent

Handoff Date: 2026-09-06  
Source Report: [`docs/reports/phase-4-report.md`](phase-4-report.md)  
Target Phase: **Phase 5 — Self-Tracking & Counter-Surveillance (SRS §3 Module 6 & §8)**

---

## 1. Read First (Mandatory Context)

1. `watchtower-srs.md` — Authoritative requirements: Module 6 (Self-Tracking & Counter-Surveillance, FR-6.1–6.4) and §8 (Phase 5 Acceptance Criteria).
2. `watchtower-implementation-plan.md` — Task contract for Phase 5 (`P5-D01` through `P5-T06`).
3. `docs/reports/phase-4-report.md` — Verified state of the Alert Engine, pure rule engine, and wallet state machine.
4. `docs/design/DESIGN.md` — Approved Observatory visual language and design tokens.
5. `AGENTS.md` — Web3 Full-Stack Agent workflow, safety guardrails, and human approval boundary.

---

## 2. Phase 4 Accomplishments & Established Infrastructure

### Alert Engine & State Machine
- Complete pure rule suite in `src/lib/rules/`:
  - Category A: `a1-stable-arming.ts`, `a2-gas-arming.ts`, `a3-cex-withdrawal.ts`, `a4-dormancy-wake.ts`, `a5-cluster-arming.ts`, `a6-consolidation.ts`.
  - Category T: `t1-armed-entry.ts`, `t2-independent-co-entry.ts`, `t3-fresh-launch.ts`, `t4-add-on-retrace.ts`, `t5-cluster-co-entry.ts`.
  - Category C: `c1-distribution-prep.ts`, `c2-co-distribution.ts`, `c3-moon-discipline.ts`, `c4-campaign-spent.ts`.
  - De-arming logic: `dearm.ts`.
- Pure baseline statistical calculations in `src/server/services/alert/baselines.ts` and `peak.ts`.
- State machine in `src/server/services/alert/state-machine.ts` with strict precedence (`de-arm > TRIGGERED > ARMED > no change`).
- Deduplication and persistence in `src/server/services/alert/persist.ts`.
- Pipeline evaluator (`evaluateAlerts`) in `src/server/services/alert/evaluate.ts` supporting `INCREMENTAL` and `BACKFILL` modes.

### User Interface & Settings
- Alert Center at `/alerts` (`AlertList.tsx`, `AlertFilters.tsx`, `UnreadBadge.tsx`) with dense triage queue, multi-tab state filtering, and slide-out **Evidence Rail** (`EvidenceTooltip.tsx`).
- Alert Settings Console at `/settings` (`ThresholdForm.tsx`, `StableListEditor.tsx`, `CadenceForm.tsx`, `TelegramForm.tsx`, `MaintenancePanel.tsx`).
- Cross-surface `StateBadge` and golden pulsing cluster escalation on `/wallets`, `/graph`, and `/wallets/[chain]/[address]`.

### Verification Suite
- `corepack pnpm typecheck` passing (0 errors).
- `corepack pnpm vitest run` passing (326 tests across 47 suites).
- `corepack pnpm playwright test tests/e2e/phase4.spec.ts` passing (all 6 acceptance criteria verified).

---

## 3. Scope for Phase 5: Self-Tracking & Counter-Surveillance

Phase 5 addresses the user's operational security and risk management by tracking own wallets alongside targets and analyzing the user's onchain footprint.

### Core Modules & Deliverables (Module 6, FR-6.1–6.4)
1. **Self-Wallet Flagging & Visual Inversion (FR-6.1)**:
   - Dedicated `isSelf: true` flag on monitored wallets.
   - Distinctive visual treatment (cyan/amber border distinction, "SELF" chip).
   - Filterable in list and graph views.
2. **Exposure & Linkage Scoring (FR-6.2)**:
   - Calculate graph proximity / hop distance between self-wallets and tracked entities.
   - Flag shared funding sources or direct transfers connecting self-wallets to high-scrutiny targets.
3. **Counter-Surveillance Warnings (FR-6.3)**:
   - Detect if self-wallet actions mimic or trigger target-side surveillance rules (e.g. self-arming, self-co-entry).
   - Warn on potential front-running or copycat tracking exposure.
4. **Self-Tracking Console (`/self`) (FR-6.4)**:
   - Overview of all self-tagged addresses across chains.
   - Aggregate exposure metric, connection tree, and risk audit panel.

---

## 4. Immediate Entry Steps for Phase 5

1. Run Google Stitch design generation for `/self` (`P5-D01`) and obtain design approval.
2. Verify existing database schema support (`Wallet.isSelf` already exists in Prisma schema).
3. Implement graph linkage scoring service (`src/server/services/self/exposureService.ts`).
4. Build `/self` UI components and wire tRPC endpoints.
5. Create Phase 5 acceptance specs (`tests/unit/phase5-acceptance.test.tsx` and `tests/e2e/phase5.spec.ts`).
