# Watchtower Phase 6 Result & Acceptance Report

Status: **PHASE 6 COMPLETE — DELIVERED & VERIFIED**  
Report Date: 2026-09-06  
Scope: Phase 6 ("Token Lookup & Grading")  
Authoritative Sources: `watchtower-srs.md` (§3 Module 7, §8 Phase 6 Acceptance), `watchtower-implementation-plan.md` (§5 Phase 6, Tasks `P6-D01` through `P6-T05`)

---

## 1. Executive Summary & Outcome

Phase 6 delivers **Token Lookup & Grading** (Module 7) for Watchtower. The module equips the operator with instantaneous contract-level intelligence: pasting any token contract address and selecting a chain immediately projects the local intelligence repository against the token. Without making any blocking external network calls, the console exposes whether monitored smart-money wallets hold, distributed, or exited the asset, renders their computed auto-grades and entry market caps, aggregates netflow over selectable windows, warns of insider cluster coordination, and flags critical contract risks including direct deployer-to-wallet transfers (Paid-Promoter warning) and top-10 supply concentration. Additionally, Phase 6 incorporates automated wallet grading on wallet profiles and delivers operational maintenance tools (manual token history pruning, derivation rebuilds, quota observability, and backup staleness reminders).

### Key Capabilities Delivered:

1. **Token Intelligence Console & Fast Lookup (FR-7.1, P6-T03)**:
   - Route `/tokens` provides clean search entry with automatic chain detection and contract validation.
   - Route `/tokens/[chain]/[address]` renders comprehensive token intelligence from the local database in **under 3 seconds** (< 3s SLA).
   - Live query duration is displayed directly in the header with an explicit local DB SLA indicator.
   - Handles unobserved/unknown tokens with a defined empty state offering non-blocking metadata discovery via BullMQ.
   - Non-blocking "Refresh Metadata" button dispatches background enrichment jobs without interrupting user workflows.

2. **Tracked-Wallet Holder Audit & Status Derivation (FR-7.1, P6-T03)**:
   - Displays all tracked wallets holding or previously transacting the token.
   - Derives factual position status per FR-7.1:
     - `HOLDING`: Open position, positive balance, 0 CEX deposits, and 0 sell events.
     - `DISTRIBUTED`: Open position, but user has recorded CEX deposit or sell outflow events.
     - `EXITED`: Closed position or balance equals 0.
   - Details include wallet tags/computed label, auto-grade badges, entry market cap, raw amount, current holdings USD, and share of tracked supply.

3. **Netflow Analytics & Inflow/Outflow History (FR-7.1, P6-T03)**:
   - Computes tracked-wallet aggregate buy vs sell volume across 24h, 7d, and 30d windows.
   - Renders interactive daily bar visualization showing historical buy volume, sell volume, and net USD flow.

4. **Automated Token Red-Flag Heuristics & Concentration (FR-7.2, P6-T02)**:
   - **Paid-Promoter Warning**: Scans transactions to detect any direct transfers from the token's deployer address to any tracked wallet. Warns prominently, naming the funded wallet address and linking directly to the on-chain transfer transaction hash.
   - **Cluster Presence Alerts**: Highlights when multiple wallets belonging to the same identified cluster hold or trade the token.
   - **Top 10 Supply Concentration**: Integrates explorer holder summaries (`getTokenHolderSummary`) across Base and BSC. Explicitly records `holderDataUnavailable: true` when explorer data is absent, never presenting misleading zero percentages.
   - **Contract Age**: Derives token age from `deployedAt` timestamp and flags fresh contracts (< 7 days old).

5. **Wallet Auto-Grading Engine (SRS §8, FR-1.4, FR-1.6, P6-T01)**:
   - `calculateWalletGrade` evaluates closed positions across three statistical dimensions:
     - **Win Rate**: Profitable closed positions divided by total closed positions.
     - **Realized PnL**: Exact sum of realized profit/loss on closed positions (open positions strictly excluded).
     - **Entry-Timing Ratio**: Ratio of average entry market cap to peak market cap, quantifying early execution edge.
   - Minimum sample size threshold (< 3 closed positions) marks grades as explicitly `UNAVAILABLE` rather than extrapolating premature metrics.
   - Formatted label preview `gradeLabel` reflects the computed `{EDGE}-{STYLE} [{SIZE}]` convention.
   - Interactive `GradeCard` mounted directly on `/wallets/[chain]/[address]` with recompute action.

6. **System Maintenance, Prune Utility & Quota Observability (NFR-2, NFR-5, NFR-6, P6-T04)**:
   - **Manual Token History Pruning**: Dedicated operator utility to purge historical data for a specific contract. Enforces typed confirmation string `"PRUNE"`, target-deletes across 5 tables (`Transaction`, `MovementEvent`, `PriceSnapshot`, `Position`, `DailyFlow`), reports deleted row counts per table, and guarantees complete isolation of other tokens. Never triggered by automated jobs.
   - **Derivation Rebuilds**: UI triggers for rebuilding interaction edges and wallet relationships.
   - **Backup Staleness Reminder**: Non-blocking dashboard and settings banner alerting when newest backup in `./backups/` is > 7 days old or missing, linking directly to `npm run backup`.
   - **Quota Reporting**: Live consumption meters tracking daily limits, calls today, remaining headroom, and rate-limit hits across Etherscan V2, Robinhood, and DexScreener.

---

## 2. Dual Traceability Matrix

### A. Functional Requirements Traceability (FR $\rightarrow$ Tasks & Code)

| Requirement | Description | Implementation Files | Status |
|---|---|---|---|
| **FR-7.1** | Paste token address + chain $\rightarrow$ panel displays tracked-wallet holders (with grades, entry MCs, holding vs distributed vs exited status), netflow history of tracked wallets, cluster presence warnings, and red flags (promoter warning, supply concentration). | `src/server/services/token/lookup.ts`, `src/server/trpc/routers/token.ts`, `src/components/tokens/TokenLookupForm.tsx`, `src/components/tokens/HolderTable.tsx`, `src/components/tokens/TokenNetflowChart.tsx`, `src/components/tokens/RedFlagList.tsx`, `src/app/tokens/page.tsx`, `src/app/tokens/[chain]/[address]/page.tsx` | **PASS** |
| **FR-7.2** | Automated token red-flag heuristics: deployer $\rightarrow$ wallet transfers (promoter warning naming wallet and tx hash), % supply held by top 10 holders from explorer data via `getTokenHolderSummary`, and token contract age. | `src/server/services/token/red-flags.ts`, `src/lib/chains/etherscan-v2-adapter.ts`, `src/components/tokens/RedFlagList.tsx`, `src/server/trpc/routers/token.ts` | **PASS** |
| **FR-1.4 / FR-1.6** | Wallet profile auto-grade computation: Win Rate, Realized PnL, Entry-timing ratio, sample size gating, and computed `{EDGE}-{STYLE} [{SIZE}]` label. | `src/server/services/wallet/grade.ts`, `src/components/wallets/GradeCard.tsx`, `src/app/wallets/[chain]/[address]/page.tsx`, `src/server/trpc/routers/wallet.ts` | **PASS** |
| **NFR-2 / NFR-5 / NFR-6** | Maintenance operations: manual prune token history with explicit `"PRUNE"` confirmation, non-blocking backup staleness reminder (>7 days), and quota reporting. | `src/server/services/maintenance/prune.ts`, `src/server/workers/processors/maintenance-prune.ts`, `scripts/prune-token-history.ts`, `src/server/trpc/routers/maintenance.ts`, `src/components/settings/MaintenancePanel.tsx`, `src/app/health/HealthConsole.tsx` | **PASS** |

### B. Phase 6 Task Execution Contract (`P6-D01` through `P6-T05`)

| Task ID | Task Description | Deliverables & Artifacts | Status |
|---|---|---|---|
| **P6-D01** | Stitch design gate: token lookup, grading, and maintenance | Stitch screens (`cda198fa23bd4abf9c241a948985dbcd`, `7e24c4866b9d4d8d808010b79d7a474e`), `docs/design/phase-6/{prompt.md,screen-map.md,interaction-notes.md,approval.md}` | **COMPLETE** |
| **P6-T01** | Auto-grade computation (WR, realized PnL, entry-timing ratio) | `src/server/services/wallet/grade.ts`, `src/components/wallets/GradeCard.tsx`, `src/app/wallets/[chain]/[address]/page.tsx`, `tests/unit/grade.test.ts` | **COMPLETE** |
| **P6-T02** | Token holder concentration and red-flag checks | `src/server/services/token/red-flags.ts`, `src/lib/chains/etherscan-v2-adapter.ts`, `src/server/trpc/routers/token.ts`, `tests/unit/token-red-flags.test.ts` | **COMPLETE** |
| **P6-T03** | Token lookup panel (local reads, holders, netflow, cluster warnings) | `src/server/services/token/lookup.ts`, `src/components/tokens/*`, `src/app/tokens/page.tsx`, `src/app/tokens/[chain]/[address]/page.tsx`, `tests/unit/token-lookup.test.ts` | **COMPLETE** |
| **P6-T04** | Maintenance: prune utility, derivation rebuild, quota reporting | `src/server/services/maintenance/prune.ts`, `src/server/trpc/routers/maintenance.ts`, `src/components/settings/MaintenancePanel.tsx`, `scripts/prune-token-history.ts`, `tests/unit/maintenance.test.ts` | **COMPLETE** |
| **P6-T05** | Phase 6 acceptance spec & bundle fixtures | `tests/unit/phase6-acceptance.test.tsx`, `tests/e2e/phase6.spec.ts`, `tests/fixtures/scenarios/phase6-bundle.json` | **COMPLETE** |

---

## 3. SRS §8 Phase 6 Acceptance Criteria Verification Evidence

| # | Acceptance Criterion | Verification Method | Result | Evidence |
|---|---|---|---|---|
| **1** | **Paste a token $\rightarrow$ holders/netflow/red-flag panel renders in $< 3\text{s}$ from local DB** | Playwright E2E & Vitest Acceptance | **PASS** | `phase6: panel renders in under 3 seconds` and `phase6: token panel renders holders, netflow, and red flags` both pass. Measured render time is **1.0s–1.2s** (well under 3,000ms SLA). Local DB query header renders `✓ Local DB (< 3s SLA)`. |
| **2** | **Tracked-wallet holders render with grades, entry MCs, and holding vs distributed vs exited status** | Playwright E2E & Vitest Acceptance | **PASS** | Holders table renders wallet address / ENS (`whale.eth`), computed label (`SMART-RIDER [W]`), auto-grade badge (`70.0%` WR), entry MC (`$1,200,000`), and status (`HOLDING`). |
| **3** | **Promoter red flag is visible for a deployer-funded wallet naming wallet and tx hash** | Playwright E2E & Vitest Acceptance | **PASS** | `phase6: promoter red flag is visible for a deployer-funded wallet` passes. Identifies tracked wallet `0x1111...1111`, links directly to deployer transfer transaction `0x600000...000010`, and surfaces cluster presence warnings. |
| **4** | **Wallet profile renders auto-grade block** | Playwright E2E & Vitest Acceptance | **PASS** | `phase6: wallet profile shows the auto-grade block` passes. Profile page displays `GradeCard` with Win Rate (`70.0%`), Realized PnL (`+$5,300.00`), Entry-Timing Ratio (`0.399`), and `GRADE ACTIVE` status. |
| **5** | **Manual token history prune utility requires explicit confirmation** | Vitest Unit Acceptance | **PASS** | `criterion 5: maintenance prune requires confirmation and isolates target token` passes. Rejects invalid confirmations, executes deletion across 5 tables with `"PRUNE"`, and leaves other tokens untouched. |

---

## 4. Test Suite Execution & Quality Evidence

### A. TypeScript Typecheck
```text
> pnpm typecheck
  ✓ tsc --noEmit (0 TypeScript errors)
```

### B. Phase 6 Vitest Unit & Acceptance Suite
```text
> pnpm vitest run tests/unit/phase6-acceptance.test.tsx tests/unit/grade.test.ts tests/unit/token-red-flags.test.ts tests/unit/token-lookup.test.ts tests/unit/maintenance.test.ts

 ✓ tests/unit/phase6-acceptance.test.tsx (5 tests)
 ✓ tests/unit/token-red-flags.test.ts (7 tests)
 ✓ tests/unit/grade.test.ts (6 tests)
 ✓ tests/unit/maintenance.test.ts (9 tests)
 ✓ tests/unit/token-lookup.test.ts (9 tests)

 Test Files  5 passed (5)
      Tests  36 passed (36)
```

### C. Full Repository Unit Test Baseline
```text
> pnpm test:unit
  Test Files  62 passed (62)
       Tests  413 passed (413)
    Duration  10.15s (0 failures)
```

### D. Playwright Phase 6 E2E Acceptance Suite
```text
> pnpm e2e tests/e2e/phase6.spec.ts

Running 4 tests using 4 workers

  ok 1 [chromium] › tests/e2e/phase6.spec.ts › phase6: token panel renders holders, netflow, and red flags (867ms)
  ok 2 [chromium] › tests/e2e/phase6.spec.ts › phase6: panel renders in under 3 seconds (1.1s)
  ok 3 [chromium] › tests/e2e/phase6.spec.ts › phase6: promoter red flag is visible for a deployer-funded wallet (1.2s)
  ok 4 [chromium] › tests/e2e/phase6.spec.ts › phase6: wallet profile shows the auto-grade block (1.3s)

  4 passed (3.0s)
```

---

## 5. Stitch Design System & Screens Reference

- **Stitch Project ID**: `projects/17665303442847236685`
- **Design Artifacts Directory**: `docs/design/phase-6/`
- **Approved Screens**:
  - `cda198fa23bd4abf9c241a948985dbcd`: *Watchtower Token Intelligence Console (`/tokens/[chain]/[address]`)*
  - `7e24c4866b9d4d8d808010b79d7a474e`: *Watchtower Operations & Maintenance Console (`/health` & `/settings`)*
- **Design Approval Record**: `docs/design/phase-6/approval.md` (Observatory Theme, Dark 0px radius aesthetic, High-density typography).
