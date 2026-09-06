# Watchtower Phase 5 Handoff Document

Date: 2026-09-06  
Author: Senior Full-Stack Engineer  
Current Phase: **Phase 5 — Self-Tracking (Edge Rider)** (COMPLETED)  
Next Phase: **Phase 6 — Token Lookup & Grading** (AWAITING HUMAN APPROVAL)

---

## 1. What Was Completed in Phase 5

1. **Stitch Design Gate (P5-D01)**:
   - Screen 1 (`/self`): `92a397724bcc442f89b15538087f50d1` (Identity registration, KPIs, Edge Decay visualizer, PnL breakdown tabs, Execution comparison table).
   - Screen 2 (`/self/trades`): `9adbcafa7a8b42318532575a14e869a3` (Manual trade log with required narrative thesis input, pinned attribution toggle, audit log).
   - Approved design artifacts created under `docs/design/phase-5/`.

2. **Backend Engine & Services (P5-T01 through P5-T06)**:
   - `src/server/services/wallet/self.ts`: Self wallet registration and status retrieval.
   - `src/server/services/radar/group.ts` & `movement/breadth.ts`: Enforced strict `isSelf` exclusion from co-accumulation groups, followed-wallet candidate pools, and breadth denominators.
   - `src/server/services/self/roi.ts`: Lag bucket derivation (`0-1h`, `1-6h`, `6-24h`, `>24h`) and token ROI computation.
   - `src/server/services/self/link.ts`: Signal auto-linking algorithm (§4.10) with lookback, graded wallet qualification, deterministic tie-breaking, and pinned link preservation.
   - `src/server/workers/processors/self-link.ts`: BullMQ worker job for asynchronous signal attribution.
   - `src/server/services/self/trades.ts`: Server-side Zod validation rejecting empty or whitespace thesis for manual trades.
   - `src/server/services/self/decay.ts`: Decay analytics across 4 latency buckets with low-sample safeguards.
   - `src/server/services/self/dashboard.ts`: Performance aggregation isolating realized from unrealized PnL.
   - `src/server/services/self/comparison.ts`: Execution comparison view with CAPTURED / DECAYED verdicts.
   - `src/server/trpc/routers/self.ts`: Mounted on root router as `trpc.self.*`.

3. **Frontend UI (P5-D01 through P5-T06)**:
   - `src/app/self/page.tsx`: Self-Tracking console with KPIs, modal, decay curve, PnL breakdown, and comparison table.
   - `src/app/self/trades/page.tsx`: Manual trade log with strict thesis validation.
   - `src/components/self/EdgeDecayChart.tsx`: Observatory SVG line chart + accessible table.
   - `src/components/self/PnlBreakdown.tsx`: Multi-dimensional tabbed breakdowns.
   - `src/components/self/ComparisonTable.tsx`: Execution comparison audit with verdict badges.
   - `src/components/self/TradeLogForm.tsx`: Manual trade submission form.
   - `src/components/wallets/SelfWalletCard.tsx`: Registered self wallets section on `/wallets`.

4. **Testing & Acceptance Verification (P5-T07)**:
   - 7 unit test suites with 48 tests passing (`self-wallet`, `self-link`, `manual-trade`, `edge-decay`, `self-dashboard`, `self-comparison`, `phase5-acceptance`).
   - Playwright acceptance suite `tests/e2e/phase5.spec.ts` passing all 5 tests.
   - Scenario fixture: `tests/fixtures/scenarios/phase5-bundle.json`.
   - Full repository test baseline: 57 test suites, 377 unit/integration tests passing with 0 failures.
   - TypeScript compilation: 0 errors (`pnpm typecheck`).

---

## 2. Next Phase Requirements: Phase 6 (Token Lookup & Grading)

Per `watchtower-srs.md` (§3 Module 7, §8 Acceptance) and `watchtower-implementation-plan.md` (§5 Phase 6):
- **Scope**:
  - `FR-7.1`: Paste any token address + chain $\rightarrow$ panel displays tracked-wallet holders (with grades, entry MCs, holding vs distributed status), netflow history of tracked wallets on the token, cluster presence warnings, and red flags (deployer-to-wallet transfers = paid-promoter warning, top-10 supply concentration).
  - `FR-7.2`: Automated red-flag checks (deployer $\rightarrow$ wallet transfers, % supply held by top 10 holders from explorer data, token age).
  - Automated grading computation for tracked wallets: Win Rate, Realized PnL, Entry-timing ratio on wallet profiles.
  - **Acceptance Gate**: Paste a token $\rightarrow$ holders/netflow/red-flag panel renders in $< 3\text{s}$ from local database.
- **Tasks Sequence**:
  - `P6-D01`: Stitch design for token lookup, grading blocks, and maintenance surfaces.
  - `P6-T01`–`P6-T07`: Token detail service, red-flag heuristics, auto-grader, token lookup UI, and acceptance specs.

---

## 3. Human Approval Boundary (Operating Rule)

> **STOPPING CONDITION**:
> Per the Operating Rules in `AGENTS.md` and the initial mandate:
> - Execute exactly one phase per work cycle.
> - Deliver the full phase, verify with fresh test evidence, report status and traceability, and STOP.
> - Explicit human authorization is required before beginning **Phase 6**.
