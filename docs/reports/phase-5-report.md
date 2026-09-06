# Watchtower Phase 5 Result & Acceptance Report

Status: **PHASE 5 COMPLETE — DELIVERED & VERIFIED**  
Report Date: 2026-09-06  
Scope: Phase 5 ("Self-Tracking" / "Edge Rider")  
Authoritative Sources: `watchtower-srs.md` (§3 Module 6, §8 Phase 5 Acceptance), `watchtower-implementation-plan.md` (Tasks `P5-D01` through `P5-T07`)

---

## 1. Executive Summary & Outcome

Phase 5 delivers **Self-Tracking (Edge Rider)** (Module 6) for Watchtower. The module empowers the operator to track and benchmark their own execution against the smart money signals discovered across the system. It isolates self-wallets from influencing market intelligence, auto-links user executions to preceding graded signals with deterministic tie-breaking, measures latency degradation via the Edge Decay curve, and answers the core edge hypothesis: *"When I follow within 1 hour, do I actually capture the edge?"*

### Key Capabilities Delivered:

1. **Self-Wallet Identity & Ingestion Isolation (FR-6.1, P5-T01)**:
   - Self-wallets are registered with `isSelf: true` via `/self` modal and registry.
   - Ingested through the identical transactional pipeline as external wallets.
   - Strictly excluded from watchlist-signal roles: never counted as participants in co-accumulation or co-distribution groups, never suggested as followed wallets, and excluded from breadth denominators.

2. **Automated Signal Attribution & Lag Measurement (FR-6.2, P5-T02)**:
   - `linkTradeToSignal` evaluates preceding entries within lookback window.
   - Enforces `gradedDefinition` setting (`ANY_TAG_OR_COMPUTED` or `EDGE_TAG_ONLY`).
   - Deterministic tie-breaking: highest watch priority $\rightarrow$ largest USD volume $\rightarrow$ lowest address hash.
   - Stores `followedWalletAddress`, `lagMinutes` ($T_{\text{user}} - T_{\text{wallet}}$), `lagBucket` (`0-1h`, `1-6h`, `6-24h`, `>24h`), `lagMcDelta` ($\text{MC}_{\text{user}} - \text{MC}_{\text{wallet}}$), `walletRoiPct`, and `userRoiPct`.
   - BullMQ worker processor `self-link.ts` processes `self.link.trades` asynchronously on trade events.

3. **Manual Trade Log with Thesis Enforcement (FR-6.3, P5-T03)**:
   - `/self/trades` console for manual trade entry and retrospective logging.
   - Strict server-side Zod validation rejects empty or whitespace-only narrative theses.
   - Optional followed wallet selection sets `isLinkPinned: true`, permanently protecting the attribution from automated overwrites.

4. **Edge Decay Analytics & Observatory Visualizer (FR-6.4, P5-T04)**:
   - `computeEdgeDecay` calculates sample size, user average ROI, wallet average ROI, and win rate across the 4 canonical latency buckets.
   - Low-sample safeguard: explicitly flags `insufficientSample: true` when sample size $< 5$, preventing misleading extrapolation.
   - Empty buckets render empty (`null`), never defaulting to misleading $0\%$.
   - Observatory SVG decay curve renders side-by-side with accessible, structured data table highlighting the **Golden Capture Zone (0-1h)**.

5. **Personal Performance Console & Breakdowns (FR-6.5, P5-T05)**:
   - Realized PnL strictly sums closed executions; open positions are isolated as unrealized PnL.
   - Win Rate reflects profitable closed executions over total closed trades.
   - Multi-dimensional breakdown tabs:
     - **By Followed Wallet**: isolates profitability and average follow latency per smart wallet.
     - **By Token**: aggregates realized performance across specific assets.
     - **By Lag Bucket**: mirrors decay curve data directly in the dashboard.

6. **Edge Capture Execution Comparison (FR-6.6, P5-T06)**:
   - Side-by-side execution audit comparing user ROI against wallet ROI for each linked trade.
   - Deterministic verdicts:
     - `● CAPTURED` (Gold): User ROI $\ge$ Followed Wallet ROI.
     - `○ DECAYED` (Crimson): User ROI $<$ Followed Wallet ROI.
     - `—` (Em dash): When wallet ROI is unknown or pending realization.

---

## 2. Dual Traceability Matrix

### A. Module 6 Functional Requirements Traceability

| Requirement | Description | Implementation Files | Status |
|---|---|---|---|
| **FR-6.1** | Register own wallet(s) with `is-self` flag; ingested through identical pipeline; excluded from signal roles | `src/server/services/wallet/self.ts`, `src/server/services/radar/group.ts`, `src/server/services/movement/breadth.ts`, `src/components/wallets/SelfWalletCard.tsx` | **PASS** |
| **FR-6.2** | Auto-link user trades to nearest preceding graded entry; store followed wallet, lag minutes, lag bucket, lag MC delta, wallet ROI, user ROI | `src/server/services/self/link.ts`, `src/server/services/self/roi.ts`, `src/server/workers/processors/self-link.ts` | **PASS** |
| **FR-6.3** | Manual trade log requiring thesis free-text; optional followed wallet with pinned link preservation | `src/server/services/self/trades.ts`, `src/components/self/TradeLogForm.tsx`, `src/app/self/trades/page.tsx` | **PASS** |
| **FR-6.4** | Edge decay curve per followed wallet; table and SVG line chart across 0-1h, 1-6h, 6-24h, >24h; low-sample warning | `src/server/services/self/decay.ts`, `src/components/self/EdgeDecayChart.tsx`, `src/app/self/page.tsx` | **PASS** |
| **FR-6.5** | Personal dashboard: win rate, total realized PnL, unrealized PnL, PnL by wallet, by token, and by lag bucket | `src/server/services/self/dashboard.ts`, `src/components/self/PnlBreakdown.tsx`, `src/app/self/page.tsx` | **PASS** |
| **FR-6.6** | Comparison view: user ROI vs followed wallet ROI per linked trade with CAPTURED / DECAYED verdicts and em dash fallback | `src/server/services/self/comparison.ts`, `src/components/self/ComparisonTable.tsx`, `src/server/trpc/routers/self.ts` | **PASS** |

### B. Phase 5 Task Execution Contract (`P5-D01` through `P5-T07`)

| Task ID | Task Description | Deliverables & Artifacts | Status |
|---|---|---|---|
| **P5-D01** | Stitch Design System & UX Spec for `/self` and `/self/trades` | Stitch screens (`92a397724bcc442f89b15538087f50d1`, `9adbcafa7a8b42318532575a14e869a3`), `docs/design/phase-5/` | **COMPLETE** |
| **P5-T01** | Self Wallet Registration & Ingestion Isolation | `src/server/services/wallet/self.ts`, `src/server/services/radar/group.ts`, `src/server/services/movement/breadth.ts`, `tests/unit/self-wallet.test.ts` | **COMPLETE** |
| **P5-T02** | Auto-Link Trades to Watchlist Signals | `src/server/services/self/link.ts`, `src/server/services/self/roi.ts`, `src/server/workers/processors/self-link.ts`, `tests/unit/self-link.test.ts` | **COMPLETE** |
| **P5-T03** | Manual Trade Log with Required Thesis | `src/server/services/self/trades.ts`, `src/components/self/TradeLogForm.tsx`, `src/app/self/trades/page.tsx`, `tests/unit/manual-trade.test.ts` | **COMPLETE** |
| **P5-T04** | Edge Decay Curve | `src/server/services/self/decay.ts`, `src/components/self/EdgeDecayChart.tsx`, `src/app/self/page.tsx`, `tests/unit/edge-decay.test.ts` | **COMPLETE** |
| **P5-T05** | Personal Dashboard & PnL Breakdowns | `src/server/services/self/dashboard.ts`, `src/components/self/PnlBreakdown.tsx`, `src/app/self/page.tsx`, `tests/unit/self-dashboard.test.ts` | **COMPLETE** |
| **P5-T06** | Execution Comparison View | `src/server/services/self/comparison.ts`, `src/components/self/ComparisonTable.tsx`, `src/server/trpc/routers/self.ts`, `tests/unit/self-comparison.test.ts` | **COMPLETE** |
| **P5-T07** | Phase 5 Acceptance Specs & Fixtures | `tests/unit/phase5-acceptance.test.tsx`, `tests/e2e/phase5.spec.ts`, `tests/fixtures/scenarios/phase5-bundle.json` | **COMPLETE** |

---

## 3. SRS §8 Phase 5 Acceptance Criteria Verification Evidence

| # | Acceptance Criterion | Verification Method | Result | Evidence |
|---|---|---|---|---|
| **1** | **Register self wallet $\rightarrow$ auto-linked trades with lag data** | Vitest Acceptance & Playwright E2E | **PASS** | `phase5: self wallet registration ingests trades` and `phase5: trades are auto-linked with lag data` pass. Registering a wallet flags `isSelf: true`, auto-link attributes the preceding graded signal, and records `lagMinutes: 60`, `lagBucket: 1-6h`, `lagMcDelta`, `walletRoiPct`, and `userRoiPct`. |
| **2** | **Edge decay curve renders for a followed wallet with $\ge 5$ linked trades** | Vitest Acceptance & Playwright E2E | **PASS** | `phase5: decay curve renders with ≥5 linked trades` passes. For 6 linked trades, renders all 4 latency buckets (`0-1h`, `1-6h`, `6-24h`, `>24h`) with user ROI, wallet ROI, and win rate. Golden Capture Zone (`★ 0-1H CAPTURE ZONE`) is highlighted; low-sample warning suppressed when $\ge 5$. |

---

## 4. Test Suite Execution & Quality Evidence

```text
> pnpm typecheck
  ✓ tsc --noEmit (0 TypeScript errors)

> pnpm vitest run tests/unit/self* tests/unit/manual* tests/unit/edge* tests/unit/phase5*
  ✓ tests/unit/self-wallet.test.ts (5 tests)
  ✓ tests/unit/self-link.test.ts (13 tests)
  ✓ tests/unit/manual-trade.test.ts (6 tests)
  ✓ tests/unit/edge-decay.test.ts (7 tests)
  ✓ tests/unit/self-dashboard.test.ts (7 tests)
  ✓ tests/unit/self-comparison.test.ts (5 tests)
  ✓ tests/unit/phase5-acceptance.test.tsx (5 tests)
  TOTAL: 48 passed, 0 failures

> pnpm vitest run
  ✓ 57 test suites passed (377 tests passed, 0 failures)

> pnpm playwright test tests/e2e/phase5.spec.ts
  ✓ phase5: self wallet registration ingests trades (1.5s)
  ✓ phase5: trades are auto-linked with lag data (1.6s)
  ✓ phase5: decay curve renders with ≥5 linked trades (1.4s)
  ✓ phase5: dashboard shows win rate and PnL (1.4s)
  ✓ phase5: comparison view lists user vs wallet ROI (1.3s)
  TOTAL: 5 passed (3.3s)
```

---

## 5. Security & Invariant Audit

- **Untrusted Inputs**: Addresses and numbers validated at API boundaries via Zod schemas (`ManualTradeSchema`, `UpdateTradeSchema`).
- **No Private Keys / Telemetry**: Purely public onchain surveillance; no signing keys requested, stored, or processed.
- **Independence & Ingestion Integrity**: Self wallets strictly excluded from co-accumulation groups, radar alerts, and breadth metrics to prevent self-fulfilling signals.
- **Additive Database Posture**: All columns (`isSelf`, `followedWalletAddress`, `lagMinutes`, `thesis`, `isLinkPinned`) adhere strictly to the non-destructive schema design.
