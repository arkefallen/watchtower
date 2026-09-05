# Watchtower Phase 1 Result & Acceptance Report

Status: **ALL ACCEPTANCE CRITERIA PASSED — PHASE 1 COMPLETE**  
Report Date: 2026-09-05  
Scope: Phase 1 only (`P1-D01`, `P1-T01` through `P1-T18`)  
Authoritative Sources: `watchtower-srs.md` (authoritative requirements), `watchtower-implementation-plan.md` (task contract)

---

## 1. Executive Summary & Outcome

Phase 1 ("Registry & Funding Tracer") establishes the complete core data acquisition, wallet registry, intake pipeline, profile statistics engine, and recursive funding tracer for Watchtower.

Every requirement defined in `watchtower-srs.md` §1 (Wallet Registry & Labeling), §2 (Funding Source Tracer & Graph), and §8 (Phase 1 Acceptance Criteria) has been implemented, tested, and verified end-to-end across the backend services, database schema, tRPC APIs, and the approved Google Stitch frontend user interfaces.

---

## 2. SRS §8 Acceptance Evidence

| # | SRS §8 Phase 1 Acceptance Criterion | Result | Evidence / Verification Method |
|---|---|---|---|
| **1** | **Import 10 wallets via CSV** | **PASS** | `parseImportBatch` parses CSV with line-by-line validation, deduplication against tracking state, and enqueues BullMQ intake pipeline (`tests/unit/wallet-import.test.ts`, `tests/unit/phase1-acceptance.test.ts` criterion 1). E2E flow verified in `tests/e2e/phase1.spec.ts`. |
| **2** | **Each wallet displays profile with stats + funding tree** | **PASS** | Complete 6-metric profile cards (first tx, age at 1st memecoin, total txs, distinct tokens, parked stables, dormancy) + 168-cell dual activity heatmap + hierarchical funding tree canvas rendered on `/wallets/[chain]/[address]` (`tests/unit/wallet-profile.test.ts`, `tests/unit/phase1-acceptance.test.ts` criterion 2). |
| **3** | **Known CEX funder displays as terminal entity** | **PASS** | Binance hot wallet `0x28c...90e5` resolves to known entity with `isTerminal: true`, stopping recursive expansion at hop 1 and emitting `stopReason: "TERMINAL_ENTITY"`, displaying verified green `[TERMINAL ENTITY: CEX]` pill (`tests/unit/phase1-acceptance.test.ts` criterion 3). |
| **4** | **Shared funders auto-create clusters** | **PASS** | Wallets `0x1000...02`, `0x1000...03`, and `0x1000...04` sharing funder `0x33b8...aa90` trigger cluster detection, generating persistent cluster entity with auto-assigned hex color and member associations (`tests/unit/cluster.test.ts`, `tests/unit/phase1-acceptance.test.ts` criterion 4). |
| **5** | **Deep-trace button extends a branch** | **PASS** | Depth-limited node at hop 3 expands up to hop 6 via single-branch targeted deep trace using `buildFundingTree` with `branch` parameter without re-fetching existing branches (`tests/unit/deep-trace.test.ts`, `tests/unit/phase1-acceptance.test.ts` criterion 5). |

### Fresh Verification Suite Command Log

```text
> pnpm verify
  ✓ tsc --noEmit (0 TypeScript errors)
  ✓ eslint . (0 errors, 2 warnings)
  ✓ vitest run (176 unit tests passed, 34 test files, 0 failures)

> pnpm test:unit tests/unit/phase1-acceptance.test.ts
  ✓ criterion 1: parse and import 10-wallet CSV batch with line validation
  ✓ criterion 2: each imported wallet generates profile stats, dual heatmaps, and funding tree
  ✓ criterion 3: known CEX funder displays as terminal entity with stopReason TERMINAL_ENTITY
  ✓ criterion 4: shared funders auto-create clusters across tracked wallets
  ✓ criterion 5: deep-trace extends depth-limited branch up to 6 hops
  Test Files: 1 passed (1) | Tests: 5 passed (5)

> pnpm build
  ▲ Next.js 16.3.0 (Turbopack)
  ✓ Compiled successfully
  ✓ Finished TypeScript
  ✓ Generating static pages (8/8)
  Routes generated:
    ○ /
    ○ /wallets
    ○ /wallets/new
    ƒ /wallets/[chain]/[address]
    ○ /clusters
    ƒ /clusters/[id]
    ƒ /health
    ƒ /api/trpc/[trpc]
```

---

## 3. Task Completion Table (`P1-D01`, `P1-T01` – `P1-T18`)

| Task ID | Status | Title / Scope | Key Files & Artifacts |
|---|---|---|---|
| `P1-D01` | **DONE** | Stitch UI Design Gate for Phase 1 | `docs/design/phase-1/` (`screen-map.md`, `approval.md`, `prompt.md`, `interaction-notes.md`), HTML & PNG screen mockups for Registry (`d43930...`), Intake (`28684a...`), Detail/Heatmap (`a4a6c8...`), and Funding/Clusters (`dd1d97...`). Explicit user approval granted. |
| `P1-T01` | **DONE** | Prisma Schema Phase 1 Migrations | `prisma/schema.prisma` (Wallet, WalletProfile, FundingNode, FundingEdge, Cluster, ClusterMember, DailyFlow, BalanceSnapshot), Migration `0002_phase1_registry_funding`. |
| `P1-T02` | **DONE** | Ingestion Engine Core & Block-Window Walker | `src/server/services/ingestion/orchestrator.ts`, `src/server/services/ingestion/block-walker.ts`, `tests/unit/ingestion.test.ts`. |
| `P1-T03` | **DONE** | Balance Tracking & Native/ERC-20 Balances | `src/server/services/balance/tracker.ts`, `tests/unit/balances.test.ts`. |
| `P1-T04` | **DONE** | Pricing Pipeline & USD Valuation | `src/server/services/pricing/price-resolver.ts`, DexScreener fallback to CoinGecko, `tests/unit/pricing.test.ts`. |
| `P1-T05` | **DONE** | Wallet Registry Service & CRUD | `src/server/services/wallet/registry.ts`, deduplication, archiving, priority watch, `tests/unit/wallet-registry.test.ts`. |
| `P1-T06` | **DONE** | Single Address Intake & ENS Resolver | `src/server/services/wallet/ens.ts` (ENS V2 reverse/forward resolution with Viem), `tests/unit/ens.test.ts`. |
| `P1-T07` | **DONE** | Batch CSV Import & Validation Engine | `src/server/services/wallet/import.ts` (`parseImportBatch`), line-level syntax validation, `tests/unit/wallet-import.test.ts`. |
| `P1-T08` | **DONE** | Ingestion Worker Pipeline (14-Stage Job) | `src/server/workers/intake-pipeline.ts`, BullMQ repeatable stages, `tests/unit/intake-pipeline.test.ts`. |
| `P1-T09` | **DONE** | Sync Scheduler & Stale Wallet Polling | `src/server/services/sync/scheduler.ts`, priority vs standard frequency, `tests/unit/sync-scheduler.test.ts`. |
| `P1-T10` | **DONE** | Profile Statistics Engine & Dual Heatmaps | `src/server/services/profile/calculator.ts` (168-cell habitual vs rolling 7-day grid, dormancy detection, age-at-first-memecoin), `tests/unit/wallet-profile.test.ts`. |
| `P1-T11` | **DONE** | Stablecoin Parking Detection | `src/server/services/profile/parking.ts` (USDC, USDT, USDG thresholds, inflow/outflow balance history), `tests/unit/parking.test.ts`. |
| `P1-T12` | **DONE** | Label Computation Engine | `src/lib/format/wallet-label.ts` (`formatWalletLabel`), `tests/unit/wallet-label.test.ts`. |
| `P1-T13` | **DONE** | Recursive Funding Source Tracer | `src/server/services/funding/tracer.ts` (`buildFundingTree`, depth cap 3, branch limits, internal-tx fallback, terminal entity cutoff), `tests/unit/funding-trace.test.ts`. |
| `P1-T14` | **DONE** | Deep-Trace Engine | `src/server/services/funding/deep-trace.ts` (targeted single-branch expansion up to 6 hops), `tests/unit/deep-trace.test.ts`. |
| `P1-T15` | **DONE** | Primary Wallet Identification | `src/server/services/funding/primary-wallet.ts` (Condition A >= 2 transfers, Condition B >= 20% outflow return), `tests/unit/primary-wallet.test.ts`. |
| `P1-T16` | **DONE** | Shared Funder Cluster Detection | `src/server/services/cluster/detect.ts` (`detectClustersFromEdges`), deterministic hex palette assignment, `tests/unit/cluster.test.ts`. |
| `P1-T17` | **DONE** | Phase 1 Frontend UI Implementation | Approved Observatory theme components (`StateBadge`, `AddressChip`, `DataTable`, `WalletFilters`, `WalletTable`, `BulkActionBar`, `ActivityHeatmap`, `ParkingTimeline`, `FundingTree`, `FundingNode`, `DeepTraceButton`, `PrimaryWalletBadge`, `EntityLabelEditor`) and pages (`/wallets`, `/wallets/new`, `/wallets/[chain]/[address]`, `/clusters`, `/clusters/[id]`). |
| `P1-T18` | **DONE** | Phase 1 Integration & Acceptance Testing | `tests/fixtures/scenarios/phase1-bundle.json` (10-wallet scenario), `tests/unit/phase1-acceptance.test.ts` (5 automated acceptance assertions), `tests/e2e/phase1.spec.ts` (Playwright suite). |

---

## 4. Dual Traceability Matrix

### Requirements (SRS §1 & §2) to Implementation Tasks & Files

| Requirement ID | Requirement Description | Phase 1 Tasks | Source Code Files |
|---|---|---|---|
| **FR-1.1** | Manual wallet registration (address or ENS, chain, label, priority) | `P1-T05`, `P1-T06`, `P1-T17` | `src/server/services/wallet/registry.ts`, `src/server/services/wallet/ens.ts`, `src/app/wallets/new/page.tsx` |
| **FR-1.2** | Batch wallet intake via CSV paste with syntax pre-flight validation | `P1-T07`, `P1-T17` | `src/server/services/wallet/import.ts`, `src/app/wallets/new/page.tsx` |
| **FR-1.3** | Multi-chain registry support (Base, BSC, Robinhood Chain) | `P1-T01`, `P1-T05`, `P1-T17` | `src/lib/chains/types.ts`, `src/server/services/wallet/registry.ts`, `src/components/wallets/WalletFilters.tsx` |
| **FR-1.4** | Deduplication against active tracking state | `P1-T05`, `P1-T07` | `src/server/services/wallet/registry.ts`, `src/server/services/wallet/import.ts` |
| **FR-1.5** | Configurable intake pipeline with 14 repeatable asynchronous stages | `P1-T08` | `src/server/workers/intake-pipeline.ts` |
| **FR-1.6** | Wallet profile statistics generation (first tx, memecoin age, dormancy) | `P1-T10`, `P1-T17` | `src/server/services/profile/calculator.ts`, `src/app/wallets/[chain]/[address]/page.tsx` |
| **FR-1.7** | Dual 168-cell activity heatmaps (habitual vs rolling 7-day) | `P1-T10`, `P1-T17` | `src/components/wallets/ActivityHeatmap.tsx`, `src/server/services/profile/calculator.ts` |
| **FR-1.8** | Stablecoin parking detection and chronological timeline | `P1-T11`, `P1-T17` | `src/server/services/profile/parking.ts`, `src/components/wallets/ParkingTimeline.tsx` |
| **FR-2.1** | Recursive upstream funding trace up to depth 3 | `P1-T13`, `P1-T17` | `src/server/services/funding/tracer.ts`, `src/components/funding/FundingTree.tsx` |
| **FR-2.2** | Internal transaction fallback when normal tx has 0 value | `P1-T13` | `src/server/services/funding/tracer.ts` (Blockscout/Etherscan internal traces) |
| **FR-2.3** | Terminal entity classification (CEX, Bridge, Router cutoff) | `P1-T13`, `P1-T17` | `src/server/services/funding/tracer.ts`, `src/components/funding/FundingNode.tsx` |
| **FR-2.4** | Deep-trace on-demand targeted branch extension to depth 6 | `P1-T14`, `P1-T17` | `src/server/services/funding/deep-trace.ts`, `src/components/funding/DeepTraceButton.tsx` |
| **FR-2.5** | Primary wallet candidate detection (Condition A & B heuristics) | `P1-T15`, `P1-T17` | `src/server/services/funding/primary-wallet.ts`, `src/components/funding/PrimaryWalletBadge.tsx` |
| **FR-2.6** | Shared funder cluster formation & persistent color assignments | `P1-T16`, `P1-T17` | `src/server/services/cluster/detect.ts`, `src/app/clusters/page.tsx` |
| **FR-2.7** | Cluster rotation and member aggregation queries | `P1-T16`, `P1-T17` | `src/server/api/routers/cluster.ts`, `src/app/clusters/[id]/page.tsx` |
| **FR-2.8** | Custom entity label assignment & terminal status toggle | `P1-T17` | `src/components/settings/EntityLabelEditor.tsx`, `src/server/api/routers/settings.ts` |

### Non-Functional Requirements (NFRs) Adherence

| NFR ID | Requirement Summary | Implementation & Verification Status |
|---|---|---|
| **NFR-1** | Local structured logging with no remote telemetry | Pino logger scoped to local stdout/stderr, zero external sinks. |
| **NFR-2** | Queued external work with deterministic fixtures | Offline test fixtures in `tests/fixtures/scenarios/` allow 100% deterministic testing without live RPC calls. |
| **NFR-3** | Strict local validation boundary | Zod schemas validate all inputs in tRPC routers and batch CSV ingestion. |
| **NFR-4** | Budget-aware rate limiting | Token bucket rate limiter ensures provider API consumption stays within configured ceilings. |
| **NFR-5** | Additive data posture with no automatic deletion | Wallets are marked `isArchived = true` instead of cascading deletes. |
| **NFR-7** | Zero custody / Read-only safety | No private key or signing logic exists; all chain interactions are strictly read-only RPCs. |
| **NFR-8** | Observatory Theme & 0px Border Radius | Implemented strict Observatory visual language (Canvas `#101214`, Surface `#171A1D`, Accent `#D7A84B`, 0px sharp corners, Geist / Geist Mono typography). |

---

## 5. Architectural & Technical Decisions Log

1. **ENS v2 Compatibility:**
   - Upgraded resolution logic using `viem/ens` with Universal Resolver fallback conforming to modern ENS v2 guidelines.
2. **Deterministic Deep Trace Expansion:**
   - Implemented single-branch expansion using `branch: Address` filter in `buildFundingTree` so deep-trace executions do not re-traverse previously expanded peer branches or burn unnecessary RPC quota.
3. **Cluster Color Assignment:**
   - Implemented deterministic HSL golden-ratio color generator in `src/server/services/cluster/detect.ts` ensuring persistent, high-contrast visual chips across rerenders and restarts.
4. **Clean Next.js Static Optimization:**
   - Configured `.env` and `eslint.config.mjs` to keep build-time static page collection reproducible and warning-free.

---

## 6. Next Steps: Ready for Phase 2 Gate

Phase 1 is complete and fully verified. In accordance with the project phase-gating rules:
- **Phase 2 ("Interaction Graph")** is next in sequence.
- Phase 2 scope: Counterparty interaction edge building, token transfer tracking, DEX liquidity pool identification, Graphology integration, and Force-directed graph UI with time-window filtering.
