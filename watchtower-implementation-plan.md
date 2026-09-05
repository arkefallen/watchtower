# Watchtower Implementation Plan

> **For agentic workers:** This plan is written for an engineer/agent with **zero prior context**. Execute it task-by-task, in ID order, using `subagent-driven-development` (fresh worker per task, review between tasks) or `executing-plans` (inline, batched with checkpoints). Task steps use checkbox (`- [ ]`) syntax for tracking. Do not reorder phases.

**Goal:** Build "Watchtower" — a local-only, single-user web application that turns a manually curated watchlist of EVM wallets into a live intelligence system: wallet profiling, recursive funding-source tracing, an interaction graph, factual onchain movement detection, a wallet alert state machine, and self-trade edge measurement.

**Authority:** `watchtower-srs.md` — Software Requirements Specification v1.0, "Approved for build" — remains authoritative for requirements. The product-owner decisions in §0 supersede the corresponding ambiguities in the SRS and are binding on implementation. Every task cites the FR/NFR IDs it satisfies; executors read the spec and this plan together. Section 9 retains the former open questions and their chosen resolutions as decision history.

**Plan scope:** planning artifact only. No application code is included here — interface signatures, database schema, and algorithms in plain language only, per the planner's mandate.

---

## Global Constraints

Copied verbatim from the SRS. **Every task's requirements implicitly include this section.**

| Constraint | Value (from SRS) |
|---|---|
| Runtime | Node.js 24 LTS "Krypton" (24.20.x) — SRS §7 |
| Framework | Next.js 16.3, App Router — SRS §7 |
| UI library | React 19.2 — SRS §7 |
| Language | TypeScript 5.x, `strict` — SRS §7 |
| Styling / components | Tailwind CSS 4 + shadcn/ui — SRS §7 |
| API layer | tRPC v11 + TanStack Query v5 — SRS §7 |
| Data layer | Prisma ORM 7 + PostgreSQL 18 — SRS §7 |
| Job queue | BullMQ + Redis 8 + `@bull-board` — SRS §7 |
| Graph viz | Cytoscape.js 3.x + `cytoscape-fcose` 2.2 — SRS §7 |
| Chain utils | viem (latest 2.x) — SRS §7 |
| Validation | Zod v4 — SRS §7 |
| Charts | Recharts (or shadcn charts) — SRS §7 |
| Package manager | pnpm — SRS §7 |
| Runtime env | Docker Compose: `app` + `postgres:18` + `redis:8`; boot with `docker compose up` — SRS §7 |
| Local-only | App binds to localhost; no outbound telemetry; API keys only in `.env` — NFR-1 |
| Async everything | Every external-API operation is a BullMQ job with progress % in the UI; Bull Board on a protected local route; 100-wallet batch import must never block the UI — NFR-2 |
| Idempotent ingestion | Re-running a sync produces no duplicate transactions (upsert by natural key) — NFR-3 |
| Incremental sync | Per wallet + chain, resume from last synced block; full re-sync is an explicit user action — NFR-4 |
| Data retention | Never auto-delete; manual "prune token history" utility allowed — NFR-5 |
| Backup | `npm run backup` → `pg_dump` into `./backups/` with timestamped filename — NFR-6 |
| Performance | Wallet list < 500 ms; graph with 300 nodes + 1,000 edges interactive (>30 fps pan/zoom); movement feed paginates at 50 rows — NFR-7 |
| UI | Dark theme default, desktop-first (1440px+), dense data tables, times in user's local timezone with a chain-block display toggle — NFR-8 |
| Chain abstraction | All chain-specific logic behind a `ChainAdapter` interface (`getTransactions`, `getInternalTxs`, `getTokenTransfers`, `getTokenInfo`) — NFR-9 |
| Timestamps | Stored UTC, rendered in `APP_TIMEZONE` — SRS §10.8 |
| Internal transactions | **Mandatory** for funding traces — SRS §10.4, FR-2.1 |
| USD values | Persisted at ingest time as `PriceSnapshot`; never computed at render time — SRS §10.3 |
| Etherscan pagination | Max 1,000 records per request; paginate everywhere; cache per (address, chain); re-syncs incremental — SRS §10.5, §5 |
| Alert evidence | Every alert renders the exact rule, thresholds, underlying numbers, and tx links — SRS §10.6, FR-5.5 |
| Independence | A first-class computed value (different funders + no interaction edge), not a UI afterthought — SRS §10.7, FR-4.2 |
| Non-goals | No social/narrative detection, no trade execution or key handling, no multi-user auth, no deployment/cloud/telemetry, no mobile app, no Solana in v1 — SRS §1 |
| **v1 chain scope** | **Base, BSC, Robinhood Chain** — user decision, §0 D-1. Same-chain only; no cross-chain linking in v1 (§0 D-2) |
| **UI build order** | **Every UI surface is designed in Google Stitch first, reviewed by the user, and only then implemented in code** — user decision, §0 D-11, gate procedure in §5.0 |
| **Documentation** | A dedicated documentation & walkthrough phase (Phase 8) is part of the deliverable, not an afterthought — user decision, §0 D-12 |

**Never build:** anything in SRS §1 "Non-Goals". If a task appears to require signing, private keys, deployment, or social-media data, stop and report a spec conflict.

---

## 0. Resolved Decisions

Every ambiguity from §9 has been resolved by the product owner. These decisions are **binding**: an executor must not re-open them, and §9 retains the full options and trade-offs for context only. Where a decision changed the plan, the affected sections are named.

| ID | Decision | Chosen | Affects |
|---|---|---|---|
| **D-1** | v1 chain scope | **Base, BSC, Robinhood Chain only.** `Chain` enum = `BASE, BSC, ROBINHOOD`; Ethereum mainnet and all other EVM chains are out of scope for v1. `DEFAULT_CHAIN=base` and remains user-configurable among the three supported chains. Robinhood data-provider completeness is proven in P0-T18 before Phase 1 begins. | §3.2 enum, P0-T03, P0-T06, P0-T10, P0-T18, §6 |
| **D-2** | Cross-chain funding / interaction edges | **Same-chain only.** An edge requires `childChain === parentChain`; bridges are terminal entities, so a cross-chain path stops at the bridge with an explicit label. Cross-chain linking is **backlogged, not cancelled** — see §10 Backlog B-1. | P1-T09, P2-T01, §10 |
| **D-3** | "Realized outflow value" (FR-2.4 profit sink) | **All value leaving the wallet to any address** (native + internal + ERC-20), excluding DEX-router swap legs and gas fees. Simple outflow accounting, computable in Phase 1. | P1-T10, §4.5 |
| **D-4** | A2 (gas arming) absolute floor | **Recommended two-armed threshold, mirroring A1:** `threshold = max(a2MinNativeInflowUsd, a2MedianMultiple × median)` with `a2MinNativeInflowUsd` defaulting to **$100**, and a cold-start rule of floor-only when the median is unavailable. Rationale below. | §4.8 `AlertThresholds`, P4-T03, P4-T11 |
| **D-5** | Definition of "graded wallet" | **Any manual tag set (`edge`, `style`, or `size`) OR a computed auto-grade with a sufficient sample.** Exposed in Settings as `gradedDefinition` so it can be tightened later. | P4-T05, P4-T06, P5-T02, P4-T11 |
| **D-6** | Is CO_ENTRY part of the independence test? | **No.** Display it in FR-3.6's statement list; exclude it from FR-4.2's independence test. Avoids the circularity where co-entry detection cancels itself. | §4.7, P2-T06, P3-T05, R6 |
| **D-7** | Whose position does C3 monitor? | **All tracked wallets**, with `isSelf` findings surfaced more prominently. Settings toggle `c3SelfOnly` defaults to false. | P4-T06, P4-T11 |
| **D-8** | Activity heatmap bucketing | **Both modes with a toggle:** hour-of-day × day-of-week over full history (habitual timing) **and** a rolling 7-day × 24-hour window (recent shape). Same underlying query, so both are computed in one pass. | §3.2 `heatmapJson`, P1-T06, P1-T17 |
| **D-9** | "Combined % of token supply" (FR-4.2) | **Sum of token amounts bought in the window ÷ total supply**, null when supply is unknown. Immutable and reproducible as stored evidence. | P3-T05, P3-T07 |
| **D-10** | Backup scheduling | **Manual only + automatic pre-migration backup + a dashboard staleness reminder** when the newest backup is older than 7 days. Nothing auto-deletes (NFR-5). | P0-T16, P6-T04, §7 dashboard |
| **D-11** | UI implementation workflow | **Stitch-first.** Every UI surface is designed in Google Stitch using the taste/design skills, exported as local design-system artifacts, reviewed and approved by the user, and only then implemented as code. Full gate procedure in §5.0. | §5.0, every `P*-D01` task, all UI tasks |
| **D-12** | Documentation | **Phase 8 — Documentation & Walkthrough** is a required phase covering overview, objective, key features, architecture, key decisions & business logic, how to run, walkthrough, and maintenance. | §5 Phase 8, §A.7 |

### D-1 provider boundary — Robinhood Chain needs its own adapter

As of 2026-09-04, Etherscan V2's live chain list includes Base (8453) and BSC (56) but does **not** list Robinhood Chain (4663). Robinhood's official documentation identifies Robinhood Chain as fully EVM-compatible, publishes chain ID 4663, a public JSON-RPC endpoint, and a Blockscout explorer; it also warns that the public RPC is rate-limited and recommends a managed provider for sustained use. Sources: [Etherscan V2 chain list](https://api.etherscan.io/v2/chainlist), [Robinhood Chain connection guide](https://docs.robinhood.com/chain/connecting/), both accessed 2026-09-04.

The plan therefore does not pretend that one Etherscan key covers all three MVP chains:

1. Base and BSC use `EtherscanV2Adapter`.
2. **P0-T18 is a blocking provider proof and implementation task for `RobinhoodChainAdapter`.** It compares the official Blockscout/PRO API, a managed data API, and read-only JSON-RPC against the full `ChainAdapter` contract, including internal transactions and token transfers; it records the selected provider and quota assumptions in `docs/decisions/0001-robinhood-data-provider.md`.
3. Phase 1 cannot begin until the chosen Robinhood adapter passes the same contract suite as Base and BSC or the user explicitly narrows v1 scope. Provider credentials, if required, are added to `.env.example`; no private key is ever needed because Watchtower is read-only.
4. P0-T18 also verifies DexScreener coverage. If no Robinhood market pair is available, ingestion, funding trees, movements, and stable/native-derived alerts still work; unpriceable tokens carry `usdSource: UNKNOWN` and render `—` (§4.6).
5. The adapter boundary prevents Robinhood-specific endpoint shapes from leaking into services, rules, or UI (NFR-9).

### D-4 rationale — why A2 gets a floor

The SRS writes A1 as `max($1,000, 3× median)` and A2 as `3× median` alone. Taken literally, A2 has two defects: (a) **no floor means the rule fires on dust noise** — a wallet whose median daily native inflow is $0.40 would arm on a $1.20 top-up; and (b) **cold start makes it unfirable** — a new wallet with no median cannot arm on its first meaningful gas funding. Current monitoring guidance uses the analogous pattern of combining an anomaly condition with a separate fixed threshold when small anomalies are not actionable, and anomaly baselines themselves require history ([Datadog anomaly monitor guide](https://docs.datadoghq.com/monitors/guide/anomaly-monitor/), accessed 2026-09-04). The recommended Watchtower rule is therefore `max($100, 3× wallet median)`. The $100 default is deliberately lower than A1's $1,000 because native gas funding is normally smaller than stablecoin campaign funding. Cold start falls back to **floor-only**, not to a global cross-wallet median, because pooling bots, whales, and dormant wallets would create a baseline that represents none of them. Both arms are Settings fields, so the user can later tune the floor without code changes.

---

## 1. Executive Summary

Watchtower is a single local Next.js 16 monolith (App Router, React 19, tRPC v11) backed by PostgreSQL 18 as the local source of truth and Redis 8 as queue + cache. All external I/O (Etherscan V2 for Base/BSC, the selected Robinhood provider, DexScreener, and optional CoinGecko) is confined to rate-limited BullMQ workers so the UI never waits on a network call. The build strategy is sequential and additive: Phase 0 lays the scaffold, provider clients, `ChainAdapter` boundary, and DB-backed settings; Phase 1 builds the ingestion pipeline and funding tracer; Phases 2–6 add the interaction graph, movement radar, alert state machine, self-trade analytics, and token lookup; optional Phase 7 remains out of the v1 path; required Phase 8 completes documentation and a clean-room walkthrough. Every delivery phase has a Stitch design gate: use the taste skill to establish direction, create the phase UI in Google Stitch, stop for user review, and begin UI code only after the user returns with explicit approval. Each implementation phase ends at a demonstrable app state, verified by Playwright against deterministic `MockChainAdapter` fixtures, so acceptance does not depend on live third-party data. **The single biggest technical risk is historical USD attribution**: SRS §10.3 requires USD persisted at ingest, but free sources provide reliable *current* prices and only coarse or absent *historical* prices for young memecoins. The plan therefore derives per-swap prices from the transaction's own stable/native leg (§4.6, Risk R2), and every downstream USD number inherits the accuracy and explicit `UNKNOWN` states of that derivation. The second-order risk is provider quota exhaustion under continuous polling, controlled by the priority-tiered, budgeted scheduler in §6.

---

## 2. Repository & Module Structure

Project root is the repository root (`watchtower/`). One responsibility per directory; files that change together live together.

```
watchtower/
├─ .env.example                       # SRS §9 variable list, no secrets, committed
├─ .dockerignore
├─ .gitignore
├─ README.md                           # Phase 8 entry point: quick start + documentation map
├─ docker-compose.yml                 # app + worker + postgres:18 + redis:8, localhost-bound ports only
├─ docker-compose.test.yml            # ephemeral postgres/redis for integration tests (ports 5433/6380)
├─ Dockerfile                         # multi-stage: deps → build → runtime (node:24-alpine), used by app+worker
├─ package.json                       # pnpm scripts: dev, build, start, worker, backup, restore, test, e2e, seed
├─ pnpm-workspace.yaml                # single package; present so pnpm settings (node-linker) are explicit
├─ tsconfig.json                       # strict, paths: @/* → src/*
├─ next.config.ts                      # server externals for bullmq/prisma, no telemetry, standalone output
├─ tailwind.config.ts / postcss.config.mjs
├─ components.json                     # shadcn/ui registry config (Tailwind v4 + React 19 preset)
├─ vitest.config.ts                     # unit + integration projects
├─ playwright.config.ts                 # e2e acceptance, chromium, baseURL http://localhost:3000
├─ eslint.config.mjs
│
├─ prisma/
│  ├─ schema.prisma                    # single source of the data model (§3 of this plan)
│  ├─ migrations/                      # additive SQL migrations, never edited after apply
│  └─ seed/
│     ├─ seed.ts                       # idempotent installer: entity labels + default settings + chain rows
│     ├─ entity-labels.json            # bundled CEX/bridge/router address dataset (FR-2.3)
│     └─ default-settings.ts           # typed defaults for every Setting key (SRS §9)
│
├─ scripts/
│  ├─ backup.ts                        # NFR-6: pg_dump → ./backups/watchtower-<ts>.sql.gz
│  ├─ restore.ts                       # counterpart to backup, explicit confirmation prompt
│  ├─ probe-etherscan-limits.ts        # one-off: measures real page/window caps and rate ceiling
│  ├─ record-fixtures.ts               # captures live Etherscan/DexScreener responses into tests/fixtures
│  └─ prune-token-history.ts           # NFR-5 manual prune utility (CLI wrapper over the service)
│
├─ docs/
│  ├─ design/
│  │  ├─ DESIGN.md                     # approved design system extracted from the Stitch work
│  │  └─ phase-0/ … phase-6/           # Stitch prompts, screen exports, review notes, approval record
│  ├─ decisions/                       # ADRs, including Robinhood provider selection
│  ├─ overview.md                      # objective, audience, scope, key features, glossary
│  ├─ architecture.md                  # containers, modules, data flows, queues, provider boundaries
│  ├─ business-logic.md                # funding, outflow, independence, radar, alerts, pricing, grading
│  ├─ user-guide.md                    # task-oriented UI walkthrough with current screenshots
│  ├─ operations.md                    # run, backup/restore, migrations, quotas, maintenance, upgrades
│  └─ troubleshooting.md               # symptom → diagnosis → safe recovery runbook
│
├─ src/
│  ├─ app/                             # Next.js App Router: routes only, no business logic
│  │  ├─ layout.tsx                    # dark-theme shell, sidebar nav, tz provider (NFR-8)
│  │  ├─ globals.css                   # Tailwind 4 entry + design tokens
│  │  ├─ page.tsx                      # Dashboard (breadth, states, quiet-market, recent alerts)
│  │  ├─ health/page.tsx               # Phase 0 acceptance: DB/Redis/queue health + Etherscan quota
│  │  ├─ wallets/                      # list, add/import, detail: /wallets/[chain]/[address]
│  │  ├─ clusters/                     # cluster index + cluster detail (incl. rotation view)
│  │  ├─ graph/                        # full-screen interaction graph page
│  │  ├─ radar/                        # movement feed, movement groups, netflow, breadth
│  │  ├─ alerts/                       # alert center
│  │  ├─ self/                         # self-tracking dashboard, trade log, decay curve, comparison
│  │  ├─ tokens/                       # token lookup entry + /tokens/[chain]/[address] panel
│  │  ├─ settings/                     # thresholds, stable list, entity labels, telegram, maintenance
│  │  ├─ jobs/page.tsx                 # in-app job list + progress; links to Bull Board
│  │  └─ api/
│  │     ├─ trpc/[trpc]/route.ts       # single tRPC HTTP handler
│  │     └─ bull-board/[[...path]]/route.ts  # Bull Board mount, local-loopback guard (NFR-2)
│  │
│  ├─ server/                          # server-only code; never imported by client components
│  │  ├─ trpc/
│  │  │  ├─ trpc.ts                    # initTRPC, error formatter, superjson-equivalent transformer
│  │  │  ├─ context.ts                 # request context: prisma, queues, settings snapshot, clock
│  │  │  ├─ root.ts                    # appRouter composition + exported AppRouter type
│  │  │  └─ routers/                   # one router per domain: wallet, funding, cluster, graph,
│  │  │                                #   radar, alert, self, token, settings, jobs, health, entity
│  │  ├─ services/                     # domain logic, pure-ish, injected deps, unit-testable
│  │  │  ├─ wallet/                    # registry CRUD, tagging, computed label, profile stats
│  │  │  ├─ ingestion/                 # endpoint fetch → normalize → group-replace persist
│  │  │  ├─ pricing/                   # PriceSnapshot writes, swap-derived pricing, USD attribution
│  │  │  ├─ funding/                   # funding-tree builder, terminal stops, primary-wallet detector
│  │  │  ├─ cluster/                   # shared-funder clustering, cluster state, rotation
│  │  │  ├─ interaction/               # per-pair/per-token edge aggregation for the graph
│  │  │  ├─ independence/              # WalletRelation computation + verdict rendering data
│  │  │  ├─ movement/                  # MovementEvent classification, feed queries, netflow, breadth
│  │  │  ├─ position/                  # position/PnL accounting (cost basis, unrealized, drawdown)
│  │  │  ├─ radar/                     # co-accumulation / co-distribution / cluster co-entry grouping
│  │  │  ├─ alert/                     # rule evaluation orchestration, state machine, dedupe, delivery
│  │  │  ├─ self/                      # user-trade linking, lag metrics, edge decay, comparisons
│  │  │  ├─ token/                     # token metadata, red flags, holder concentration, lookup panel
│  │  │  ├─ entity/                    # EntityLabel lookup/seed/user labels, terminal classification
│  │  │  ├─ settings/                  # typed settings read/write with Zod validation + cache
│  │  │  └─ maintenance/               # prune, backup metadata, quota reporting, resync
│  │  ├─ workers/
│  │  │  ├─ main.ts                    # worker process entrypoint (separate container/process)
│  │  │  ├─ queues.ts                  # queue instances, default job options, deterministic job IDs
│  │  │  ├─ schedules.ts               # repeatable jobs (radar cadence, sync scheduler, balances)
│  │  │  └─ processors/                # one file per job name, thin: parse payload → call service
│  │  └─ db/
│  │     ├─ client.ts                  # PrismaClient singleton + PrismaPg driver adapter
│  │     └─ repositories/              # raw-SQL/bulk helpers where Prisma is too slow (upserts, rollups)
│  │
│  ├─ lib/                             # framework-agnostic building blocks, no DB writes
│  │  ├─ chains/
│  │  │  ├─ types.ts                   # ChainAdapter + raw record types (NFR-9 boundary)
│  │  │  ├─ registry.ts                # chain slug → {chainId, native symbol, explorer, adapter}
│  │  │  ├─ etherscan-v2-adapter.ts    # Base/BSC adapter over the shared V2 client
│  │  │  ├─ robinhood-adapter.ts       # Robinhood provider chosen and proved in P0-T18
│  │  │  └─ mock-adapter.ts            # fixture-backed adapter for tests and offline dev
│  │  ├─ etherscan/                    # low-level V2 client: endpoints, pagination, error taxonomy
│  │  ├─ dexscreener/                  # price/marketcap/liquidity client + batch token lookups
│  │  ├─ coingecko/                    # optional historical price client (best-effort)
│  │  ├─ ratelimit/                    # Redis token bucket (Lua), daily budget guard, usage snapshots
│  │  ├─ queue/                        # queue names, job payload/progress contracts, progress helpers
│  │  ├─ rules/                        # A1–A6, T1–T5, C1–C4 as pure functions + registry + evidence
│  │  ├─ format/                       # address checksum/truncate, USD, timezone-aware time, label
│  │  ├─ env.ts                        # Zod-validated process env (fails fast at boot)
│  │  ├─ settings-schema.ts            # Zod schema + defaults for every Setting key
│  │  ├─ logger.ts                     # structured local logger, no remote sinks (NFR-1)
│  │  └─ errors.ts                     # typed app errors mapped to tRPC codes and job failures
│  │
│  ├─ components/
│  │  ├─ ui/                           # shadcn/ui primitives (generated)
│  │  ├─ shared/                       # DataTable, AddressChip, UsdCell, TimeCell, StateBadge, JobProgress
│  │  ├─ wallets/                      # WalletTable, TagEditor, LabelPreview, ActivityHeatmap, ParkingTimeline
│  │  ├─ funding/                      # FundingTree, FundingNode, DeepTraceButton, PrimaryWalletBadge
│  │  ├─ graph/                        # GraphCanvas (Cytoscape), GraphFilters, EdgeBreakdownPanel,
│  │  │                                #   NodeSidePanel, IndependenceVerdict, PngExportButton
│  │  ├─ radar/                        # MovementFeed, MovementGroupCard, ClusterCoEntryCard,
│  │  │                                #   NetflowTable, BreadthIndicator, RotationTimeline
│  │  ├─ alerts/                       # AlertList, AlertFilters, EvidenceTooltip, UnreadBadge
│  │  ├─ self/                         # TradeLogForm, EdgeDecayChart, PnlBreakdown, ComparisonTable
│  │  ├─ tokens/                       # TokenLookupForm, HolderTable, RedFlagList, TokenNetflowChart
│  │  └─ settings/                     # ThresholdForm, StableListEditor, EntityLabelEditor, TelegramForm
│  │
│  ├─ generated/prisma/                # Prisma 7 generated client output (gitignored)
│  └─ types/                           # shared cross-layer DTO types not owned by Prisma or tRPC
│
└─ tests/
   ├─ unit/                            # pure logic: rules, funding, independence, pricing, pagination
   ├─ integration/                     # service + real Postgres/Redis (docker-compose.test.yml)
   ├─ e2e/                             # Playwright phase-acceptance specs (one file per phase)
   ├─ fixtures/
   │  ├─ etherscan/                    # recorded V2 responses per (chain, address, endpoint, page)
   │  ├─ dexscreener/                  # recorded price/pair payloads
   │  └─ scenarios/                    # composed worlds: cluster-of-3, cex-funded, co-entry-24h, …
   └─ helpers/                         # db reset, queue drain, fixture loaders, fake clock
```

**Boundary rules (enforced by review, and by ESLint `no-restricted-imports`):**

1. `src/components/**` may import from `src/lib/format/**` and generated tRPC types only — never from `src/server/**`.
2. `src/server/services/**` is the only place that writes to the database. `src/lib/**` never touches Prisma.
3. `src/server/workers/processors/**` contains no business logic — parse payload, call one service method, report progress.
4. Chain-specific strings (chain IDs, explorer URLs, native symbols, endpoint names) exist **only** in `src/lib/chains/**` and `src/lib/etherscan/**` (NFR-9, SRS §10.9).
5. `src/lib/rules/**` is pure: no I/O, no clock access except an injected clock — this is what makes A1–C4 unit-testable (FR-5.5 evidence must be reproducible).

---

## 3. Data Layer

### 3.1 Design decisions before the schema

These are the non-obvious choices an executor must not re-litigate.

1. **Composite natural keys, no surrogate IDs where the SRS gives a key.** `Wallet` PK is `(address, chain)` exactly as SRS §4 states. Addresses are stored **lowercase hex** (`0x` + 40 chars) everywhere; EIP-55 checksum casing is a display concern produced by `src/lib/format`. Every write path lowercases before persisting. This is what makes idempotent upserts possible (NFR-3).
2. **`Decimal` for money, `String` for raw token amounts.** `amountRaw` is a base-unit integer that can exceed 2^63 (18-decimal tokens with huge supplies), so it is `String` — SRS §4 names the field `amountRaw` and does not fix its type. All USD values are `Decimal(38, 8)`; all ratios/percentages are `Decimal(18, 8)`. Never `Float` for money.
3. **Transaction natural key includes an ordinal.** SRS §4 lists `Transaction { hash, chain, … }`, but a single hash yields one normal tx, N internal traces, and M ERC-20 log transfers. The natural key is therefore `(chain, hash, kind, ordinal)` where `ordinal` = `logIndex` for `ERC20`, the trace position for `INTERNAL`, and `0` for `NATIVE`. `@@unique` on that tuple is what NFR-3's "upsert by natural key" targets. `logIndex` and `traceId` are retained as raw provenance.
4. **USD is attributed at ingest and stored on the row** (SRS §10.3): `Transaction.amountUsd` is written by the ingestion/pricing pipeline, never computed in a query or in React. `PriceSnapshot` records the price that was used, with its `source` and `confidence`, so the number is auditable. Rows whose USD could not be determined store `amountUsd = null` and `usdSource = UNKNOWN`; the UI renders `—` and every threshold rule treats `null` as "does not satisfy a ≥ comparison" (never as zero).
5. **Derived read models are tables, not views.** `MovementEvent`, `InteractionEdge`, `WalletRelation`, `FundingEdge`, `Position`, `DailyFlow`, and `BalanceSnapshot` are materialized by workers because NFR-7 budgets (wallet list < 500 ms, 300-node graph, 50-row feed pages) cannot be met by recomputing multi-million-row aggregations per request, and because FR-4.2/FR-3.6 independence and FR-5 thresholds must be reproducible and evidenced (SRS §10.6, §10.7). Every derived table is rebuildable from `Transaction` + `PriceSnapshot` by an idempotent job.
6. **The SRS enum values are preserved verbatim.** Where extra state is needed (e.g. FR-2.4's `repeated funder (candidate primary)` and `profit sink (candidate primary)`), it is expressed as **additional boolean/decimal columns**, not by mutating the SRS's `FundingEdge.kind` enum. `DECISION:` this keeps SRS §4 literal while satisfying FR-2.4's three-way labeling.
7. **`Chain` is an enum.** Adding a chain (or Solana in Phase 7) is an additive migration plus a `src/lib/chains/registry.ts` entry — the `ChainAdapter` boundary (NFR-9) means no other file changes.
8. **JSON columns are typed at the edge.** Every `Json` field (`payloadJson`, `evidenceJson`, `statsJson`, `valueJson`, …) has a Zod v4 schema in `src/lib/**` that is parsed on read and validated on write. Untyped JSON is not permitted to leak into components.

### 3.2 `prisma/schema.prisma` (complete)

```prisma
// Watchtower — local-first onchain wallet intelligence.
// Source of truth for the data model. All timestamps are UTC (SRS §10.8).
// All addresses are stored lowercase hex. Money is Decimal, raw amounts are String.

generator client {
  provider        = "prisma-client"
  output          = "../src/generated/prisma"
  previewFeatures = []
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

/// Product-owner-approved EVM scope for v1 (§0 D-1).
/// Extending this list is an additive migration + a registry entry (NFR-9).
enum Chain {
  BASE
  BSC
  ROBINHOOD
}

/// FR-1.5 manual tags.
enum WalletEdgeTag {
  SMART
  INSIDER
  EARLY
  BOT
  KOL
  DEGEN
  FRESH
  DEV
}

enum WalletStyleTag {
  SNIPER
  JEET
  RIDER
  SWING
  DIAMOND
}

enum WalletSizeTag {
  W
  M
  S
}

enum WatchPriority {
  HIGH
  NORMAL
}

/// SRS §4 EntityLabel.kind
enum EntityKind {
  CEX
  BRIDGE
  ROUTER
  CONTRACT
  HUMAN
}

/// SRS §4 EntityLabel.source
enum LabelSource {
  BUNDLED
  USER
}

/// SRS §4 Transaction.kind
enum TxKind {
  NATIVE
  ERC20
  INTERNAL
}

/// SRS §4 Transaction.txType
enum TxType {
  TRANSFER
  SWAP
  DEPLOY
}

/// Provenance of a persisted USD value (SRS §10.3 auditability).
enum UsdSource {
  SWAP_LEG_STABLE   // derived from the stablecoin leg of the same tx
  SWAP_LEG_NATIVE   // derived from the native leg of the same tx × native USD price
  DEXSCREENER       // token price from DexScreener at ingest time
  COINGECKO         // optional historical fallback (best-effort)
  STABLE_PAR        // the asset is a configured stablecoin, valued 1:1
  NATIVE_PRICE      // native asset valued at its own snapshot price
  UNKNOWN           // no price could be attributed; amountUsd stays null
}

enum PriceConfidence {
  HIGH     // same-tx leg, or snapshot within 5 minutes of the event
  MEDIUM   // snapshot within 1 hour, or pair-level price at ingest
  LOW      // coarse/interpolated/daily granularity
}

/// SRS §4 FundingEdge.kind. Candidate states are separate booleans (see §3.1.6).
enum FundingEdgeKind {
  INITIAL
  REPEATED
  PROFIT_SINK
  PRIMARY
}

/// Why recursion stopped at a funding node (FR-2.2, FR-2.7).
enum TraceStopReason {
  TERMINAL_ENTITY
  DEPTH_LIMIT
  NO_INBOUND
  SELF_REFERENCE
  BUDGET_EXHAUSTED
  NOT_STOPPED
}

/// FR-5 wallet state machine.
enum WalletAlertState {
  IDLE
  ARMED
  TRIGGERED
}

/// SRS §4 AlertEvent.state
enum AlertState {
  ARMED
  TRIGGERED
  EXIT_RISK
}

/// SRS §5 Module 5 rule identifiers, A1..C4 verbatim.
enum AlertType {
  A1
  A2
  A3
  A4
  A5
  A6
  T1
  T2
  T3
  T4
  T5
  C1
  C2
  C3
  C4
}

/// SRS §4 MovementGroup.kind
enum MovementGroupKind {
  CO_ACCUMULATION
  CO_DISTRIBUTION
  CLUSTER_CO_ENTRY
}

/// FR-4.1 movement feed action taxonomy.
enum MovementKind {
  BUY
  SELL
  STABLE_PARK
  STABLE_SPEND
  CEX_DEPOSIT
  CEX_WITHDRAWAL
  NEW_TOKEN_ENTRY
  NATIVE_FUNDING_IN
  NATIVE_FUNDING_OUT
}

/// FR-6 trade side.
enum TradeSide {
  BUY
  SELL
}

enum TradeSource {
  AUTO
  MANUAL
}

/// How a WalletRelation was established (FR-3.6, FR-4.2 independence inputs).
enum RelationKind {
  SHARED_FUNDER
  DIRECT_TRANSFER
  CO_ENTRY
  SAME_CLUSTER
}

enum SyncStatus {
  NEVER_SYNCED
  QUEUED
  RUNNING
  IDLE
  FAILED
}

/// Endpoint-level cursors: each Etherscan endpoint paginates independently.
enum SyncEndpoint {
  NORMAL_TX
  INTERNAL_TX
  ERC20_TRANSFER
}

enum JobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
}

enum FlowDirection {
  IN
  OUT
}

// ─────────────────────────────────────────────────────────────────────────────
// Module 1 — Wallet registry & watchlist (FR-1.x)
// ─────────────────────────────────────────────────────────────────────────────

/// A watchlist wallet. PK (address, chain) per SRS §4.
model Wallet {
  address        String
  chain          Chain
  ensName        String?
  label          String?
  edge           WalletEdgeTag?
  style          WalletStyleTag?
  size           WalletSizeTag?
  notes          String?
  isBlacklisted  Boolean         @default(false)
  isSelf         Boolean         @default(false)
  watchPriority  WatchPriority   @default(NORMAL)
  firstTxAt      DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  profile        WalletProfile?
  syncState      SyncState?
  alertState     WalletState?
  clusterLinks   ClusterMember[]
  fundingIn      FundingEdge[]   @relation("FundingChild")
  fundingOut     FundingEdge[]   @relation("FundingParent")
  movements      MovementEvent[]
  alerts         AlertEvent[]
  positions      Position[]
  balances       BalanceSnapshot[]
  dailyFlows     DailyFlow[]
  edgesA         InteractionEdge[] @relation("EdgeWalletA")
  edgesB         InteractionEdge[] @relation("EdgeWalletB")
  relationsFrom  WalletRelation[]  @relation("RelationFrom")
  relationsTo    WalletRelation[]  @relation("RelationTo")
  groupMembers   MovementGroupMember[]
  ownTrades      UserTrade[]       @relation("TradeOwner")
  followedTrades UserTrade[]       @relation("TradeFollowed")

  @@id([address, chain])
  @@index([chain])
  @@index([watchPriority, chain])
  @@index([isSelf])
  @@index([isBlacklisted])
  @@index([updatedAt])
}

/// FR-1.4 computed profile stats, kept out of Wallet so the list query stays
/// narrow (NFR-7: wallet list < 500 ms). Rebuilt by the intake/refresh job.
model WalletProfile {
  walletAddress        String
  walletChain          Chain
  firstTxAt            DateTime?
  firstMemecoinTradeAt DateTime?
  walletAgeDaysAtFirstMemecoinTrade Int?
  txCount              Int       @default(0)
  distinctTokenCount   Int       @default(0)
  stableBalanceUsd     Decimal   @db.Decimal(38, 8) @default(0)
  nativeBalanceRaw     String    @default("0")
  nativeBalanceUsd     Decimal?  @db.Decimal(38, 8)
  lastActivityAt       DateTime?
  dormantSince         DateTime?
  /// Zod-validated object with both FR-1.4 views (§0 D-8):
  /// habitual[7][24] over full history and recent7d[7][24], plus timezone/window.
  heatmapJson          Json
  /// Phase 6 auto-grade block: winRate, realizedPnlUsd, entryTimingRatio, sampleSize.
  gradeJson            Json?
  computedAt           DateTime  @default(now())

  wallet Wallet @relation(fields: [walletAddress, walletChain], references: [address, chain], onDelete: Cascade)

  @@id([walletAddress, walletChain])
  @@index([lastActivityAt])
  @@index([stableBalanceUsd])
}

/// FR-2.3 bundled + user-managed address labels. Terminal classification for
/// funding traces derives from `kind` (FR-2.2).
model EntityLabel {
  address   String
  chain     Chain
  kind      EntityKind
  name      String
  source    LabelSource
  /// True when recursion must stop here (CEX/BRIDGE/ROUTER/CONTRACT by default;
  /// HUMAN never terminal). User can override per FR-2.3.
  isTerminal Boolean    @default(true)
  notes     String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@id([address, chain])
  @@index([kind])
  @@index([source])
  @@index([address])
}
```
```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Ingested chain data (source of local truth)
// ─────────────────────────────────────────────────────────────────────────────

/// Every normal tx, internal trace, and ERC-20 transfer touching a tracked
/// wallet or any node discovered during a funding trace.
/// Natural key: (chain, hash, kind, ordinal) — see §3.1.3. NFR-3 upsert target.
model Transaction {
  id            BigInt   @id @default(autoincrement())
  hash          String
  chain         Chain
  blockNumber   BigInt
  timestamp     DateTime
  fromAddress   String
  toAddress     String?
  tokenAddress  String?
  kind          TxKind
  amountRaw     String
  amountUsd     Decimal? @db.Decimal(38, 8)
  txType        TxType   @default(TRANSFER)

  /// Disambiguates multiple records under one hash (logIndex / trace position / 0).
  ordinal       Int      @default(0)
  logIndex      Int?
  traceId       String?
  tokenDecimals Int?
  tokenSymbol   String?
  gasUsed       String?
  gasPriceWei   String?
  feeUsd        Decimal? @db.Decimal(38, 8)
  isError       Boolean  @default(false)
  methodId      String?
  functionName  String?
  contractCreated String?

  /// USD provenance (SRS §10.3 auditability).
  usdSource     UsdSource        @default(UNKNOWN)
  usdConfidence PriceConfidence?
  priceUsdUsed  Decimal?         @db.Decimal(38, 18)

  /// True when this row is part of a swap the pricing service reconciled.
  swapGroupKey  String?

  ingestedAt    DateTime @default(now())

  token         Token?          @relation(fields: [tokenAddress, chain], references: [address, chain])
  movements     MovementEvent[]

  @@unique([chain, hash, kind, ordinal], name: "tx_natural_key")
  @@index([fromAddress, timestamp])
  @@index([toAddress, timestamp])
  @@index([tokenAddress, timestamp])
  @@index([chain, blockNumber])
  @@index([timestamp])
  @@index([swapGroupKey])
  @@index([chain, fromAddress, kind, timestamp])
  @@index([chain, toAddress, kind, timestamp])
}

/// SRS §4 Token. `isStable`/`isNative` are cached from the settings stable list
/// so hot queries do not re-read settings (FR-2.5).
model Token {
  address       String
  chain         Chain
  symbol        String?
  name          String?
  decimals      Int?
  deployedAt    DateTime?
  deployerAddress String?
  pairCreatedAt DateTime?
  firstSeenAt   DateTime  @default(now())
  isStable      Boolean   @default(false)
  isNative      Boolean   @default(false)
  /// Cached DexScreener discovery result: primary pair, dex, quote token.
  primaryPairAddress String?
  /// FR-7.2 red-flag inputs refreshed on lookup: top-10 holder share, holderCount.
  redFlagJson   Json?
  redFlagCheckedAt DateTime?
  latestPriceUsd Decimal? @db.Decimal(38, 18)
  latestMarketCap Decimal? @db.Decimal(38, 8)
  latestPriceAt DateTime?
  updatedAt     DateTime  @updatedAt

  transactions   Transaction[]
  priceSnapshots PriceSnapshot[]
  movements      MovementEvent[]
  groups         MovementGroup[]
  positions      Position[]
  dailyFlows     DailyFlow[]
  trades         UserTrade[]

  @@id([address, chain])
  @@index([symbol])
  @@index([deployedAt])
  @@index([isStable])
  @@index([deployerAddress])
}

/// SRS §4 PriceSnapshot. Written at ingest; never derived at render time (§10.3).
model PriceSnapshot {
  id            BigInt          @id @default(autoincrement())
  tokenAddress  String
  chain         Chain
  timestamp     DateTime
  priceUsd      Decimal         @db.Decimal(38, 18)
  marketCap     Decimal?        @db.Decimal(38, 8)
  liquidityUsd  Decimal?        @db.Decimal(38, 8)
  fdvUsd        Decimal?        @db.Decimal(38, 8)
  source        UsdSource
  confidence    PriceConfidence
  /// Set when this snapshot was produced to price one specific event.
  txHash        String?
  createdAt     DateTime        @default(now())

  token Token @relation(fields: [tokenAddress, chain], references: [address, chain], onDelete: Cascade)

  @@unique([tokenAddress, chain, timestamp, source], name: "price_snapshot_natural_key")
  @@index([tokenAddress, chain, timestamp])
  @@index([timestamp])
}

/// Native-asset USD price per chain, needed to value native/gas funding in USD
/// (A2, A4, FR-2.1 cumulative USD funded).
model NativePriceSnapshot {
  id         BigInt          @id @default(autoincrement())
  chain      Chain
  timestamp  DateTime
  priceUsd   Decimal         @db.Decimal(38, 18)
  source     UsdSource
  confidence PriceConfidence

  @@unique([chain, timestamp, source])
  @@index([chain, timestamp])
}

/// Per-wallet, per-endpoint sync cursor (NFR-4). SRS §4 SyncState fields are
/// preserved; `endpoint` exists because each Etherscan endpoint paginates
/// independently and can stall at different blocks (§10.5).
model SyncState {
  walletAddress   String
  chain           Chain
  lastSyncedBlock BigInt     @default(0)
  lastSyncedAt    DateTime?
  status          SyncStatus @default(NEVER_SYNCED)
  lastError       String?
  /// Per-endpoint cursors + last page reached, Zod-validated
  /// { NORMAL_TX: { lastBlock, exhausted }, INTERNAL_TX: {...}, ERC20_TRANSFER: {...} }.
  cursorsJson     Json?
  fullSyncDoneAt  DateTime?
  totalRecords    Int        @default(0)
  updatedAt       DateTime   @updatedAt

  wallet Wallet @relation(fields: [walletAddress, chain], references: [address, chain], onDelete: Cascade)

  @@id([walletAddress, chain])
  @@index([status])
  @@index([lastSyncedAt])
}

/// Balance history for stablecoins and native assets. Powers A1/A2 medians,
/// C4 peak-drop detection, de-arm baselines, and FR-2.5 parked balances.
model BalanceSnapshot {
  id            BigInt   @id @default(autoincrement())
  walletAddress String
  chain         Chain
  /// Null tokenAddress = native asset of the chain.
  tokenAddress  String?
  timestamp     DateTime
  balanceRaw    String
  balanceUsd    Decimal? @db.Decimal(38, 8)
  isStable      Boolean  @default(false)

  wallet Wallet @relation(fields: [walletAddress, chain], references: [address, chain], onDelete: Cascade)

  @@unique([walletAddress, chain, tokenAddress, timestamp])
  @@index([walletAddress, chain, timestamp])
  @@index([timestamp])
}

/// Per-wallet per-token per-day IN/OUT rollup in USD. Backs A1/A2 median
/// baselines, FR-4.5 netflow, and FR-4.7 breadth without scanning Transaction.
model DailyFlow {
  id            BigInt        @id @default(autoincrement())
  walletAddress String
  chain         Chain
  /// Null tokenAddress = native asset.
  tokenAddress  String?
  day           DateTime      @db.Date
  direction     FlowDirection
  amountUsd     Decimal       @db.Decimal(38, 8) @default(0)
  amountRaw     String        @default("0")
  eventsCount   Int           @default(0)
  isStable      Boolean       @default(false)
  isCexCounterparty Boolean   @default(false)

  wallet Wallet @relation(fields: [walletAddress, chain], references: [address, chain], onDelete: Cascade)
  token  Token? @relation(fields: [tokenAddress, chain], references: [address, chain])

  @@unique([walletAddress, chain, tokenAddress, day, direction, isCexCounterparty], name: "daily_flow_key")
  @@index([walletAddress, chain, day])
  @@index([tokenAddress, chain, day])
  @@index([day])
}
```
```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Module 2 — Funding tracer & clusters (FR-2.x)
// ─────────────────────────────────────────────────────────────────────────────

/// One aggregated funding relationship: parent funded child.
/// SRS §4 fields preserved verbatim; FR-2.4 candidate states added as columns.
model FundingEdge {
  id             BigInt          @id @default(autoincrement())
  childAddress   String
  childChain     Chain
  parentAddress  String
  parentChain    Chain
  totalUsd       Decimal         @db.Decimal(38, 8) @default(0)
  eventsCount    Int             @default(0)
  firstAt        DateTime?
  lastAt         DateTime?
  kind           FundingEdgeKind @default(INITIAL)

  /// FR-2.1: depth in the trace tree from the tracked root (root's funders = 1).
  depth          Int             @default(1)
  /// The tracked wallet this tree belongs to (a node can appear in several trees).
  rootAddress    String
  rootChain      Chain
  /// FR-2.1: internal transactions counted separately for evidence (§10.4).
  internalEventsCount Int        @default(0)
  nativeEventsCount   Int        @default(0)
  /// FR-2.4 condition A: repeated funder or first-gas + ≥1 later funding.
  isRepeatedFunder   Boolean     @default(false)
  fundedFirstGas     Boolean     @default(false)
  /// FR-2.4 condition B: profit sink.
  isProfitSink       Boolean     @default(false)
  profitSinkRatio    Decimal?    @db.Decimal(18, 8)
  isLargestOutflowDestination Boolean @default(false)
  /// Both conditions → PRIMARY WALLET (warning badge).
  isPrimaryWallet    Boolean     @default(false)
  /// FR-2.2 terminal-entity stop bookkeeping.
  isTerminalEntity   Boolean     @default(false)
  entityName         String?
  stopReason         TraceStopReason @default(NOT_STOPPED)
  /// FR-2.7 deep-trace: set when a user extended this branch past the default depth.
  deepTracedAt       DateTime?
  computedAt         DateTime    @default(now())

  child  Wallet  @relation("FundingChild",  fields: [childAddress, childChain],  references: [address, chain], onDelete: Cascade)
  parent Wallet? @relation("FundingParent", fields: [parentAddress, parentChain], references: [address, chain])

  @@unique([rootAddress, rootChain, childAddress, childChain, parentAddress, parentChain], name: "funding_edge_key")
  @@index([childAddress, childChain])
  @@index([parentAddress, parentChain])
  @@index([rootAddress, rootChain, depth])
  @@index([isPrimaryWallet])
}

/// Every address met during a trace, tracked or not. Lets the tree render
/// non-watchlist funders and lets FR-2.6 find shared funders cheaply.
model FundingNode {
  address        String
  chain          Chain
  isTracked      Boolean         @default(false)
  entityKind     EntityKind?
  entityName     String?
  isTerminal     Boolean         @default(false)
  /// Highest depth at which this node was expanded (for FR-2.7 resumption).
  maxExpandedDepth Int           @default(0)
  lastExpandedAt DateTime?
  stopReason     TraceStopReason @default(NOT_STOPPED)
  inboundFetchedAt DateTime?

  @@id([address, chain])
  @@index([isTerminal])
  @@index([isTracked])
}

/// FR-2.6 shared-funder cluster. SRS §4 fields preserved.
model Cluster {
  id            String   @id @default(cuid())
  name          String
  funderAddress String
  funderChain   Chain
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  /// Stable UI color assigned at creation (FR-2.6/FR-3.5 color coding).
  colorHex      String
  /// FR-2.6 rollups, refreshed by the cluster job.
  combinedStableUsd Decimal @db.Decimal(38, 8) @default(0)
  memberCount   Int      @default(0)
  lastActivityAt DateTime?
  /// A5 cluster-level ARMED badge.
  isArmed       Boolean  @default(false)
  armedAt       DateTime?

  members   ClusterMember[]
  rotations ClusterRotation[]

  @@unique([funderAddress, funderChain])
  @@index([isArmed])
}

/// SRS §4 ClusterMember.
model ClusterMember {
  clusterId     String
  walletAddress String
  walletChain   Chain
  joinedAt      DateTime @default(now())

  cluster Cluster @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  wallet  Wallet  @relation(fields: [walletAddress, walletChain], references: [address, chain], onDelete: Cascade)

  @@id([clusterId, walletAddress, walletChain])
  @@index([walletAddress, walletChain])
}

/// FR-4.6 cluster rotation record: exits from token set A → entries into set B
/// inside a 7-day window.
model ClusterRotation {
  id           String   @id @default(cuid())
  clusterId    String
  windowStart  DateTime
  windowEnd    DateTime
  /// [{ tokenAddress, chain, symbol, usd }] — Zod-validated.
  exitedJson   Json
  enteredJson  Json
  exitedUsd    Decimal  @db.Decimal(38, 8) @default(0)
  enteredUsd   Decimal  @db.Decimal(38, 8) @default(0)
  computedAt   DateTime @default(now())

  cluster Cluster @relation(fields: [clusterId], references: [id], onDelete: Cascade)

  @@unique([clusterId, windowStart, windowEnd])
  @@index([windowStart])
}

// ─────────────────────────────────────────────────────────────────────────────
// Module 3 — Interaction graph & independence (FR-3.x)
// ─────────────────────────────────────────────────────────────────────────────

/// FR-3.2 one row per tracked-wallet pair, aggregated (never per tx).
/// Canonical ordering: addressA < addressB lexicographically (with chain as
/// tiebreaker) so a pair has exactly one row.
model InteractionEdge {
  id           BigInt   @id @default(autoincrement())
  addressA     String
  chainA       Chain
  addressB     String
  chainB       Chain
  totalUsd     Decimal  @db.Decimal(38, 8) @default(0)
  txCount      Int      @default(0)
  usdAToB      Decimal  @db.Decimal(38, 8) @default(0)
  usdBToA      Decimal  @db.Decimal(38, 8) @default(0)
  countAToB    Int      @default(0)
  countBToA    Int      @default(0)
  firstAt      DateTime?
  lastAt       DateTime?
  /// Ticker + USD of the largest-value token on this edge (FR-3.3 edge label).
  topTokenAddress String?
  topTokenSymbol  String?
  topTokenUsd     Decimal? @db.Decimal(38, 8)
  distinctTokenCount Int   @default(0)
  computedAt   DateTime @default(now())

  walletA Wallet @relation("EdgeWalletA", fields: [addressA, chainA], references: [address, chain], onDelete: Cascade)
  walletB Wallet @relation("EdgeWalletB", fields: [addressB, chainB], references: [address, chain], onDelete: Cascade)
  tokens  InteractionEdgeToken[]

  @@unique([addressA, chainA, addressB, chainB], name: "interaction_edge_key")
  @@index([totalUsd])
  @@index([lastAt])
}

/// FR-3.3 per-token breakdown behind an edge (panel data), and FR-3.4 token filter.
model InteractionEdgeToken {
  id            BigInt   @id @default(autoincrement())
  edgeId        BigInt
  /// Null tokenAddress = native asset transfer.
  tokenAddress  String?
  chain         Chain
  tokenSymbol   String?
  totalUsd      Decimal  @db.Decimal(38, 8) @default(0)
  txCount       Int      @default(0)
  usdAToB       Decimal  @db.Decimal(38, 8) @default(0)
  usdBToA       Decimal  @db.Decimal(38, 8) @default(0)
  firstAt       DateTime?
  lastAt        DateTime?
  /// Up to 25 most recent { hash, timestamp, direction, amountRaw, amountUsd }
  /// for the breakdown panel's tx links (FR-3.3, §10.8 evidence).
  sampleTxsJson Json?

  edge InteractionEdge @relation(fields: [edgeId], references: [id], onDelete: Cascade)

  @@unique([edgeId, tokenAddress])
  @@index([tokenAddress, chain])
}

/// FR-3.6 / FR-4.2: independence is a computed, stored relation (§10.7).
/// Absence of any row between two wallets = mutually independent.
model WalletRelation {
  id           BigInt       @id @default(autoincrement())
  fromAddress  String
  fromChain    Chain
  toAddress    String
  toChain      Chain
  kind         RelationKind
  /// Human-readable claim rendered verbatim by the verdict panel, e.g.
  /// "Connected to 0xab… via direct transfers (23 txs, $45K)".
  statement    String
  /// Rule inputs: shared funder address, tx counts, USD, co-entry token list.
  detailJson   Json
  strengthUsd  Decimal?     @db.Decimal(38, 8)
  eventsCount  Int          @default(0)
  firstAt      DateTime?
  lastAt       DateTime?
  computedAt   DateTime     @default(now())

  fromWallet Wallet @relation("RelationFrom", fields: [fromAddress, fromChain], references: [address, chain], onDelete: Cascade)
  toWallet   Wallet @relation("RelationTo",   fields: [toAddress, toChain],     references: [address, chain], onDelete: Cascade)

  @@unique([fromAddress, fromChain, toAddress, toChain, kind], name: "wallet_relation_key")
  @@index([fromAddress, fromChain])
  @@index([kind])
}
```
```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Module 4 — Movement radar (FR-4.x)
// ─────────────────────────────────────────────────────────────────────────────

/// FR-4.1 one classified, USD-priced watchlist action. The radar and the alert
/// engine read this table only — never raw Transaction — so both see identical,
/// already-priced facts, and every row links back to its tx (FR-4.8).
model MovementEvent {
  id             BigInt       @id @default(autoincrement())
  walletAddress  String
  walletChain    Chain
  kind           MovementKind
  timestamp      DateTime
  tokenAddress   String?
  tokenChain     Chain?
  tokenSymbol    String?
  amountRaw      String
  amountUsd      Decimal?     @db.Decimal(38, 8)
  /// FR-4.1 row context, captured at ingest (§10.3).
  marketCapAtAction Decimal?  @db.Decimal(38, 8)
  priceUsdAtAction  Decimal?  @db.Decimal(38, 18)
  tokenAgeSeconds   BigInt?
  /// Counterparty context for CEX_DEPOSIT / CEX_WITHDRAWAL / transfers.
  counterpartyAddress String?
  counterpartyEntityName String?
  isFirstEntryForWallet Boolean @default(false)
  transactionId  BigInt
  txHash         String
  blockNumber    BigInt
  usdSource      UsdSource    @default(UNKNOWN)
  usdConfidence  PriceConfidence?
  /// Set once the radar has evaluated this row (drives incremental evaluation).
  radarEvaluatedAt DateTime?
  alertEvaluatedAt DateTime?
  createdAt      DateTime     @default(now())

  wallet      Wallet      @relation(fields: [walletAddress, walletChain], references: [address, chain], onDelete: Cascade)
  transaction Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  token       Token?      @relation(fields: [tokenAddress, tokenChain], references: [address, chain])
  groupLinks  MovementGroupMember[]

  @@unique([transactionId, kind, walletAddress], name: "movement_event_key")
  @@index([timestamp])
  @@index([walletAddress, walletChain, timestamp])
  @@index([tokenAddress, tokenChain, timestamp])
  @@index([kind, timestamp])
  @@index([radarEvaluatedAt])
  @@index([alertEvaluatedAt])
}

/// SRS §4 MovementGroup — FR-4.2 / FR-4.3 / FR-4.4.
model MovementGroup {
  id            String            @id @default(cuid())
  tokenAddress  String
  chain         Chain
  kind          MovementGroupKind
  windowStart   DateTime
  windowEnd     DateTime
  combinedUsd   Decimal           @db.Decimal(38, 8) @default(0)
  walletCount   Int               @default(0)

  /// FR-4.2 extras: configured window label ("24h"), supply share, span.
  windowLabel   String
  supplySharePct Decimal?         @db.Decimal(18, 8)
  timeSpanSeconds Int             @default(0)
  /// FR-4.4: set for CLUSTER_CO_ENTRY so the UI can style it as a warning.
  clusterId     String?
  /// Evidence: rule id, thresholds, independence proof per pair (§10.6, §10.7).
  evidenceJson  Json
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  token   Token                 @relation(fields: [tokenAddress, chain], references: [address, chain], onDelete: Cascade)
  members MovementGroupMember[]

  @@unique([tokenAddress, chain, kind, windowStart, windowLabel], name: "movement_group_key")
  @@index([tokenAddress, windowStart])
  @@index([kind, windowStart])
  @@index([createdAt])
}

/// Group membership with the wallet's grade snapshot at detection time
/// (FR-4.2 "participating wallets (with grades)").
model MovementGroupMember {
  groupId       String
  walletAddress String
  walletChain   Chain
  movementId    BigInt
  amountUsd     Decimal? @db.Decimal(38, 8)
  actedAt       DateTime
  /// Frozen label at detection time, e.g. "SMART-RIDER [W]" (FR-1.6).
  gradeLabel    String?

  group    MovementGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  wallet   Wallet        @relation(fields: [walletAddress, walletChain], references: [address, chain], onDelete: Cascade)
  movement MovementEvent @relation(fields: [movementId], references: [id], onDelete: Cascade)

  @@id([groupId, walletAddress, walletChain, movementId])
  @@index([walletAddress, walletChain])
}

// ─────────────────────────────────────────────────────────────────────────────
// Module 5 — Alert engine & wallet state machine (FR-5.x)
// ─────────────────────────────────────────────────────────────────────────────

/// Current state of the IDLE → ARMED → TRIGGERED machine per wallet.
model WalletState {
  walletAddress String
  walletChain   Chain
  state         WalletAlertState @default(IDLE)
  armedAt       DateTime?
  triggeredAt   DateTime?
  /// Rule that produced the current state (A1..A6 / T1..T5).
  stateReason   AlertType?
  /// Peak stable balance since arming, for C4's ">70% drop from recent peak".
  stablePeakUsd Decimal?         @db.Decimal(38, 8)
  stablePeakAt  DateTime?
  /// 30-day baseline used by the de-arm rule, refreshed daily.
  baselineStableUsd Decimal?     @db.Decimal(38, 8)
  baselineNativeUsd Decimal?     @db.Decimal(38, 8)
  /// Consecutive days at/below 120% of baseline (de-arm needs 7).
  deArmStreakDays Int            @default(0)
  lastEvaluatedAt DateTime?
  updatedAt     DateTime         @updatedAt

  wallet Wallet @relation(fields: [walletAddress, walletChain], references: [address, chain], onDelete: Cascade)

  @@id([walletAddress, walletChain])
  @@index([state])
}

/// SRS §4 AlertEvent — FR-5.1. `evidenceJson` is mandatory (§10.6, FR-5.5).
model AlertEvent {
  id             String     @id @default(cuid())
  walletAddress  String
  walletChain    Chain
  type           AlertType
  state          AlertState
  /// FR-5.1 optional token context.
  tokenAddress   String?
  tokenChain     Chain?
  tokenSymbol    String?
  amountUsd      Decimal?   @db.Decimal(38, 8)
  clusterId      String?
  /// Rule output: matched values, participants, token/market context.
  payloadJson    Json
  /// FR-5.5: { ruleId, ruleText, thresholds{}, observed{}, txLinks[], windows{} }.
  evidenceJson   Json
  /// Dedupe key so re-evaluating the same window cannot duplicate an alert
  /// (NFR-3 applied to alerts): "<type>:<wallet>:<chain>:<token|->:<windowBucket>".
  dedupeKey      String
  occurredAt     DateTime
  createdAt      DateTime   @default(now())
  readAt         DateTime?
  deliveredAt    DateTime?
  deliveryError  String?

  wallet Wallet @relation(fields: [walletAddress, walletChain], references: [address, chain], onDelete: Cascade)

  @@unique([dedupeKey])
  @@index([createdAt])
  @@index([walletAddress, walletChain, createdAt])
  @@index([type, createdAt])
  @@index([state, createdAt])
  @@index([readAt])
  @@index([tokenAddress, tokenChain])
}

/// Open/closed token positions per wallet: cost basis, unrealized multiple,
/// local high. Required by T4 (add-on-retrace), C3 (moon discipline),
/// FR-7.1 holding/distributed status, and Phase 6 grading.
model Position {
  id             BigInt   @id @default(autoincrement())
  walletAddress  String
  walletChain    Chain
  tokenAddress   String
  tokenChain     Chain
  openedAt       DateTime
  closedAt       DateTime?
  amountRaw      String   @default("0")
  costUsd        Decimal  @db.Decimal(38, 8) @default(0)
  realizedUsd    Decimal  @db.Decimal(38, 8) @default(0)
  avgEntryPriceUsd Decimal? @db.Decimal(38, 18)
  entryMarketCap Decimal? @db.Decimal(38, 8)
  peakPriceUsd   Decimal? @db.Decimal(38, 18)
  peakPriceAt    DateTime?
  unrealizedUsd  Decimal? @db.Decimal(38, 8)
  unrealizedMultiple Decimal? @db.Decimal(18, 8)
  buyCount       Int      @default(0)
  sellCount      Int      @default(0)
  isOpen         Boolean  @default(true)
  /// True once any part of this position was deposited to a CEX (C1/FR-7.1).
  cexDepositedUsd Decimal @db.Decimal(38, 8) @default(0)
  updatedAt      DateTime @updatedAt

  wallet Wallet @relation(fields: [walletAddress, walletChain], references: [address, chain], onDelete: Cascade)
  token  Token  @relation(fields: [tokenAddress, tokenChain], references: [address, chain], onDelete: Cascade)

  @@unique([walletAddress, walletChain, tokenAddress, tokenChain, openedAt], name: "position_key")
  @@index([walletAddress, walletChain, isOpen])
  @@index([tokenAddress, tokenChain, isOpen])
  @@index([unrealizedMultiple])
}
```
```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Module 6 — Self-tracking (FR-6.x)
// ─────────────────────────────────────────────────────────────────────────────

/// SRS §4 UserTrade. AUTO rows come from ingesting an `isSelf` wallet;
/// MANUAL rows come from the trade-log form (thesis required for MANUAL).
model UserTrade {
  id                    String      @id @default(cuid())
  ownWalletAddress      String
  ownChain              Chain
  tokenAddress          String
  tokenChain            Chain
  side                  TradeSide
  amountUsd             Decimal     @db.Decimal(38, 8)
  entryAt               DateTime
  exitAt                DateTime?
  roiPct                Decimal?    @db.Decimal(18, 8)
  followedWalletAddress String?
  followedWalletChain   Chain?
  lagMinutes            Int?
  lagMcDelta            Decimal?    @db.Decimal(38, 8)
  thesis                String?
  source                TradeSource

  /// FR-6.2 extra link metrics.
  walletRoiPct          Decimal?    @db.Decimal(18, 8)
  entryMarketCap        Decimal?    @db.Decimal(38, 8)
  followedEntryMarketCap Decimal?   @db.Decimal(38, 8)
  amountRaw             String?
  /// "0-1h" | "1-6h" | "6-24h" | ">24h" — cached bucket for FR-6.4 charts.
  lagBucket             String?
  /// Link provenance: candidates considered, chosen reason, grade filter used.
  linkEvidenceJson      Json?
  linkedAt              DateTime?
  /// True when the user overrode the auto-link; the linker must not overwrite it.
  isLinkPinned          Boolean     @default(false)
  movementId            BigInt?
  txHash                String?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  ownWallet      Wallet  @relation("TradeOwner",    fields: [ownWalletAddress, ownChain], references: [address, chain], onDelete: Cascade)
  followedWallet Wallet? @relation("TradeFollowed", fields: [followedWalletAddress, followedWalletChain], references: [address, chain])
  token          Token   @relation(fields: [tokenAddress, tokenChain], references: [address, chain], onDelete: Cascade)

  @@index([ownWalletAddress, ownChain, entryAt])
  @@index([followedWalletAddress, followedWalletChain])
  @@index([tokenAddress, tokenChain])
  @@index([lagBucket])
  @@index([entryAt])
}

// ─────────────────────────────────────────────────────────────────────────────
// Infrastructure: settings, jobs, quota, provider cache
// ─────────────────────────────────────────────────────────────────────────────

/// SRS §4 Setting — DB-backed, UI-editable, Zod-validated (SRS §9).
model Setting {
  key       String   @id
  valueJson Json
  updatedAt DateTime @updatedAt
}

/// Mirror of BullMQ job state for the in-app job list and progress bars
/// (NFR-2). BullMQ/Redis remains the execution source of truth; this table is
/// the durable, queryable projection that survives a Redis flush.
model JobRun {
  id           String    @id
  queueName    String
  jobName      String
  status       JobStatus @default(QUEUED)
  progressPct  Int       @default(0)
  progressJson Json?
  payloadJson  Json
  resultJson   Json?
  error        String?
  attemptsMade Int       @default(0)
  startedAt    DateTime?
  finishedAt   DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([status, createdAt])
  @@index([queueName, createdAt])
  @@index([jobName, createdAt])
}

/// Per-provider, per-day call accounting for the health page and the quota
/// budget guard (SRS §5 free-tier limits, §6 of this plan).
model ApiUsageDaily {
  provider     String
  day          DateTime @db.Date
  callCount    Int      @default(0)
  errorCount   Int      @default(0)
  rateLimitHits Int     @default(0)
  recordsFetched Int    @default(0)
  updatedAt    DateTime @updatedAt

  @@id([provider, day])
  @@index([day])
}

/// Durable response cache keyed by (provider, endpoint, params hash) so a
/// re-run of a failed job replays from cache instead of re-spending quota
/// (§10.5 "cache aggressively"). Redis holds the hot copy; this is the cold copy.
model ProviderCacheEntry {
  cacheKey   String   @id
  provider   String
  endpoint   String
  paramsJson Json
  payload    Json
  fetchedAt  DateTime @default(now())
  expiresAt  DateTime?

  @@index([provider, endpoint])
  @@index([expiresAt])
}
```

### 3.3 Index inventory (SRS §4 requirement + performance additions)

SRS §4 mandates exactly these five indexes; all are present above:

| SRS-mandated index | Location in schema |
|---|---|
| `Transaction(fromAddress, timestamp)` | `Transaction @@index([fromAddress, timestamp])` |
| `Transaction(toAddress, timestamp)` | `Transaction @@index([toAddress, timestamp])` |
| `Transaction(tokenAddress, timestamp)` | `Transaction @@index([tokenAddress, timestamp])` |
| `AlertEvent(createdAt)` | `AlertEvent @@index([createdAt])` |
| `MovementGroup(tokenAddress, windowStart)` | `MovementGroup @@index([tokenAddress, windowStart])` |

Additional indexes exist only where a named NFR-7 budget or a rule query requires them: wallet-list filters (`Wallet(chain)`, `Wallet(watchPriority, chain)`, `WalletProfile(lastActivityAt)`, `WalletProfile(stableBalanceUsd)`), feed pagination (`MovementEvent(timestamp)`, `MovementEvent(kind, timestamp)`), incremental evaluation (`MovementEvent(radarEvaluatedAt)`, `MovementEvent(alertEvaluatedAt)`), graph loading (`InteractionEdge(totalUsd)`), and rollup lookups (`DailyFlow(walletAddress, chain, day)`).

### 3.4 Migration strategy (additive only)

1. **One migration per phase, named `phaseN_<subject>`.** Phase 0 creates the full schema above in a single migration (`0001_phase0_initial`) so later phases add data, not tables. This is deliberate: the SRS specifies the entire data model up front, and creating it once avoids destructive churn later.
2. **Additive rules, enforced in review.** Later migrations may only: add tables, add nullable columns, add columns with defaults, add enum values, add indexes, or add constraints that the existing data already satisfies. Never rename, never drop, never narrow a type, never remove an enum value. If a rename seems necessary, add the new column, backfill it in a job, and leave the old one in place (NFR-5 "never auto-delete" is a data-retention rule, and this extends it to schema).
3. **Enum growth is append-only.** Postgres `ALTER TYPE … ADD VALUE` cannot run inside a transaction block with other statements in some paths; enum additions therefore get their own migration file.
4. **Every migration is generated with `prisma migrate dev --name <name>` in development and applied with `prisma migrate deploy` at container start.** The app container runs `prisma migrate deploy` before `next start`; the worker container waits for the app's migration to finish (compose `depends_on` + a `migrate` one-shot service) so two processes never migrate concurrently.
5. **Seeding is idempotent and re-runnable** (`prisma/seed/seed.ts`): entity labels upsert by `(address, chain)`, settings upsert by `key` and never overwrite a user-modified value (compare `updatedAt` against seed run time), so `pnpm seed` after an upgrade adds new bundled labels without discarding user edits (FR-2.3).
6. **Backfills are jobs, not migrations.** A migration adds the column; a BullMQ job (`rebuild:derived`) populates it with visible progress (NFR-2). Migrations must run in seconds even with millions of transaction rows.
7. **Rollback posture:** because migrations are additive, rollback = deploy the previous app image; the newer columns are simply unused. `pnpm backup` (NFR-6) is run before any migration by `scripts/backup.ts` being wired into the `migrate` compose service as a pre-step.

---

## 4. Core Interface Contracts

Signatures only — no implementations. These are frozen contracts: a task may add to them, never silently change a name or a type. Types referenced across sections are defined once, at first use.

### 4.1 `ChainAdapter` (NFR-9, SRS §10.9)

`src/lib/chains/types.ts` — the only place chain semantics are expressed. The four methods named in NFR-9 are mandatory; everything else on the interface is additive support the SRS's own features require (balances for FR-2.5/A1/A2, block-by-time for incremental sync, explorer URLs for FR-4.8 evidence links).

```ts
// ── Primitive aliases ────────────────────────────────────────────────────────
export type ChainSlug =
  | 'base' | 'bsc' | 'robinhood';

/** Lowercase 0x-prefixed 40-hex-char string. Branded to prevent mixing. */
export type Address = string & { readonly __brand: 'Address' };

/** Base-unit integer as a decimal string (never a JS number). */
export type RawAmount = string;

// ── Raw records returned by an adapter (provider-agnostic shape) ─────────────
export interface RawNativeTx {
  hash: string;
  blockNumber: bigint;
  timestamp: Date;              // UTC
  from: Address;
  to: Address | null;           // null for contract creation
  valueRaw: RawAmount;
  gasUsed: RawAmount | null;
  gasPriceWei: RawAmount | null;
  isError: boolean;
  methodId: string | null;
  functionName: string | null;
  contractCreated: Address | null;
}

export interface RawInternalTx {
  hash: string;                 // parent tx hash
  traceId: string;              // provider trace identifier, unique within hash
  blockNumber: bigint;
  timestamp: Date;
  from: Address;
  to: Address | null;
  valueRaw: RawAmount;
  isError: boolean;
  callType: string | null;      // 'call' | 'create' | 'delegatecall' | ...
}

export interface RawTokenTransfer {
  hash: string;
  logIndex: number;             // unique within hash
  blockNumber: bigint;
  timestamp: Date;
  from: Address;
  to: Address;
  tokenAddress: Address;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenDecimals: number | null;
  valueRaw: RawAmount;
}

export interface RawTokenInfo {
  address: Address;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  deployedAt: Date | null;
  deployerAddress: Address | null;
  deployTxHash: string | null;
  totalSupplyRaw: RawAmount | null;
}

export interface RawBalance {
  /** null tokenAddress = the chain's native asset. */
  tokenAddress: Address | null;
  balanceRaw: RawAmount;
  decimals: number | null;
  symbol: string | null;
}

// ── Query options ────────────────────────────────────────────────────────────
export interface BlockRange {
  /** Inclusive. Incremental sync passes lastSyncedBlock + 1 (NFR-4). */
  fromBlock: bigint;
  /** Inclusive; 'latest' resolves inside the adapter. */
  toBlock: bigint | 'latest';
}

export interface FetchOptions extends BlockRange {
  /** Hard cap on records to pull in this call; the adapter paginates internally. */
  maxRecords?: number;
  sort?: 'asc' | 'desc';
  /** Abort signal so a cancelled job stops spending quota immediately. */
  signal?: AbortSignal;
  /** Per-page callback used to stream progress into BullMQ (NFR-2). */
  onPage?: (page: PageMeta) => void | Promise<void>;
}

export interface PageMeta {
  endpoint: 'NORMAL_TX' | 'INTERNAL_TX' | 'ERC20_TRANSFER';
  pageNumber: number;           // 1-based
  recordsInPage: number;
  /** True when recordsInPage === provider page cap (more data likely exists). */
  pageWasFull: boolean;
  highestBlockSeen: bigint;
  cumulativeRecords: number;
}

export interface FetchResult<T> {
  records: T[];
  /** Highest block fully covered; the sync cursor advances to exactly this. */
  coveredThroughBlock: bigint;
  /** True when maxRecords or the provider window cap stopped the walk early. */
  truncated: boolean;
  pages: PageMeta[];
  callsSpent: number;
}

// ── The interface ────────────────────────────────────────────────────────────
export interface ChainAdapter {
  readonly chain: ChainSlug;
  readonly chainId: number;
  readonly nativeSymbol: string;
  readonly nativeDecimals: number;

  getTransactions(address: Address, opts: FetchOptions): Promise<FetchResult<RawNativeTx>>;
  getInternalTxs(address: Address, opts: FetchOptions): Promise<FetchResult<RawInternalTx>>;
  getTokenTransfers(address: Address, opts: FetchOptions): Promise<FetchResult<RawTokenTransfer>>;
  getTokenInfo(tokenAddress: Address): Promise<RawTokenInfo | null>;

  // Support methods required by named FRs.
  getBalances(address: Address, tokenAddresses: Address[]): Promise<RawBalance[]>;  // FR-2.5, A1, A2
  getLatestBlock(): Promise<bigint>;                                               // NFR-4
  getBlockNumberByTimestamp(at: Date): Promise<bigint>;                            // window→block
  getTokenHolderSummary(tokenAddress: Address): Promise<TokenHolderSummary | null>; // FR-7.2
  explorerTxUrl(hash: string): string;                                             // FR-4.8
  explorerAddressUrl(address: Address): string;
}

export interface TokenHolderSummary {
  holderCount: number | null;
  /** Sum of the top-10 holders' share of supply, 0–100. Null when unavailable. */
  top10SharePct: number | null;
  /** Raw rows kept for the evidence panel; [] when the provider gives none. */
  topHolders: Array<{ address: Address; shareRaw: RawAmount; sharePct: number | null }>;
  source: 'ETHERSCAN' | 'ROBINHOOD_PROVIDER' | 'UNAVAILABLE';
}
```

**`EtherscanV2Adapter`** — `src/lib/chains/etherscan-v2-adapter.ts`

```ts
export interface EtherscanV2AdapterDeps {
  client: EtherscanV2Client;          // §4.2
  chain: ChainSlug;
  chainId: number;
  nativeSymbol: string;
  nativeDecimals: number;
  explorerBaseUrl: string;            // e.g. https://etherscan.io
}

export declare function createEtherscanV2Adapter(deps: EtherscanV2AdapterDeps): ChainAdapter;
```

Behaviour contract: every method delegates to `EtherscanV2Client`, which owns rate limiting, pagination, caching, and retries. The adapter's only jobs are (a) mapping Etherscan's `module`/`action` parameters and string fields onto the raw record types above, (b) converting Etherscan's second-precision `timeStamp` strings into UTC `Date`s, (c) lowercasing every address into the `Address` brand, and (d) translating "No transactions found" (a *successful* empty result in Etherscan's API, returned with `status: "0"`) into an empty `records` array rather than an error. It never throws for an empty history.

**`RobinhoodChainAdapter`** — `src/lib/chains/robinhood-adapter.ts`

P0-T18 chooses and records its low-level read provider before freezing provider-specific client types. Regardless of provider, the public adapter is exactly `ChainAdapter`: chain ID 4663, ETH native currency, official Robinhood explorer links, UTC timestamps, lowercase addresses, stable pagination semantics, typed quota/errors, and explicit unavailable values. It must pass the same contract suite as `EtherscanV2Adapter`; no service may branch on `chain === 'robinhood'`, and no signing/broadcast method belongs in the adapter.

**`MockChainAdapter`** — `src/lib/chains/mock-adapter.ts`

```ts
export interface MockScenario {
  name: string;
  latestBlock: bigint;
  nativeTxs: Record<string, RawNativeTx[]>;        // key: lowercase address
  internalTxs: Record<string, RawInternalTx[]>;
  tokenTransfers: Record<string, RawTokenTransfer[]>;
  tokens: Record<string, RawTokenInfo>;            // key: lowercase token address
  balances: Record<string, RawBalance[]>;
  holders?: Record<string, TokenHolderSummary>;
  /** Optional per-page cap to exercise pagination logic deterministically. */
  pageCap?: number;
}

export declare function createMockChainAdapter(
  chain: ChainSlug,
  scenario: MockScenario,
): ChainAdapter & {
  /** Call counts per method, asserted by quota and pagination tests. */
  stats(): Record<string, number>;
  reset(): void;
};

/** Loads tests/fixtures/scenarios/<name>.json into a MockScenario. */
export declare function loadScenario(name: string): Promise<MockScenario>;
```

The mock honours `fromBlock`/`toBlock`/`sort`/`maxRecords` and slices results into pages of `pageCap` (default 1,000) so pagination, cursor advancement, and truncation handling are testable with zero network calls. **All phase acceptance e2e tests run against the mock**; live-network tests are a separate, opt-in suite (`pnpm test:live`) that is never part of the default gate.

### 4.2 Rate-limited Etherscan V2 client (SRS §5, §10.5)

`src/lib/etherscan/client.ts` + `src/lib/ratelimit/token-bucket.ts`.

```ts
// ── Rate limiter ─────────────────────────────────────────────────────────────
export interface TokenBucketConfig {
  /** Redis key namespace, e.g. 'rl:etherscan'. One bucket per provider, shared
   *  across ALL chains because the free-tier key's 5 rps is global (SRS §5). */
  key: string;
  /** Sustained refill rate in tokens/second. Default 4 (headroom under 5 rps). */
  refillPerSecond: number;
  /** Max burst. Default 5. */
  capacity: number;
  /** Max time a caller waits for a token before failing. Default 60_000 ms. */
  maxWaitMs: number;
}

export interface DailyBudgetConfig {
  provider: string;
  /** Hard ceiling, default 100_000 (SRS §5). */
  dailyLimit: number;
  /** Reserve withheld from background jobs so user-triggered work can run.
   *  Default 10% (10_000 calls). */
  reservedForInteractivePct: number;
}

export type CallPriority = 'INTERACTIVE' | 'BACKGROUND' | 'BULK';

export interface RateLimiter {
  /** Resolves when a token is granted; throws RateLimitTimeoutError past maxWaitMs. */
  acquire(cost: number, priority: CallPriority): Promise<void>;
  /** Non-blocking check used by the scheduler to decide whether to enqueue. */
  budgetRemaining(): Promise<{ dayCalls: number; dayLimit: number; remaining: number }>;
  snapshot(): Promise<RateLimiterSnapshot>;   // health page (Phase 0 acceptance)
}

export interface RateLimiterSnapshot {
  provider: string;
  tokensAvailable: number;
  refillPerSecond: number;
  callsToday: number;
  dailyLimit: number;
  remainingToday: number;
  rateLimitHitsToday: number;
  windowResetsAt: Date;         // next UTC midnight
}

// ── Client ───────────────────────────────────────────────────────────────────
export interface EtherscanV2ClientConfig {
  apiKey: string;
  baseUrl: string;              // https://api.etherscan.io/v2/api
  limiter: RateLimiter;
  cache: ProviderCache;
  /** Provider page cap. Default 1000 (SRS §5, July 2026 change). */
  pageCap: number;
  retry: RetryPolicy;
  usage: UsageRecorder;
  logger: Logger;
}

export interface RetryPolicy {
  maxAttempts: number;          // default 5
  baseDelayMs: number;          // default 500
  maxDelayMs: number;           // default 30_000
  /** Full jitter: delay = random(0, min(maxDelay, base * 2^attempt)). */
  jitter: 'full';
  /** Attempts that count against the job's retry budget vs. the client's. */
  retryableErrors: EtherscanErrorCode[];
}

export type EtherscanErrorCode =
  | 'RATE_LIMITED'          // "Max rate limit reached" → retry
  | 'INVALID_API_KEY'       // → fail fast, surface in UI, do not retry
  | 'DAILY_LIMIT_REACHED'   // → fail job, pause scheduler for the day
  | 'NETWORK'               // → retry
  | 'TIMEOUT'               // → retry
  | 'SERVER_ERROR'          // 5xx → retry
  | 'BAD_REQUEST'           // malformed params → fail fast, bug
  | 'EMPTY_RESULT'          // status 0 "No transactions found" → not an error
  | 'UNKNOWN';

export interface EtherscanPageRequest {
  chainId: number;
  module: 'account' | 'contract' | 'token' | 'block' | 'stats' | 'proxy';
  action: string;
  params: Record<string, string | number | bigint>;
  page: number;
  offset: number;               // ≤ pageCap
  priority: CallPriority;
  signal?: AbortSignal;
  /** TTL for the durable cache; 0 = do not cache (e.g. latest block). */
  cacheTtlMs: number;
}

export interface EtherscanV2Client {
  /** One rate-limited, retried, cached call. Returns the parsed `result` array. */
  fetchPage<T>(req: EtherscanPageRequest): Promise<{ rows: T[]; fromCache: boolean }>;

  /** Paginated walk that respects the 1,000-record cap and never loses records. */
  fetchAllPages<T>(req: Omit<EtherscanPageRequest, 'page'>, opts: PaginationOptions<T>):
    Promise<{ rows: T[]; pages: PageMeta[]; truncated: boolean; callsSpent: number }>;

  snapshot(): Promise<RateLimiterSnapshot>;
}

export interface PaginationOptions<T> {
  endpoint: PageMeta['endpoint'];
  /** Reads the block number out of a row so the walker can re-window. */
  blockOf: (row: T) => bigint;
  maxRecords?: number;
  maxPages?: number;            // safety valve, default 200
  onPage?: (page: PageMeta) => void | Promise<void>;
}

export interface ProviderCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  /** Deterministic key: sha256 of provider|endpoint|sorted-params. */
  keyFor(provider: string, endpoint: string, params: Record<string, unknown>): string;
}

export interface UsageRecorder {
  record(provider: string, outcome: 'ok' | 'error' | 'rate_limited', records: number): Promise<void>;
}
```

**Pagination algorithm (`fetchAllPages`), in plain language.** Etherscan V2 caps a response at `pageCap` (1,000) records and also caps how deep `page` may go for a given window, so paging by number alone silently loses data on hot addresses. The walker therefore uses **block-window advancement with page fallback**:

1. Start with the caller's `fromBlock`, `toBlock`, `sort: 'asc'`, `offset = pageCap`, `page = 1`.
2. Request the page. Record a `PageMeta` and report progress.
3. If the page returned fewer than `pageCap` records, the window is exhausted: the walk is complete and `coveredThroughBlock = toBlock` (resolved).
4. If the page is **full**, more records exist. Take `maxBlock` = highest block in the page. If `maxBlock > fromBlock`, discard the trailing partial-block records (all rows whose block equals `maxBlock`), keep everything below, then restart at step 2 with `fromBlock = maxBlock`, `page = 1`. Dropping the boundary block and re-fetching it is what guarantees no record is skipped and none is half-counted; idempotent upserts (NFR-3) make the re-fetch harmless.
5. If the page is full **and** every record shares one block (`maxBlock === fromBlock`, a single block with >1,000 records for this address), the window cannot be narrowed further; fall back to incrementing `page` for that block until a non-full page arrives or `maxPages` is hit.
6. Stop early if `maxRecords` is reached or the `AbortSignal` fires, and set `truncated: true`. A truncated result **must not** advance the sync cursor past `coveredThroughBlock`.
7. `coveredThroughBlock` is always the last block for which *all* records were retrieved — never the highest block merely seen. `SyncState.cursorsJson` stores this per endpoint (§3.2), so a resumed sync re-reads at most one block.

**Rate limiting and budget, in plain language.** A single Redis Lua token bucket (atomic check-and-consume, no race between the app and worker processes) meters every outbound Etherscan call at `refillPerSecond` 4 with capacity 5, i.e. deliberately under the documented ~5 rps. Callers `acquire` before each HTTP request and pass a `CallPriority`; when the daily counter exceeds `dailyLimit − reserved`, `BACKGROUND` and `BULK` acquisitions are refused (`DailyBudgetExceededError`) while `INTERACTIVE` calls continue until the hard limit. Every response increments `ApiUsageDaily`. On `RATE_LIMITED`, the client sleeps with full-jitter exponential backoff and *also* reduces the bucket's effective rate for 60 seconds (adaptive brake) so a burst of retries does not compound. `DAILY_LIMIT_REACHED` pauses the repeatable scheduler until the next UTC midnight and raises a banner in the UI; it never silently drops work — pending jobs stay queued.

**DexScreener client** (`src/lib/dexscreener/client.ts`) uses the same primitives with its own bucket (default 3 rps, no daily cap known, so the cap is a configured `dexscreenerDailySoftLimit`), batches up to 30 token addresses per request, and caches token responses for `priceCacheTtlSeconds` (default 60 s). CoinGecko (`src/lib/coingecko/client.ts`) is optional, its own bucket at 0.5 rps, and every call site treats a failure as `UNKNOWN` pricing rather than an error (SRS §5 "best-effort only").

### 4.3 Queue job contracts (NFR-2)

`src/lib/queue/contracts.ts` declares every queue name, payload, progress event, and result. Processors in `src/server/workers/processors/` implement them.

```ts
export const QUEUES = {
  intake:   'watchtower.intake',
  sync:     'watchtower.sync',
  pricing:  'watchtower.pricing',
  derive:   'watchtower.derive',
  radar:    'watchtower.radar',
  alert:    'watchtower.alert',
  maintenance: 'watchtower.maintenance',
} as const;

/** Progress payload shape shared by every job (rendered by JobProgress). */
export interface JobProgress {
  pct: number;                     // 0..100, monotonic
  stage: string;                   // stable machine name, e.g. 'fetch:erc20'
  message: string;                 // human line for the UI
  counters?: Record<string, number>;
  callsSpent?: number;
  etaSeconds?: number;
}

export interface JobResultBase {
  ok: boolean;
  durationMs: number;
  callsSpent: number;
  warnings: string[];
}
```

| Job name | Queue | Payload | Progress stages (in order) | Result | Idempotency key |
|---|---|---|---|---|---|
| `wallet.intake` | intake | `{ address, chain, requestedBy: 'USER'\|'IMPORT', importBatchId?, forceFullResync?: boolean }` | `resolve:ens` → `fetch:normal` → `fetch:internal` → `fetch:erc20` → `persist:tx` → `price:events` → `profile:stats` → `funding:trace` → `cluster:detect` → `derive:movements` → `derive:positions` → `derive:relations` → `alert:backfill` → `done` | `WalletIntakeResult` | `intake:{chain}:{address}` |
| `wallet.sync.incremental` | sync | `{ address, chain, reason: 'SCHEDULED'\|'USER'\|'RETRY' }` | `resolve:cursor` → `fetch:normal` → `fetch:internal` → `fetch:erc20` → `persist:tx` → `price:events` → `derive:incremental` → `done` | `WalletSyncResult` | `sync:{chain}:{address}:{cursorBlock}` |
| `wallet.import.batch` | intake | `{ batchId, entries: Array<{ address, chain, label? }>, defaultChain }` | `validate` → `dedupe` → `enqueue:children` → `await:children` → `done` (child progress aggregated) | `BatchImportResult` | `import:{batchId}` |
| `funding.trace` | derive | `{ rootAddress, rootChain, maxDepth, branchAddress?, branchChain?, mode: 'DEFAULT'\|'DEEP' }` | `load:known` → `expand:depth:{n}` (repeated) → `classify:primary` → `persist:edges` → `cluster:detect` → `done` | `FundingTraceResult` | `trace:{rootChain}:{rootAddress}:{branchAddress ?? 'root'}:{maxDepth}:{mode}` |
| `price.snapshot.enrich` | pricing | `{ scope: 'TX_BATCH'\|'TOKEN'\|'WALLET'\|'STALE_SWEEP', transactionIds?: string[], tokenAddress?, chain?, walletAddress?, from?, to? }` | `group:swaps` → `price:stable-leg` → `price:native-leg` → `price:dexscreener` → `price:coingecko` → `persist:snapshots` → `backfill:usd` → `done` | `PriceEnrichResult` | `price:{scope}:{hash of ids/range}` |
| `token.metadata.refresh` | pricing | `{ tokenAddress, chain, includeHolders: boolean }` | `fetch:info` → `fetch:pair` → `fetch:holders` → `persist` → `done` | `TokenMetadataResult` | `token:{chain}:{tokenAddress}` |
| `balance.snapshot` | pricing | `{ addresses: Array<{address, chain}>, tokens: 'STABLES'\|'STABLES_AND_NATIVE' }` | `fetch:balances` → `persist` → `recompute:baselines` → `done` | `BalanceSnapshotResult` | `balance:{yyyy-mm-ddThh}:{hash of addresses}` |
| `derive.rebuild` | derive | `{ target: 'MOVEMENTS'\|'INTERACTION_EDGES'\|'RELATIONS'\|'POSITIONS'\|'DAILY_FLOWS'\|'ALL', scope?: { address?, chain?, from?, to? } }` | `plan` → `rebuild:{target}` (repeated) → `verify:counts` → `done` | `DeriveRebuildResult` | `derive:{target}:{scope hash}` |
| `radar.evaluate` | radar | `{ mode: 'INCREMENTAL'\|'WINDOW', from?, to?, windows?: Array<'1h'\|'6h'\|'24h'\|'48h'> }` | `load:events` → `group:co-accumulation` → `group:co-distribution` → `group:cluster-co-entry` → `rollup:netflow` → `rollup:breadth` → `rotation:clusters` → `persist:groups` → `done` | `RadarEvaluateResult` | `radar:{mode}:{from}:{to}` |
| `alert.evaluate` | alert | `{ mode: 'INCREMENTAL'\|'BACKFILL', address?, chain?, from?, to?, rules?: AlertType[] }` | `load:context` → `eval:arming` → `eval:triggers` → `eval:exit-risk` → `eval:dearm` → `persist:alerts` → `deliver:telegram` → `done` | `AlertEvaluateResult` | `alert:{mode}:{address ?? 'all'}:{from}:{to}` |
| `alert.deliver` | alert | `{ alertIds: string[] }` | `render` → `send` → `mark` → `done` | `AlertDeliverResult` | `deliver:{hash of alertIds}` |
| `self.link.trades` | derive | `{ ownAddress?, ownChain?, tradeIds?: string[] }` | `load:trades` → `match:signals` → `compute:lag` → `compute:roi` → `persist` → `done` | `SelfLinkResult` | `selflink:{ownAddress ?? 'all'}:{hash of tradeIds}` |
| `maintenance.prune` | maintenance | `{ target: 'TOKEN_HISTORY', tokenAddress, chain, confirm: true }` | `count` → `delete` → `vacuum-hint` → `done` | `PruneResult` | `prune:{target}:{chain}:{tokenAddress}` |
| `schedule.sync.tick` | sync | `{}` (repeatable, cron) | `select:wallets` → `check:budget` → `enqueue` → `done` | `ScheduleTickResult` | BullMQ repeatable job key |

```ts
export interface WalletIntakeResult extends JobResultBase {
  address: string; chain: ChainSlug;
  txPersisted: number; movementsCreated: number;
  fundingEdges: number; primaryWalletsFound: number;
  clustersJoined: string[]; alertsBackfilled: number;
  pricedCount: number; unknownUsdCount: number;
}
export interface WalletSyncResult extends JobResultBase {
  address: string; chain: ChainSlug;
  fromBlock: string; toBlock: string;      // bigint as decimal string
  newTx: number; newMovements: number; truncated: boolean;
}
export interface BatchImportResult extends JobResultBase {
  batchId: string; accepted: number; duplicates: number;
  invalid: Array<{ line: number; raw: string; reason: string }>;
  childJobIds: string[];
}
export interface FundingTraceResult extends JobResultBase {
  rootAddress: string; rootChain: ChainSlug;
  nodesExpanded: number; maxDepthReached: number;
  terminalStops: number; primaryWallets: Array<{ address: string; chain: ChainSlug }>;
  candidates: Array<{ address: string; chain: ChainSlug; reason: 'REPEATED_FUNDER' | 'PROFIT_SINK' }>;
  clustersCreated: string[]; clustersUpdated: string[];
}
export interface PriceEnrichResult extends JobResultBase {
  snapshotsWritten: number; txPriced: number; txUnknown: number;
  bySource: Record<UsdSourceName, number>;
}
export interface RadarEvaluateResult extends JobResultBase {
  eventsConsidered: number;
  groupsCreated: { coAccumulation: number; coDistribution: number; clusterCoEntry: number };
  groupsUpdated: number; netflowRowsWritten: number; breadthPct: number;
}
export interface AlertEvaluateResult extends JobResultBase {
  eventsConsidered: number; alertsCreated: number; alertsSuppressed: number;
  stateChanges: Array<{ address: string; chain: ChainSlug; from: string; to: string; rule?: AlertType }>;
  byType: Record<string, number>;
}
export interface SelfLinkResult extends JobResultBase {
  tradesConsidered: number; linked: number; unlinked: number; pinnedSkipped: number;
}
export interface DeriveRebuildResult extends JobResultBase { rowsWritten: Record<string, number>; }
export interface TokenMetadataResult extends JobResultBase { tokenAddress: string; holdersFetched: boolean; }
export interface BalanceSnapshotResult extends JobResultBase { snapshots: number; walletsCovered: number; }
export interface AlertDeliverResult extends JobResultBase { sent: number; failed: number; }
export interface PruneResult extends JobResultBase { rowsDeleted: Record<string, number>; }
export interface ScheduleTickResult extends JobResultBase { enqueued: number; skippedForBudget: number; }
```

**Cross-cutting job rules.** (a) Every job uses a deterministic BullMQ `jobId` from the table's idempotency column, so double-clicking "re-sync" enqueues one job, not two (NFR-3). (b) Every job writes a `JobRun` row on `active`/`progress`/`completed`/`failed` via a shared QueueEvents listener, which is what the in-app job list and `JobProgress` components read — the UI never polls BullMQ directly. (c) Default job options: `attempts: 3`, `backoff: { type: 'exponential', delay: 2000 }`, `removeOnComplete: { count: 500 }`, `removeOnFail: false`. (d) `wallet.intake` and `wallet.import.batch` use BullMQ flows (parent/child) so batch progress = completed children ÷ total children (NFR-2's "batch import of 100 wallets must never block the UI"). (e) Concurrency: `intake`/`sync` workers run concurrency 2 (the limiter, not the worker count, is the throttle), `pricing` 4, `derive` 2, `radar`/`alert` 1 (single evaluator prevents duplicate group/alert creation), `maintenance` 1. (f) Repeatable jobs: `schedule.sync.tick` at `syncCadenceMinutes` (default 15), `radar.evaluate` INCREMENTAL at `radarCadenceMinutes` (default 5, FR-5.4), `alert.evaluate` INCREMENTAL immediately after each radar run (chained, not concurrent), `balance.snapshot` hourly for HIGH-priority wallets and daily for the rest, `derive.rebuild` never scheduled (manual only).

### 4.4 Funding-tree builder (FR-2.1, FR-2.2, FR-2.3, FR-2.7, §10.4)

`src/server/services/funding/trace.ts`

```ts
export interface FundingTraceInput {
  rootAddress: Address;
  rootChain: ChainSlug;
  /** Default 3, max 6 (FR-2.1). Values above 6 are rejected. */
  maxDepth: number;
  /** DEEP mode extends one branch beyond maxDepth until terminal/dead end/6 (FR-2.7). */
  mode: 'DEFAULT' | 'DEEP';
  /** Required in DEEP mode: the node whose branch is being extended. */
  branch?: { address: Address; chain: ChainSlug };
  /** Caps API spend for one trace; exceeding it stops with BUDGET_EXHAUSTED. */
  callBudget: number;
  signal?: AbortSignal;
  onProgress?: (p: JobProgress) => void | Promise<void>;
}

export interface FundingTreeNode {
  address: Address;
  chain: ChainSlug;
  depth: number;
  label: string | null;
  entityKind: EntityKind | null;
  entityName: string | null;
  isTerminalEntity: boolean;
  isTracked: boolean;
  totalUsdFunded: string;          // Decimal as string
  fundingCount: number;
  internalFundingCount: number;
  firstFundedAt: Date | null;
  lastFundedAt: Date | null;
  stopReason: TraceStopReason;
  isRepeatedFunder: boolean;
  fundedFirstGas: boolean;
  isProfitSink: boolean;
  profitSinkRatio: string | null;
  isLargestOutflowDestination: boolean;
  isPrimaryWallet: boolean;
  primaryLabel: 'PRIMARY_WALLET' | 'REPEATED_FUNDER_CANDIDATE' | 'PROFIT_SINK_CANDIDATE' | null;
  canDeepTrace: boolean;
  children: FundingTreeNode[];     // funders of this node (i.e. upstream)
}

export interface FundingTraceOutput {
  root: FundingTreeNode;
  nodesExpanded: number;
  callsSpent: number;
  truncated: boolean;
  sharedFunderHits: Array<{ funder: Address; chain: ChainSlug; trackedWallets: Array<{ address: Address; chain: ChainSlug }> }>;
}

export declare function buildFundingTree(input: FundingTraceInput, deps: FundingDeps): Promise<FundingTraceOutput>;
export declare function loadFundingTree(rootAddress: Address, rootChain: ChainSlug): Promise<FundingTreeNode>;

export interface FundingDeps {
  adapter: ChainAdapter;
  entities: EntityService;         // isTerminal(address, chain) → EntityLabel | null
  txStore: TransactionStore;       // read/persist ingested rows
  pricing: PricingService;
  settings: SettingsSnapshot;
  clock: Clock;
}
```

**Algorithm, in plain language.** Breadth-first walk *upstream* from the tracked wallet, one depth level at a time, so a shallow terminal stop is always found before deep work is spent.

1. **Seed.** Depth 0 is the tracked wallet. Its inbound funding events are gathered from the local `Transaction` store first; only if the store has no coverage for that address (`FundingNode.inboundFetchedAt` is null) does the walker call the adapter. Inbound funding = every record on `rootChain` where `toAddress` = the node and value > 0, drawn from **both** `getTransactions` (native transfers) **and** `getInternalTxs` (contract-mediated value). Internal transactions are not optional (SRS §10.4, FR-2.1): a router or disperser contract sending gas appears only there. ERC-20 transfers are *not* funding edges (they are token flow, handled by the interaction graph), except that stablecoin inflows are separately recorded as parking events (FR-2.5). The traversal never switches adapters or chains.
2. **Aggregate per funder.** Group the inbound events by `fromAddress`, summing USD (valued with the native price snapshot at each event's timestamp), counting events, counting how many came from internal traces, and keeping first/last timestamps. This produces one candidate `FundingEdge` per (child, parent) pair.
3. **Terminal check before recursion (FR-2.2).** For each funder, look up `EntityLabel` by `(address, rootChain)`. If found and `isTerminal`, create the node with `entityName` (e.g. "Binance 14"), set `stopReason: TERMINAL_ENTITY`, and **do not** fetch its inbound history — this is both a correctness rule and the main quota saver. Bridges are terminal in v1: show the bridge label and stop, without searching another chain for a matching withdrawal (§0 D-2). `HUMAN` labels are never terminal and remain traceable on the same chain.
4. **Recurse.** Non-terminal funders are queued for the next depth level, until `depth === maxDepth`. Nodes cut off by the depth limit get `stopReason: DEPTH_LIMIT` and `canDeepTrace: true`, which is what renders FR-2.7's button. A funder with zero inbound value events gets `NO_INBOUND`; a self-funding loop gets `SELF_REFERENCE`; running out of `callBudget` gets `BUDGET_EXHAUSTED` (and `truncated: true`).
5. **Cycle and revisit safety.** A visited set keyed `(chain, address)` prevents infinite loops in funding cycles; a node already expanded at an equal-or-greater depth in this trace is linked, not re-expanded. `FundingNode.maxExpandedDepth` persists this across runs so a `DEEP` trace resumes instead of restarting.
6. **DEEP mode (FR-2.7).** Same walk, but seeded at `input.branch` with the depth counter continuing from that node's stored depth, and `maxDepth` raised to the absolute cap of 6. It terminates on the first of: terminal entity, dead end, or depth 6. Only the requested branch is expanded — sibling branches are untouched, which keeps the action cheap and predictable.
7. **Persist.** `FundingNode` rows upsert per address; `FundingEdge` rows upsert on `funding_edge_key` `(root, child, parent)` with recomputed totals. Because upserts are keyed and totals are recomputed from the stored events rather than incremented, re-running a trace is idempotent (NFR-3).
8. **Shared-funder detection (FR-2.6)** runs immediately after persistence: any non-terminal `FundingNode` that appears in the trees of ≥ 2 tracked wallets yields a `Cluster` (upsert on `(funderAddress, funderChain)`), `ClusterMember` rows for each tracked wallet, and a stable `colorHex` assigned from a fixed 16-color palette by hashing the funder address (so cluster colors are stable across rebuilds, FR-2.6/FR-3.5).

**Stablecoin parking detection (FR-2.5)** lives beside the tracer in `src/server/services/funding/parking.ts`:

```ts
export interface ParkingEvent {
  walletAddress: Address; chain: ChainSlug;
  tokenAddress: Address; tokenSymbol: string;
  direction: 'IN' | 'OUT';
  amountRaw: RawAmount; amountUsd: string | null;
  timestamp: Date; txHash: string;
  counterpartyAddress: Address | null; counterpartyEntityName: string | null;
}
export interface ParkingSummary {
  perChain: Array<{ chain: ChainSlug; parkedUsd: string; byToken: Array<{ tokenAddress: Address; symbol: string; balanceRaw: RawAmount; balanceUsd: string | null }> }>;
  totalParkedUsd: string;
  timeline: ParkingEvent[];
  peakUsd: string | null; peakAt: Date | null;
}
export declare function computeParking(address: Address, chain: ChainSlug, deps: { settings: SettingsSnapshot }): Promise<ParkingSummary>;
```

Every ERC-20 transfer whose token address is in the configured stable list (default USDT, USDC, USDG per FR-2.5, per chain) is flagged as a parking event on ingest and rolled into `DailyFlow` with `isStable: true`. Current parked balance per chain comes from the latest `BalanceSnapshot` (authoritative, from `getBalances`) rather than from summing transfers, because transfer-sum drift is inevitable with rebasing/fee-on-transfer tokens; the transfer timeline is the *history*, the balance snapshot is the *level*. This pair is exactly what ARMED (A1) and de-arm need.

### 4.5 Primary-wallet detector (FR-2.4)

`src/server/services/funding/primary-wallet.ts`

```ts
export interface PrimaryWalletInput {
  trackedAddress: Address;
  trackedChain: ChainSlug;
  candidate: { address: Address; chain: ChainSlug };
  /** Aggregated funding of tracked-by-candidate. */
  funding: { eventsCount: number; totalUsd: string; firstAt: Date | null; fundedFirstGas: boolean };
  /** Tracked wallet's realized outflow value and per-destination breakdown. */
  outflow: { realizedOutflowUsd: string; byDestination: Array<{ address: Address; usd: string }> };
  thresholds: { profitSinkRatioPct: number; minFundingEvents: number };
}

export interface PrimaryWalletVerdict {
  isRepeatedFunder: boolean;
  fundedFirstGas: boolean;
  isProfitSink: boolean;
  profitSinkRatio: string | null;
  isLargestOutflowDestination: boolean;
  isPrimaryWallet: boolean;
  label: 'PRIMARY_WALLET' | 'REPEATED_FUNDER_CANDIDATE' | 'PROFIT_SINK_CANDIDATE' | null;
  /** Rendered for the UI badge tooltip; mirrors FR-5.5's evidence discipline. */
  evidence: {
    ruleText: string;
    conditionA: { satisfied: boolean; detail: string };
    conditionB: { satisfied: boolean; detail: string };
    numbers: Record<string, string>;
  };
}

export declare function classifyPrimaryWallet(input: PrimaryWalletInput): PrimaryWalletVerdict;
```

**Algorithm, in plain language.** Two independent conditions, evaluated exactly as FR-2.4 states, then combined.

- **Condition A (funding relationship).** True when the candidate funded the tracked wallet **≥ 2 times** (`minFundingEvents`, default 2), **or** when it funded the tracked wallet's *first-ever gas* and at least one later funding. "First-ever gas" = the candidate is the counterparty of the earliest inbound native/internal value transfer the tracked wallet ever received; "at least one later funding" = `eventsCount ≥ 2` with a distinct later timestamp. (A single funding event that happens to be the first gas does **not** satisfy A.)
- **Condition B (profit sink).** True when the candidate received back **≥ `profitSinkRatioPct`%** (default 20, configurable) of the tracked wallet's realized outflow value, **or** when it is the single largest destination of the tracked wallet's outgoing value. `realizedOutflowUsd` = sum of USD leaving the tracked wallet to *any* address, counting native, internal, and ERC-20 transfers, excluding swaps against DEX routers (those are position changes, not outflow to a person) and excluding gas fees. The ratio is `usdToCandidate ÷ realizedOutflowUsd`, undefined (null, condition B false via the ratio path) when the denominator is zero — but the "largest destination" path can still be true in that case only if some outflow exists.
- **Combination.** A ∧ B → `PRIMARY_WALLET` (UI shows the warning badge). A only → `REPEATED_FUNDER_CANDIDATE`, rendered "repeated funder (candidate primary)". B only → `PROFIT_SINK_CANDIDATE`, rendered "profit sink (candidate primary)". Neither → `null`.
- The persisted `FundingEdge.kind` is set to `PRIMARY` when both hold, `PROFIT_SINK` when only B, `REPEATED` when only A (or `eventsCount ≥ 2`), and `INITIAL` otherwise — the SRS enum stays literal while the booleans carry the three-way nuance (§3.1.6).
- **Determinism requirement:** this function is pure. It takes pre-aggregated numbers and returns a verdict with its evidence, so a unit test can assert every boundary (exactly 2 fundings, exactly 20.0%, tie for largest destination) without a database.

### 4.6 Pricing and USD attribution (SRS §10.3, §5)

`src/server/services/pricing/attribute.ts` — the mechanism the executive summary flags as the top risk.

```ts
export interface SwapGroup {
  chain: ChainSlug;
  txHash: string;
  walletAddress: Address;
  timestamp: Date;
  /** Assets leaving the wallet in this tx (token or native). */
  outLegs: Array<{ tokenAddress: Address | null; amountRaw: RawAmount; decimals: number | null; isStable: boolean; isNative: boolean }>;
  inLegs: Array<{ tokenAddress: Address | null; amountRaw: RawAmount; decimals: number | null; isStable: boolean; isNative: boolean }>;
  counterparties: Address[];
  routerHit: boolean;
}

export interface UsdAttribution {
  amountUsd: string | null;
  priceUsdUsed: string | null;
  source: UsdSourceName;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  marketCap: string | null;
  /** Non-fatal explanations, surfaced in the evidence tooltip. */
  notes: string[];
}

export declare function classifySwap(txRows: TransactionRow[], settings: SettingsSnapshot): SwapGroup | null;
export declare function attributeUsd(leg: PricingLeg, context: PricingContext): Promise<UsdAttribution>;
export declare function priceMovementEvent(event: MovementEventDraft, context: PricingContext): Promise<UsdAttribution>;
```

**Algorithm, in plain language.** For each transaction hash touching a tracked wallet, all rows sharing that hash are grouped (`swapGroupKey = chain:hash:wallet`) and classified: a **swap** is a group where the wallet both sends and receives value in the same tx; a **transfer** is one-directional. Pricing then walks a strict precedence ladder, and the first rung that yields a number wins:

1. **Stable leg (HIGH, `SWAP_LEG_STABLE`).** If one side of the swap is a configured stablecoin, that side's face value *is* the USD value of the whole swap, and the memecoin's implied unit price = stableUsd ÷ tokenAmount. This is exact, free, and needs no price API.
2. **Native leg (HIGH, `SWAP_LEG_NATIVE`).** If one side is the chain's native asset, value the swap at nativeAmount × the native USD price nearest the timestamp (`NativePriceSnapshot`, refreshed each pricing run and cheap because there are only a handful of native assets). Implied token price follows.
3. **Configured stable transfer (HIGH, `STABLE_PAR`).** A plain stablecoin transfer is valued 1:1.
4. **DexScreener at ingest (MEDIUM, `DEXSCREENER`).** For transfers of non-stable tokens with no priceable leg, take the token's current price/marketCap/liquidity from DexScreener at ingest time and persist it as a `PriceSnapshot`. This is accurate for fresh events (the normal live path) and degrades for historical backfill, which is recorded honestly via `confidence`.
5. **CoinGecko historical (LOW, `COINGECKO`).** Optional, only when a `COINGECKO_API_KEY` exists and the event is older than the DexScreener-useful window; daily granularity, so `LOW`.
6. **Unknown (`UNKNOWN`).** `amountUsd` stays `null`. The UI renders `—` with a tooltip explaining why; threshold rules treat null as non-satisfying, never as 0.

`marketCapAtAction` (FR-4.1) and `entryMarketCap` (FR-7.1) come from the same snapshot: implied unit price × `totalSupplyRaw` when supply is known, else DexScreener's reported marketCap, else null. `tokenAgeSeconds` = event timestamp − `Token.deployedAt` (from `getTokenInfo`'s contract-creation lookup), falling back to `pairCreatedAt`, else null — and T3's "< 1h old" and T1's "< 7 days" **do not fire** when age is null, because a null age must never be treated as young. Every USD number is written once at ingest; nothing downstream recomputes it (§10.3).

### 4.7 Independence-verdict computation (FR-3.6, FR-4.2, §10.7)

`src/server/services/independence/verdict.ts`

```ts
export interface IndependenceInput {
  a: { address: Address; chain: ChainSlug };
  b: { address: Address; chain: ChainSlug };
  /** Evaluated at this instant; co-entry lookback uses settings.coEntryWindows. */
  asOf: Date;
}

export interface IndependenceResult {
  independent: boolean;
  /** Every reason the pair is NOT independent; empty ⇒ independent. */
  links: Array<{
    kind: RelationKindName;
    statement: string;                 // rendered verbatim by the UI
    detail: Record<string, unknown>;   // evidence numbers + tx hashes
  }>;
}

export interface WalletVerdict {
  wallet: { address: Address; chain: ChainSlug };
  /** FR-3.6 statement list, or the single INDEPENDENT line. */
  statements: string[];
  isIndependentOfAll: boolean;
  relatedWallets: Array<{ address: Address; chain: ChainSlug; kinds: RelationKindName[] }>;
}

export declare function areMutuallyIndependent(input: IndependenceInput): Promise<IndependenceResult>;
export declare function computeWalletVerdict(wallet: { address: Address; chain: ChainSlug }): Promise<WalletVerdict>;
export declare function rebuildWalletRelations(scope?: { address?: Address; chain?: ChainSlug }): Promise<{ rowsWritten: number }>;
```

**Algorithm, in plain language.** Independence is defined by FR-4.2 as "different funders AND no direct interaction edge". The plan computes and *stores* it as `WalletRelation` rows (§10.7: a first-class computation, not a UI afterthought), because both the graph panel (FR-3.6) and the radar's grouping (FR-4.2, T2) must agree exactly, and because scanning transactions per grouping candidate would blow the NFR-7 budgets.

1. **SHARED_FUNDER.** For each pair of tracked wallets, intersect the sets of non-terminal funder addresses in their funding trees (`FundingEdge` where `isTerminalEntity = false`). A non-empty intersection creates a relation whose statement reads `Connected to {shortB} via shared funder {shortFunder}`. Terminal entities are excluded deliberately: two unrelated traders both withdrawing from Binance are not related, and treating them as related would suppress genuine co-accumulation signals.
2. **DIRECT_TRANSFER.** If an `InteractionEdge` exists for the pair with `txCount ≥ 1`, create a relation: `Connected to {shortB} via direct transfers ({txCount} txs, {usd})`. The USD figure and count come straight off the aggregated edge (FR-3.2/FR-3.3), so the verdict text and the graph edge label can never disagree.
3. **SAME_CLUSTER.** Membership of the same `Cluster` (which is itself shared-funder-derived) creates its own relation kind so FR-4.4's cluster co-entry can be reported separately from generic shared funding.
4. **CO_ENTRY.** Count tokens where both wallets have a `BUY` `MovementEvent` inside the configured window (default 24h; the same `coEntryWindows` setting the radar uses). ≥ 1 such token creates `Connected to {shortB} via co-entry ({n} tokens within {window})`. **This kind is informational for FR-3.6's statement list and is excluded from the FR-4.2 independence test**, because including it would be circular: co-entry is the very thing being detected, so using it as evidence of dependence would make every co-accumulation group self-cancel. `DECISION:` FR-3.6's example explicitly lists co-entry as a connection to display, while FR-4.2 defines independence as "different funders AND no direct interaction edge" only — so the same table serves both, with the radar filtering `kind IN (SHARED_FUNDER, DIRECT_TRANSFER, SAME_CLUSTER)`.
5. **Verdict rendering.** `computeWalletVerdict` loads all relations for a wallet and emits FR-3.6's statement list; when there are none it emits the single line `INDEPENDENT — no funding, transfer, or co-entry relationship with any other tracked wallet.` verbatim.
6. **Maintenance.** `rebuildWalletRelations` is invoked at the end of intake, after any funding trace, after cluster changes, and by `derive.rebuild`. Rows are upserted on `wallet_relation_key` and stale rows for the scope are deleted in the same transaction, so a removed relationship disappears instead of lingering.

### 4.8 Alert-rule evaluator, A1–C4 (FR-5.1–FR-5.5)

`src/lib/rules/` holds one pure function per rule plus the registry; `src/server/services/alert/` orchestrates.

```ts
// ── Shared rule types ────────────────────────────────────────────────────────
export interface RuleContext {
  wallet: { address: Address; chain: ChainSlug; watchPriority: 'HIGH' | 'NORMAL'; isSelf: boolean; gradeLabel: string | null; hasGrade: boolean };
  state: { current: 'IDLE' | 'ARMED' | 'TRIGGERED'; armedAt: Date | null; triggeredAt: Date | null; stablePeakUsd: string | null; stablePeakAt: Date | null; baselineStableUsd: string | null; baselineNativeUsd: string | null; deArmStreakDays: number };
  /** Events inside the rule's lookback, already USD-priced and ordered. */
  events: MovementEventRow[];
  /** Pre-computed baselines so rules stay pure. */
  stats: {
    medianDailyStableInflowUsd: string | null;
    medianDailyNativeInflowUsd: string | null;
    stableBalanceUsd: string | null;
    nativeBalanceUsd: string | null;
    lastActivityAt: Date | null;
    dormantDays: number | null;
  };
  positions: PositionRow[];
  cluster: { id: string; name: string; memberAddresses: Array<{ address: Address; chain: ChainSlug }> } | null;
  /** Peers used by T2/C2: independence already resolved (§4.7). */
  peerActivity: Array<{ wallet: { address: Address; chain: ChainSlug }; tokenAddress: Address; kind: 'BUY' | 'SELL' | 'CEX_DEPOSIT'; at: Date; amountUsd: string | null; independentOfSubject: boolean; sameCluster: boolean; hasGrade: boolean }>;
  fundingEvents: Array<{ from: Address; at: Date; amountUsd: string | null; fromEntityKind: EntityKind | null; fromEntityName: string | null; wasFundedByWallet: boolean }>;
  thresholds: AlertThresholds;
  now: Date;
}

export interface RuleFinding {
  type: AlertType;
  state: 'ARMED' | 'TRIGGERED' | 'EXIT_RISK';
  occurredAt: Date;
  token: { address: Address; chain: ChainSlug; symbol: string | null } | null;
  amountUsd: string | null;
  clusterId: string | null;
  /** Machine payload for the alert row and downstream UI. */
  payload: Record<string, unknown>;
  /** FR-5.5: the exact rule, thresholds, observed numbers, and tx links. */
  evidence: {
    ruleId: AlertType;
    ruleText: string;
    thresholds: Record<string, string | number>;
    observed: Record<string, string | number | null>;
    txLinks: Array<{ hash: string; url: string; label: string }>;
    windows?: Record<string, string>;
  };
  /** "<type>:<wallet>:<chain>:<token|->:<bucket>" — unique per logical firing. */
  dedupeKey: string;
}

export type RuleFn = (ctx: RuleContext) => RuleFinding[];

export interface AlertRule {
  id: AlertType;
  title: string;
  category: 'ARMING' | 'TRIGGER' | 'EXIT_RISK';
  /** How far back the evaluator must load events for this rule. */
  lookback: (t: AlertThresholds) => number;   // milliseconds
  evaluate: RuleFn;
}

export declare const ALERT_RULES: Readonly<Record<AlertType, AlertRule>>;

export interface AlertThresholds {
  // A1
  a1MinStableInflowUsd: number;          // 1000
  a1MedianMultiple: number;              // 3
  a1WindowHours: number;                 // 24
  // A2
  a2MinNativeInflowUsd: number;         // 100 (§0 D-4)
  a2MedianMultiple: number;              // 3
  a2WindowHours: number;                 // 24
  // A3
  a3MinCexWithdrawalUsd: number;         // 1000
  // A4
  a4DormancyDays: number;                // 30
  a4MinFundingUsd: number;               // 500
  // A5
  a5MinWallets: number;                  // 2
  a5WindowHours: number;                 // 48
  // A6
  a6MinSweepSources: number;             // 2
  a6WindowHours: number;                 // 48
  // T1
  t1MaxTokenAgeDays: number;             // 7
  t1MinPositionUsd: number;              // 500
  // T2
  t2MinWallets: number;                  // 2
  t2WindowHours: number;                 // 24
  // T3
  t3MaxTokenAgeMinutes: number;          // 60
  // T4
  t4MinDrawdownPct: number;              // 20
  // T5
  t5MinWallets: number;                  // 2
  t5WindowHours: number;                 // 1
  // C1
  c1MinDepositUsd: number;               // 0 (any memecoin deposit)
  // C2
  c2MinWallets: number;                  // 2
  c2WindowHours: number;                 // 12
  // C3
  c3MinMultiple: number;                 // 10
  c3MinAgeDays: number;                  // 3
  c3SelfOnly: boolean;                   // false: evaluate all tracked wallets (§0 D-7)
  // C4
  c4DropPct: number;                     // 70
  c4WindowHours: number;                 // 48
  // De-arm
  deArmBaselinePct: number;              // 120
  deArmConsecutiveDays: number;          // 7
}

// ── Orchestration ────────────────────────────────────────────────────────────
export interface EvaluateAlertsInput {
  mode: 'INCREMENTAL' | 'BACKFILL';
  scope?: { address?: Address; chain?: ChainSlug };
  from?: Date;
  to?: Date;
  rules?: AlertType[];
  onProgress?: (p: JobProgress) => void | Promise<void>;
}

export declare function evaluateAlerts(input: EvaluateAlertsInput): Promise<AlertEvaluateResult>;
export declare function applyStateTransition(
  current: 'IDLE' | 'ARMED' | 'TRIGGERED',
  findings: RuleFinding[],
  deArm: { satisfied: boolean; detail: Record<string, unknown> },
): { next: 'IDLE' | 'ARMED' | 'TRIGGERED'; reason: AlertType | 'DEARM' | null };
```

**Rule algorithms, in plain language.** Each is a pure function over `RuleContext`, so each has a unit test with hand-built context and no I/O. Every rule that compares against a USD threshold **skips** events whose `amountUsd` is null (unpriced ≠ zero, §4.6).

| Rule | Plain-language algorithm |
|---|---|
| **A1 Stablecoin arming** | Sum USD of stable inflow movements (`STABLE_PARK`) in the trailing `a1WindowHours`. Fire ARMED when that sum ≥ max(`a1MinStableInflowUsd`, `a1MedianMultiple` × `medianDailyStableInflowUsd`). Median is over the wallet's non-zero stable-inflow days in `DailyFlow`; when the wallet has fewer than 7 such days the median term is treated as unavailable and only the absolute floor applies. Evidence records the window sum, the median, both threshold arms, and which one bound. |
| **A2 Gas arming** | Sum native inflow (`NATIVE_FUNDING_IN`) in the trailing `a2WindowHours`. Fire when the sum ≥ `max(a2MinNativeInflowUsd, a2MedianMultiple × medianDailyNativeInflowUsd)`. With fewer than 7 qualifying inflow days, the median arm is unavailable and only the $100 default floor applies. Evidence records both arms, whether the wallet was in cold start, and which arm bound (§0 D-4). |
| **A3 CEX withdrawal** | Any funding event whose counterparty resolves to an `EntityLabel` of kind `CEX` with `amountUsd ≥ a3MinCexWithdrawalUsd` fires ARMED. Evidence names the entity ("Binance 14") and links the tx. |
| **A4 Dormancy wake** | If `dormantDays ≥ a4DormancyDays` immediately before the event, and the wallet then receives any funding (native, internal, or stable) with `amountUsd ≥ a4MinFundingUsd`, fire ARMED. Dormancy is measured from `lastActivityAt` *before* the waking event, not after. |
| **A5 Cluster arming (escalated)** | For a cluster, count distinct member wallets funded by the *same* funder inside `a5WindowHours`. When ≥ `a5MinWallets`, fire one cluster-level ARMED finding (highest-priority visual treatment) attributed to every member, with `clusterId` set and the shared funder in evidence. Deduped per (cluster, funder, window bucket) so one coordinated funding wave produces one alert, not one per member. |
| **A6 Consolidation** | Count distinct source addresses sending value *into* the wallet within `a6WindowHours` that the wallet itself has previously funded (`fundingEvents[].wasFundedByWallet`). ≥ `a6MinSweepSources` fires ARMED ("operator gathering ammunition"). Evidence lists each sweep source with amount and tx. |
| **T1 Armed entry** | Wallet state is currently ARMED, and a `BUY` occurs on a token whose age < `t1MaxTokenAgeDays` with position size ≥ `t1MinPositionUsd`. Null token age suppresses the rule (§4.6). Fires TRIGGERED. |
| **T2 Independent co-entry** | For a token, collect `BUY` events by graded wallets (`hasGrade`) inside `t2WindowHours`. Build the participant set greedily in time order, admitting a wallet only if it is mutually independent (§4.7, `SHARED_FUNDER`/`DIRECT_TRANSFER`/`SAME_CLUSTER` absent) of *every* wallet already admitted. When the admitted set reaches `t2MinWallets`, fire TRIGGERED for each participant and cross-reference the `MovementGroup` created by FR-4.2 (same window bucket, same dedupe bucket) so the alert and the radar card point at one another. |
| **T3 Fresh-launch entry** | A graded wallet buys a token whose age < `t3MaxTokenAgeMinutes`. Fires TRIGGERED. Null age suppresses. |
| **T4 Add-on-retrace** | The wallet holds an open `Position` in the token, and a new `BUY` occurs at a price ≤ (1 − `t4MinDrawdownPct`/100) × `Position.peakPriceUsd` (the token's local high since the position opened). Fires TRIGGERED with the drawdown percentage in evidence. Requires a priced buy and a known peak; otherwise suppressed. |
| **T5 Cluster co-entry** | ≥ `t5MinWallets` wallets of the *same* cluster buy the same token within `t5WindowHours`. Fires TRIGGERED, `state` still `TRIGGERED` but flagged `warningStyle: true` in the payload and paired with the FR-4.4 `CLUSTER_CO_ENTRY` movement group so the UI renders it as a coordination warning, never mixed into co-accumulation. |
| **C1 Distribution prep** | A graded wallet's movement of kind `CEX_DEPOSIT` where the token is a non-stable memecoin and `amountUsd ≥ c1MinDepositUsd`. Emits an EXIT_RISK annotation (does **not** change the wallet state — SRS calls these "position management, not wallet states"). |
| **C2 Co-distribution** | ≥ `c2MinWallets` graded wallets produce `SELL` or `CEX_DEPOSIT` on the same token within `c2WindowHours`. Emits EXIT_RISK for each participant, cross-referenced with the FR-4.3 `CO_DISTRIBUTION` group. |
| **C3 Moon discipline** | An open `Position` with `unrealizedMultiple > c3MinMultiple` and `openedAt` older than `c3MinAgeDays`. By default this evaluates every tracked wallet; `c3SelfOnly=true` restricts it to `isSelf` wallets. Findings for `isSelf` wallets carry `selfPriority: true` for more prominent UI treatment. Emits EXIT_RISK and is deduped per (wallet, token, day), so it reminds once a day rather than every 5 minutes (§0 D-7). |
| **C4 Campaign spent** | Within `c4WindowHours` *after* a TRIGGERED event, the wallet's stable balance falls more than `c4DropPct`% below `stablePeakUsd` (the peak recorded since arming). Emits EXIT_RISK with peak, current, and drop percentage. |
| **De-arm** | Stable **and** native balance ≤ `deArmBaselinePct`% of the 30-day baseline for `deArmConsecutiveDays` consecutive daily checks, **or** a funds-return event to a terminal entity (any outflow to an `EntityLabel` with `isTerminal`). Either path sets state to IDLE and resets `deArmStreakDays`, `stablePeakUsd`. |

**Orchestration, in plain language.** `evaluateAlerts` runs single-threaded per queue (concurrency 1) to make alert creation race-free. INCREMENTAL mode selects `MovementEvent` rows with `alertEvaluatedAt IS NULL`, groups them by wallet, loads each wallet's `RuleContext` (state, balances, medians, positions, cluster, independent peers) in one batched query set, runs the arming rules, then the trigger rules, then exit-risk rules, then the de-arm check, and finally persists. BACKFILL mode replays a time range in ascending daily slices with a virtual clock so that a wallet's historical state machine evolves exactly as it would have live (FR-5.4's "historical backfill evaluation runs once after any wallet's first full sync"). Findings are written with `dedupeKey` and an `ON CONFLICT DO NOTHING` semantic, so re-evaluating a window creates zero duplicates (NFR-3); suppressed duplicates are counted in `alertsSuppressed`. State changes are applied by `applyStateTransition` with fixed precedence: de-arm first, then any TRIGGERED finding, then any ARMED finding, then no change — exit-risk findings never alter state. Each new alert is enqueued to `alert.deliver` only when Telegram is enabled (FR-5.3, off by default). Every persisted alert's `evidenceJson` is validated against a Zod schema requiring non-empty `ruleText`, `thresholds`, `observed`, and at least one `txLink` for event-derived rules — a rule that cannot produce evidence fails its unit test rather than shipping a black box (§10.6).

### 4.9 Movement classification, radar grouping, netflow, breadth (FR-4.x)

`src/server/services/movement/classify.ts`, `src/server/services/radar/group.ts`

```ts
export declare function classifyMovements(
  input: { walletAddress: Address; chain: ChainSlug; transactionIds: bigint[] },
  deps: { settings: SettingsSnapshot; entities: EntityService; pricing: PricingService },
): Promise<{ created: number; events: MovementEventRow[] }>;

export interface CoGroupInput {
  kind: 'CO_ACCUMULATION' | 'CO_DISTRIBUTION' | 'CLUSTER_CO_ENTRY';
  windowLabel: '1h' | '6h' | '24h' | '48h';
  from: Date;
  to: Date;
  minWallets: number;
  /** CO_* require mutual independence; CLUSTER_CO_ENTRY requires same cluster. */
  requireIndependence: boolean;
}

export interface CoGroupOutput {
  groups: Array<{
    tokenAddress: Address; chain: ChainSlug; kind: MovementGroupKind;
    windowStart: Date; windowEnd: Date; windowLabel: string;
    combinedUsd: string; walletCount: number; timeSpanSeconds: number;
    supplySharePct: string | null; clusterId: string | null;
    members: Array<{ address: Address; chain: ChainSlug; amountUsd: string | null; actedAt: Date; gradeLabel: string | null; movementId: bigint }>;
    evidence: { ruleId: string; ruleText: string; thresholds: Record<string, string | number>; independenceProof: Array<{ a: string; b: string; independent: boolean; reasons: string[] }>; txLinks: Array<{ hash: string; url: string }> };
  }>;
}

export declare function detectCoGroups(input: CoGroupInput): Promise<CoGroupOutput>;
export declare function computeNetflow(input: { window: '24h' | '7d' | '30d'; asOf: Date; limit: number; offset: number; sort: 'NET_DESC' | 'NET_ASC' | 'GROSS_DESC' }): Promise<NetflowPage>;
export declare function computeBreadth(input: { window: '24h' | '7d'; asOf: Date }): Promise<BreadthResult>;
export declare function computeClusterRotation(input: { clusterId: string; asOf: Date; windowDays: number }): Promise<ClusterRotationResult>;

export interface NetflowPage {
  rows: Array<{ tokenAddress: Address; chain: ChainSlug; symbol: string | null; buysUsd: string; sellsUsd: string; cexDepositsUsd: string; netUsd: string; walletCount: number }>;
  total: number;
  topGainers: NetflowPage['rows'];
  topLosers: NetflowPage['rows'];
}
export interface BreadthResult {
  window: '24h' | '7d';
  priorityWalletCount: number;
  activeWalletCount: number;
  activePct: number;
  /** True when activePct is 0; the UI must say "market quiet" explicitly (FR-4.7). */
  isMarketQuiet: boolean;
}
export interface ClusterRotationResult {
  clusterId: string; windowStart: Date; windowEnd: Date;
  exited: Array<{ tokenAddress: Address; symbol: string | null; usd: string }>;
  entered: Array<{ tokenAddress: Address; symbol: string | null; usd: string }>;
  /** e.g. "Cluster Binance-14-fed rotated: exited [PEPE, WOJAK] → entered [BRETT]" */
  summary: string;
}
```

**Classification, in plain language.** A wallet's transaction rows are grouped by hash into `SwapGroup`s (§4.6) and mapped to `MovementKind`: a swap where the wallet receives a non-stable token → `BUY`; a swap where it sends a non-stable token → `SELL`; a stablecoin inflow → `STABLE_PARK`; a stablecoin outflow → `STABLE_SPEND`; a transfer whose counterparty is a `CEX`-kind entity → `CEX_DEPOSIT` (outgoing) or `CEX_WITHDRAWAL` (incoming); a native value inflow/outflow with no swap → `NATIVE_FUNDING_IN`/`OUT`. A `BUY` on a token the wallet has never held before additionally sets `isFirstEntryForWallet`, which is what FR-4.1's "new token entry" row renders and what `NEW_TOKEN_ENTRY` is emitted for. `CEX_DEPOSIT` of a non-stable token is *both* a movement row and C1's input. All classification happens once, at ingest, with the USD already attached — so the feed, the radar, and the alert engine all read the same immutable facts (FR-4.8).

**Grouping, in plain language.** For a window and token, load candidate movements (`BUY` for co-accumulation; `SELL` + `CEX_DEPOSIT` for co-distribution), order by time, and admit wallets one at a time: for `CO_*` groups a wallet joins only if it is mutually independent of every already-admitted member (§4.7 relation kinds `SHARED_FUNDER`, `DIRECT_TRANSFER`, `SAME_CLUSTER`); for `CLUSTER_CO_ENTRY` the requirement is inverted — all members must share one cluster. A group is emitted when the admitted set reaches `minWallets` (default 2, FR-4.2/FR-4.4). `windowStart` is snapped to a fixed grid (floor of the first member's timestamp to the window length) so the same real-world event always lands in the same bucket and the `movement_group_key` upsert is stable across re-evaluations; later members inside the same bucket extend the existing group rather than creating a second one. `combinedUsd` sums member USD (nulls excluded and counted in evidence); `supplySharePct` = combined token amount ÷ `totalSupplyRaw` when supply is known. Cluster co-entry groups are stored with `clusterId` set and are **excluded from the co-accumulation feed query** by kind, satisfying FR-4.4's "distinct, warning-styled event, not mixed in".

**Netflow, breadth, rotation, in plain language.** Netflow (FR-4.5) is a `DailyFlow` aggregation per token over 24h/7d/30d: net = buys − sells − CEX deposits, all in persisted USD, sortable, with top gainers/losers taken from the same result set. Breadth (FR-4.7) counts HIGH-priority wallets with ≥ 1 `MovementEvent` in the window ÷ total HIGH-priority wallets; when the numerator is zero the result carries `isMarketQuiet: true` and the dashboard states "market quiet" explicitly. Rotation (FR-4.6) takes a cluster's `SELL`/`CEX_DEPOSIT` tokens in the first half of a 7-day window and its `BUY` tokens in the window, subtracts the intersection, and renders the summary sentence; results persist as `ClusterRotation` so the timeline is stable.

### 4.10 Self-trade linker (FR-6.x)

`src/server/services/self/link.ts`

```ts
export interface LinkTradeInput {
  trade: { id: string; ownWallet: { address: Address; chain: ChainSlug }; tokenAddress: Address; tokenChain: ChainSlug; side: 'BUY' | 'SELL'; entryAt: Date; amountUsd: string; entryMarketCap: string | null };
  /** Candidate lookback for a preceding graded-wallet entry. Default 7 days. */
  lookbackMs: number;
  /** Only graded wallets qualify as a followed signal (FR-6.2). */
  requireGraded: boolean;
}

export interface LinkTradeResult {
  followedWallet: { address: Address; chain: ChainSlug } | null;
  lagMinutes: number | null;
  lagMcDelta: string | null;
  walletRoiPct: string | null;
  userRoiPct: string | null;
  lagBucket: '0-1h' | '1-6h' | '6-24h' | '>24h' | null;
  evidence: { candidatesConsidered: number; chosenReason: string; rejected: Array<{ address: string; reason: string }> };
}

export declare function linkTradeToSignal(input: LinkTradeInput): Promise<LinkTradeResult>;
export declare function computeEdgeDecay(input: { followedWallet?: { address: Address; chain: ChainSlug }; minSample: number }): Promise<EdgeDecayResult>;
export declare function computeSelfDashboard(input: { asOf: Date }): Promise<SelfDashboardResult>;

export interface EdgeDecayResult {
  followedWallet: { address: Address; chain: ChainSlug } | null;
  buckets: Array<{ bucket: '0-1h' | '1-6h' | '6-24h' | '>24h'; tradeCount: number; avgUserRoiPct: string | null; avgWalletRoiPct: string | null; winRatePct: string | null }>;
  sampleSize: number;
  /** True when sampleSize < minSample; the chart must say so rather than mislead. */
  insufficientSample: boolean;
}
export interface SelfDashboardResult {
  winRatePct: string; totalPnlUsd: string;
  byFollowedWallet: Array<{ address: Address; chain: ChainSlug; label: string | null; tradeCount: number; pnlUsd: string; avgLagMinutes: number | null }>;
  byToken: Array<{ tokenAddress: Address; chain: ChainSlug; symbol: string | null; tradeCount: number; pnlUsd: string }>;
  byLagBucket: EdgeDecayResult['buckets'];
}
```

**Algorithm, in plain language.** For a user `BUY`, find every `MovementEvent` of kind `BUY` on the same token by a wallet satisfying `settings.gradedDefinition`: `ANY_TAG_OR_COMPUTED` accepts any `edge`/`style`/`size` tag or a computed grade with sufficient sample; `EDGE_TAG_ONLY` accepts only a manual edge tag. Require `timestamp ≤ trade.entryAt` inside `lookbackMs` and exclude the user's own wallets. Choose the **nearest in time before** the user's entry (FR-6.2's "nearest-in-time watchlist entry by a graded wallet"); ties break toward the higher-priority watch wallet, then the larger USD position, then lexicographic address for determinism. `lagMinutes` = user entry − wallet entry (always ≥ 0 on this path); `lagMcDelta` = user entry market cap − wallet entry market cap (null when either is unknown); `walletRoi` uses the followed wallet's `Position` outcome for that token, `userRoi` the user's own. `lagBucket` is derived from `lagMinutes` with the FR-6.4 boundaries 0–1h, 1–6h, 6–24h, >24h (upper bound exclusive). When no candidate exists the trade stays unlinked with a reason recorded; when `isLinkPinned` is true the linker skips the row entirely so a manual choice (FR-6.3) is never overwritten. Manual trades require a non-empty `thesis` (FR-6.3) — enforced by the Zod input schema, not by UI-only validation.

### 4.11 Settings, entities, and tRPC surface

```ts
// src/lib/settings-schema.ts — every DB-backed setting from SRS §9 + Module 5.
export interface SettingsSnapshot {
  stableTokens: Record<ChainSlug, Array<{ address: Address; symbol: string }>>;   // FR-2.5
  alertThresholds: AlertThresholds;                                              // §4.8
  coEntryWindows: Array<'1h' | '6h' | '24h' | '48h'>;                            // FR-4.2
  defaultCoEntryWindow: '1h' | '6h' | '24h' | '48h';                             // '24h'
  coAccumulationMinWallets: number;                                              // 2
  syncCadenceMinutes: number;                                                    // 15
  radarCadenceMinutes: number;                                                   // 5  (FR-5.4)
  minEdgeUsd: number;                                                            // 100 (FR-3.4)
  maxTraceDepth: number;                                                         // 3, cap 6 (FR-2.1)
  profitSinkRatioPct: number;                                                    // 20 (FR-2.4)
  gradedDefinition: 'ANY_TAG_OR_COMPUTED' | 'EDGE_TAG_ONLY';                     // ANY_TAG_OR_COMPUTED (§0 D-5)
  telegram: { enabled: boolean; hasCredentials: boolean };                       // FR-5.3
  timezone: string;                                                              // APP_TIMEZONE
  defaultChain: ChainSlug;                                                       // DEFAULT_CHAIN, default 'base'
  quota: { etherscanDailyLimit: number; reservedForInteractivePct: number };
  priceCacheTtlSeconds: number;
}
export declare function loadSettings(): Promise<SettingsSnapshot>;
export declare function updateSettings(patch: DeepPartial<SettingsSnapshot>): Promise<SettingsSnapshot>;

// src/server/services/entity/index.ts
export interface EntityService {
  lookup(address: Address, chain: ChainSlug): Promise<EntityLabelRow | null>;
  lookupMany(keys: Array<{ address: Address; chain: ChainSlug }>): Promise<Map<string, EntityLabelRow>>;
  isTerminal(address: Address, chain: ChainSlug): Promise<boolean>;
  upsertUserLabel(input: { address: Address; chain: ChainSlug; kind: EntityKind; name: string; isTerminal: boolean; notes?: string }): Promise<EntityLabelRow>;
  seedBundled(): Promise<{ inserted: number; updated: number }>;
}
```

**tRPC router surface (frozen names).** `wallet.{list,get,add,addBatch,update,updateTags,delete,resync,bulkAction,resolveEns,profile,parking}`; `funding.{tree,deepTrace,primaryCandidates}`; `cluster.{list,get,rotation}`; `graph.{load,edgeBreakdown,independence,node}`; `radar.{feed,groups,netflow,breadth,rotation}`; `alert.{list,counts,markRead,markAllRead,testTelegram}`; `self.{trades,addTrade,updateTrade,linkTrade,decay,dashboard,comparison}`; `token.{lookup,refresh,redFlags}`; `settings.{get,update,entityLabels,upsertEntityLabel}`; `jobs.{list,get,retry,cancel}`; `health.{status,quota}`; `maintenance.{prune,backupInfo,rebuild}`. Every input and output is a Zod v4 schema in the router file; every list procedure takes `{ limit, cursor }` and returns `{ rows, nextCursor }` (feed pages of 50 per NFR-7).

### 4.12 Supporting type aliases (defined once, used throughout §4)

Referenced by the signatures above; no task may redefine these with different shapes.

```ts
/** String unions mirroring the Prisma enums of §3.2, used in TS-only code. */
export type UsdSourceName = 'SWAP_LEG_STABLE' | 'SWAP_LEG_NATIVE' | 'DEXSCREENER' | 'COINGECKO' | 'STABLE_PAR' | 'NATIVE_PRICE' | 'UNKNOWN';
export type RelationKindName = 'SHARED_FUNDER' | 'DIRECT_TRANSFER' | 'CO_ENTRY' | 'SAME_CLUSTER';
export type EntityKind = 'CEX' | 'BRIDGE' | 'ROUTER' | 'CONTRACT' | 'HUMAN';
export type TraceStopReason = 'TERMINAL_ENTITY' | 'DEPTH_LIMIT' | 'NO_INBOUND' | 'SELF_REFERENCE' | 'BUDGET_EXHAUSTED' | 'NOT_STOPPED';
export type FundingEdgeKind = 'INITIAL' | 'REPEATED' | 'PROFIT_SINK' | 'PRIMARY';
export type MovementGroupKind = 'CO_ACCUMULATION' | 'CO_DISTRIBUTION' | 'CLUSTER_CO_ENTRY';
export type MovementKindName = 'BUY' | 'SELL' | 'STABLE_PARK' | 'STABLE_SPEND' | 'CEX_DEPOSIT' | 'CEX_WITHDRAWAL' | 'NEW_TOKEN_ENTRY' | 'NATIVE_FUNDING_IN' | 'NATIVE_FUNDING_OUT';
export type AlertType = 'A1'|'A2'|'A3'|'A4'|'A5'|'A6'|'T1'|'T2'|'T3'|'T4'|'T5'|'C1'|'C2'|'C3'|'C4';

/** Row projections: the Prisma model row with Decimals serialized as strings
 *  and bigints as strings at the tRPC boundary. One helper generates all of them. */
export type Row<TModel> = { [K in keyof TModel]: TModel[K] extends object ? string : TModel[K] };
export type TransactionRow    = Row<PrismaTransaction>;
export type MovementEventRow  = Row<PrismaMovementEvent>;
export type PositionRow       = Row<PrismaPosition>;
export type EntityLabelRow    = Row<PrismaEntityLabel>;
export type PriceSnapshotRow  = Row<PrismaPriceSnapshot>;

/** One asset movement being priced (§4.6). */
export interface PricingLeg {
  chain: ChainSlug;
  /** null = the chain's native asset. */
  tokenAddress: Address | null;
  amountRaw: RawAmount;
  decimals: number | null;
  timestamp: Date;
  txHash: string;
  isStable: boolean;
  isNative: boolean;
}

/** Everything the pricing ladder may consult; all I/O is behind these deps. */
export interface PricingContext {
  settings: SettingsSnapshot;
  dexscreener: DexScreenerClient;
  coingecko: CoinGeckoClient | null;
  snapshots: PriceSnapshotStore;
  nativePrices: NativePriceStore;
  swapGroup: SwapGroup | null;
  clock: Clock;
}

/** A movement event before USD attribution and persistence. */
export interface MovementEventDraft {
  walletAddress: Address; walletChain: ChainSlug;
  kind: MovementKindName;
  timestamp: Date;
  tokenAddress: Address | null; tokenChain: ChainSlug | null; tokenSymbol: string | null;
  amountRaw: RawAmount;
  counterpartyAddress: Address | null;
  transactionId: bigint; txHash: string; blockNumber: bigint;
  isFirstEntryForWallet: boolean;
}

/** Narrow persistence ports so services stay unit-testable without a database. */
export interface TransactionStore {
  upsertMany(rows: TransactionRow[]): Promise<{ inserted: number; updated: number }>;
  findInboundValue(address: Address, chain: ChainSlug, opts?: { from?: Date; to?: Date }): Promise<TransactionRow[]>;
  findOutboundValue(address: Address, chain: ChainSlug, opts?: { from?: Date; to?: Date }): Promise<TransactionRow[]>;
  findByHash(chain: ChainSlug, hash: string): Promise<TransactionRow[]>;
}
export interface PriceSnapshotStore {
  nearest(tokenAddress: Address, chain: ChainSlug, at: Date, maxSkewMs: number): Promise<PriceSnapshotRow | null>;
  write(rows: Array<Omit<PriceSnapshotRow, 'id' | 'createdAt'>>): Promise<number>;
}
export interface NativePriceStore {
  nearest(chain: ChainSlug, at: Date, maxSkewMs: number): Promise<{ priceUsd: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } | null>;
  refresh(chains: ChainSlug[]): Promise<number>;
}
export interface PricingService {
  attributeUsd(leg: PricingLeg, context: PricingContext): Promise<UsdAttribution>;
  nativeUsd(chain: ChainSlug, at: Date): Promise<string | null>;
}

/** Injected time source; every service takes one so tests are deterministic. */
export interface Clock { now(): Date; }

/** Local-only structured logger (NFR-1: no remote sinks). */
export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** Recursive partial for settings patches. */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
```

`DexScreenerClient` and `CoinGeckoClient` are the interfaces implemented in P0-T12; `PrismaTransaction`, `PrismaMovementEvent`, `PrismaPosition`, `PrismaEntityLabel`, and `PrismaPriceSnapshot` are the generated model types from §3.2.

---

## 5. Phase-by-Phase Task Breakdown

**How to read a task.** `What` is the deliverable. `Files` lists what is created or touched. `Covers` cites SRS IDs. `Depends` lists task IDs that must be merged first. `DoD` is a verifiable statement — if you cannot demonstrate it, the task is not done. `Tests` names the exact test cases to write; write the failing test first, then the implementation (TDD), then run the suite before claiming completion (`verification-before-completion`).

**Global rules for every task.** Respect §Global Constraints. Never call an external API outside a worker. Never compute USD in a component. All new SQL-visible work goes through Prisma or a repository helper. Every task ends with `pnpm verify` green (`typecheck` + `lint` + `test:unit` + `test:integration`). Do not commit automatically; when the user explicitly authorizes commits, use one scoped Conventional Commit for the verified task.

### 5.0 Stitch-first UI design and approval gate

Every phase from 0 through 6 has a `P*-D01` design task. A design task is a hard prerequisite for that phase's UI code and follows this sequence:

1. The UI/UX designer reads the phase requirements, §7 UI Inventory, relevant API contracts, mandatory empty/degraded states, and approved artifacts from earlier phases.
2. Use the `design-taste-frontend` taste skill to define the visual direction and reject generic dashboard patterns. Convert that direction into a phase-scoped Google Stitch prompt; preserve the dense, desktop-first, dark-theme constraints and accessibility requirements.
3. Generate or revise the phase's screens in **Google Stitch first**. Do not write React components for the phase during this task.
4. Export the result to `docs/design/phase-N/`: Stitch prompt, screen images/HTML where available, interaction notes, responsive/accessibility notes, and updates to the shared `docs/design/DESIGN.md`. Record the Stitch project/screen identifiers so a later session can retrieve the same design.
5. Present the Stitch output to the user and **stop**. The user reviews the UI outside the implementation run and returns with approval or requested revisions. Silence, partial feedback, or approval of a prior phase is not approval for the current phase.
6. After explicit approval, record the date and approved screen identifiers in `docs/design/phase-N/approval.md`. Only then may the phase's UI implementation tasks start. Code must match the approved screens; material visual or interaction changes return to Stitch and repeat the gate.

Backend-only tasks may proceed while a phase design is under review only when they do not create or alter a user-visible surface. Any task combining backend and UI work must split execution at the UI boundary and wait for the approved `P*-D01`. Each phase acceptance spec verifies the implemented UI against the approved Stitch artifacts as well as the SRS behavior.

### Phase 0 — Scaffold

*SRS §8 acceptance: `docker compose up` boots app + DB + Redis; health check page shows Etherscan quota usage.*

#### P0-D01 — Stitch design: application shell and health surface
- **What:** Use the taste skill and Google Stitch to design the global dark shell, navigation, typography, data-density tokens, shared status/progress patterns, and `/health` page. Export and obtain user approval under §5.0 before any Phase 0 UI code.
- **Files:** `docs/design/DESIGN.md`, `docs/design/phase-0/{prompt.md,screen-map.md,interaction-notes.md,approval.md}`, exported Stitch assets.
- **Covers:** NFR-8, SRS §8 Phase 0 UI acceptance, §5.0.
- **Depends:** —
- **DoD:** The Stitch project contains desktop 1440px shell and health screens plus loading, degraded-provider, and quota-exhausted states; exported artifacts are locally readable; the user has explicitly approved the named screen versions and `approval.md` records that approval.
- **Tests:** Design review checklist confirms every Phase 0 route/state in §7 is represented; contrast, focus order, dense-table tokens, and the timezone/block toggle are specified; no Phase 0 React UI code exists before approval.

#### P0-T01 — Project bootstrap and toolchain
- **What:** Initialize the pnpm project with Next.js 16.3 App Router, React 19.2, TypeScript 5.x `strict`, Tailwind CSS 4, shadcn/ui (Tailwind v4 + React 19 preset), ESLint, Vitest (unit + integration projects), and Playwright. Add the `verify`, `dev`, `build`, `worker`, `test`, `e2e` scripts. No feature code.
- **Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `components.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder), `.gitignore`, `.dockerignore`.
- **Covers:** SRS §7 (stack pinning), NFR-8 (dark theme scaffolding).
- **Depends:** P0-D01 (approved)
- **DoD:** `pnpm install && pnpm typecheck && pnpm lint && pnpm build` all succeed; `pnpm test:unit` runs with zero tests and exits 0; the placeholder page renders dark-themed at 1440px.
- **Tests:** `smoke: tsconfig has strict true`; `smoke: next config sets output standalone and disables telemetry`.

#### P0-T02 — Docker Compose runtime and localhost binding
- **What:** Author the multi-stage `Dockerfile` (node:24-alpine; deps → build → runtime) and `docker-compose.yml` with the one-shot `migrate` service plus `app`, `worker`, `postgres:18`, and `redis:8`. P0-T16 adds the pre-migration backup step after the backup command exists. Every published port binds to `127.0.0.1` only. Add `docker-compose.test.yml` exposing test Postgres on 5433 and Redis on 6380.
- **Files:** `Dockerfile`, `docker-compose.yml`, `docker-compose.test.yml`, `package.json` (scripts `worker`, `db:migrate`).
- **Covers:** SRS §7 (Docker Compose), NFR-1 (localhost-only), NFR-2 (separate worker process).
- **Depends:** P0-T01
- **Approved amendment (2026-09-04):** add the minimal scaffold `GET /health`
  route required by this task's Compose smoke test; P0-T15 replaces it with
  the real health surface.
- **Approved amendment (2026-09-05):** Next.js cannot define both a page and
  route handler at `/health`; keep the UI at `/health`, expose the JSON health
  probe at `/api/health`, and point Docker healthchecks at `/api/health`.
- **DoD:** `docker compose up` starts all services; `docker compose ps` shows app healthy; `curl http://127.0.0.1:3000/health` returns 200; `ss -ltn` (or compose port output) shows no 0.0.0.0 bindings for app, Postgres, or Redis.
- **Tests:** `compose: no service publishes on 0.0.0.0` (parse `docker-compose.yml` and assert every `ports` entry is `127.0.0.1:`-prefixed); `compose: worker service runs the worker entrypoint, not next start`.

#### P0-T03 — Environment validation and `.env.example`
- **What:** Implement `src/lib/env.ts` as a Zod v4 schema over `process.env` covering the known SRS §9 variables, failing fast at boot with a readable message that names the missing key. Write `.env.example` with no secrets and the non-secret defaults `APP_TIMEZONE=Asia/Jakarta`, `DEFAULT_CHAIN=base`, and `DEXSCREENER_ENABLED=true`. P0-T18 extends both files if its selected read-only Robinhood provider needs another credential.
- **Files:** `src/lib/env.ts`, `.env.example`, `src/lib/errors.ts`.
- **Covers:** SRS §9, NFR-1 (keys only in `.env`).
- **Depends:** P0-T01
- **DoD:** Booting without `DATABASE_URL` prints `Missing required environment variable: DATABASE_URL` and exits non-zero; optional keys (`COINGECKO_API_KEY`, `TELEGRAM_*`) absent do not block boot; `.env.example` key set equals the schema's key set.
- **Tests:** `env: rejects missing DATABASE_URL`; `env: rejects missing ETHERSCAN_API_KEY`; `env: allows absent optional telegram and coingecko keys`; `env: .env.example lists every schema key exactly once`; `env: DEFAULT_CHAIN must be a known ChainSlug`.

#### P0-T04 — Prisma schema, initial migration, client singleton
- **What:** Create `prisma/schema.prisma` **verbatim from §3.2 of this plan** (all models, enums, relations, indexes), generate migration `0001_phase0_initial`, and add the `PrismaClient` singleton with the Postgres driver adapter and query logging in development only.
- **Approved amendment (2026-09-05):** Prisma 7 no longer accepts a datasource `url` in `schema.prisma`; keep the schema model contract unchanged, move the migration URL to a root `prisma.config.ts`, and configure the generated client with the Postgres driver adapter.
- **Files:** `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/0001_phase0_initial/migration.sql`, `src/server/db/client.ts`.
- **Covers:** SRS §4 (all entities, all five mandated indexes), §3.4 of this plan.
- **Depends:** P0-T02
- **DoD:** `pnpm prisma migrate deploy` applies cleanly on an empty Postgres 18; `pnpm prisma validate` passes; a query against every model compiles under `strict`; all five SRS-mandated indexes exist in `migration.sql`.
- **Tests:** `schema: every SRS §4 entity exists with its documented fields` (introspect the generated client's model list and field names); `schema: Transaction has unique(chain,hash,kind,ordinal)`; `schema: the five SRS-mandated indexes are present`; `schema: Wallet primary key is (address, chain)`; `schema: no Float column exists anywhere`.

#### P0-T05 — Settings store with typed defaults
- **What:** Implement the DB-backed settings layer: `src/lib/settings-schema.ts` (Zod schema + `SettingsSnapshot` from §4.11 with every default value listed there and in §4.8), `src/server/services/settings/index.ts` (`loadSettings`, `updateSettings`, in-process cache invalidated on write and on a Redis pub/sub message so app and worker stay consistent), and `prisma/seed/default-settings.ts`.
- **Files:** `src/lib/settings-schema.ts`, `src/server/services/settings/index.ts`, `prisma/seed/default-settings.ts`.
- **Covers:** SRS §9 (DB-backed settings, all alert thresholds), FR-2.1 (`maxTraceDepth`), FR-2.4 (`profitSinkRatioPct`), FR-2.5 (`stableTokens`), FR-3.4 (`minEdgeUsd`), FR-4.2 (`coEntryWindows`), FR-5.4 (`radarCadenceMinutes`).
- **Depends:** P0-T04
- **DoD:** `loadSettings()` on a fresh DB returns every documented default; `updateSettings({ alertThresholds: { a1MinStableInflowUsd: 2500 } })` persists and a subsequent `loadSettings()` in the *worker* process observes 2500 within one second; an invalid patch (e.g. `maxTraceDepth: 9`) is rejected with a field-level error.
- **Tests:** `settings: defaults match the SRS-documented values`; `settings: maxTraceDepth above 6 is rejected`; `settings: profitSinkRatioPct outside 0..100 is rejected`; `settings: unknown key is rejected`; `settings: update then load returns the patched value`; `settings: cache invalidates across processes on pub/sub message`.

#### P0-T06 — Bundled entity dataset and `EntityService`
- **What:** Assemble `prisma/seed/entity-labels.json` from open-source address-tag lists covering CEX hot wallets, bridges, and major DEX routers for every chain in the `Chain` enum, and implement `EntityService` (§4.11) with batched `lookupMany`, `isTerminal`, `upsertUserLabel`, and an idempotent `seedBundled` that never overwrites `source: USER` rows. Default terminality: `CEX`, `BRIDGE`, `ROUTER`, `CONTRACT` terminal; `HUMAN` non-terminal.
- **Files:** `prisma/seed/entity-labels.json`, `prisma/seed/seed.ts`, `src/server/services/entity/index.ts`.
- **Covers:** FR-2.3, FR-2.2 (terminal classification source), SRS §5 (bundled entity dataset).
- **Depends:** P0-T04
- **DoD:** `pnpm seed` inserts the reviewed label set for Base, BSC, and Robinhood, including at least one verified Binance hot wallet on BSC; re-running `pnpm seed` reports 0 inserted / N updated and leaves a manually edited USER row untouched; `isTerminal` returns true for a seeded CEX address and false for an unlabeled address. Missing Robinhood labels are an explicit dataset-coverage warning, not fabricated mappings.
- **Tests:** `entity: seed is idempotent across two runs`; `entity: seed does not overwrite a USER-sourced label`; `entity: HUMAN kind is never terminal by default`; `entity: lookupMany batches N keys into one query and returns a keyed map`; `entity: upsertUserLabel can mark an arbitrary address terminal`; `entity: addresses in the dataset are all lowercase and 42 chars`.

#### P0-T07 — Redis token bucket, daily budget, usage recorder
- **What:** Implement the atomic Lua token bucket (`src/lib/ratelimit/token-bucket.ts`), the daily-budget guard with an interactive reserve, the `UsageRecorder` writing `ApiUsageDaily`, and `snapshot()` for the health page. Buckets are per provider: the Etherscan bucket is shared by Base/BSC, while the Robinhood provider selected in P0-T18 has its own verified limit and bucket.
- **Files:** `src/lib/ratelimit/token-bucket.ts`, `src/lib/ratelimit/budget.ts`, `src/lib/ratelimit/usage.ts`, `src/lib/ratelimit/index.ts`.
- **Covers:** SRS §5 (rate limits), §10.5, NFR-2, §6 of this plan.
- **Depends:** P0-T04
- **DoD:** With `refillPerSecond: 4, capacity: 5`, 20 concurrent `acquire(1, 'BACKGROUND')` calls complete in ≥ 3.75 s and never exceed 5 grants in any 1-second window (measured); after the daily counter passes `dailyLimit − reserve`, `BACKGROUND` acquisitions throw `DailyBudgetExceededError` while `INTERACTIVE` still succeeds; `ApiUsageDaily` reflects each call.
- **Tests:** `ratelimit: never grants more than capacity in a burst`; `ratelimit: sustained rate matches refillPerSecond within 10%`; `ratelimit: two processes share one bucket atomically`; `ratelimit: acquire rejects after maxWaitMs`; `budget: background refused inside the interactive reserve`; `budget: interactive allowed until the hard daily limit`; `budget: counter resets at UTC midnight`; `usage: records ok/error/rate_limited separately`.

#### P0-T08 — Etherscan V2 client core: single page, errors, retry, cache
- **What:** Implement `fetchPage` with the error taxonomy from §4.2 (including treating `status: "0"` + "No transactions found" as `EMPTY_RESULT`, i.e. success), full-jitter exponential backoff per `RetryPolicy`, the adaptive brake on `RATE_LIMITED`, and the two-tier `ProviderCache` (Redis hot + `ProviderCacheEntry` cold) keyed by the deterministic params hash.
- **Files:** `src/lib/etherscan/client.ts`, `src/lib/etherscan/errors.ts`, `src/lib/etherscan/endpoints.ts`, `src/lib/cache/provider-cache.ts`.
- **Covers:** SRS §5, §10.5, NFR-1 (server-side only).
- **Depends:** P0-T07
- **DoD:** Against a stubbed HTTP layer: a 429/"Max rate limit reached" response is retried with increasing jittered delays and eventually succeeds; an invalid-key response fails immediately without retry and surfaces `INVALID_API_KEY`; an "empty result" response yields `rows: []` with no error; a repeat call with identical params hits the cache and spends no token.
- **Tests:** `etherscan: rate-limit response is retried up to maxAttempts`; `etherscan: invalid API key is not retried`; `etherscan: daily-limit response raises DAILY_LIMIT_REACHED`; `etherscan: "No transactions found" returns empty rows, not an error`; `etherscan: 5xx is retried, 400 is not`; `etherscan: backoff delays are jittered and capped at maxDelayMs`; `cache: identical params produce identical keys`; `cache: cached response does not consume a rate-limit token`; `cache: cold cache entry survives a Redis flush`.

#### P0-T09 — Pagination walker (`fetchAllPages`)
- **What:** Implement the block-window advancement algorithm from §4.2 exactly, including boundary-block discard and re-fetch, the single-block `page`-increment fallback, `maxRecords`/`maxPages`/`AbortSignal` truncation, per-page `PageMeta` emission, and the guarantee that `coveredThroughBlock` never exceeds the last fully covered block.
- **Files:** `src/lib/etherscan/pagination.ts`, `src/lib/etherscan/client.ts` (wire-up).
- **Covers:** SRS §5 (1,000-record cap), §10.5, NFR-4 (cursor correctness).
- **Depends:** P0-T08
- **DoD:** With a fake provider holding 2,500 records across 3 blocks and a page cap of 1,000, the walker returns exactly 2,500 unique records, emits ≥ 3 `PageMeta` entries, and reports `coveredThroughBlock` equal to the requested `toBlock`; with `maxRecords: 1,000` it returns 1,000 records, `truncated: true`, and a `coveredThroughBlock` strictly below `toBlock`.
- **Tests:** `pagination: full page triggers window advancement`; `pagination: partial page ends the walk`; `pagination: no record is dropped at a block boundary`; `pagination: no record is duplicated after boundary re-fetch`; `pagination: single hot block falls back to page increment`; `pagination: maxRecords sets truncated and holds back the cursor`; `pagination: maxPages guard stops runaway walks`; `pagination: abort signal stops immediately and reports partial coverage`; `pagination: coveredThroughBlock never exceeds the last complete block`.

#### P0-T10 — `ChainAdapter` types, chain registry, Base/BSC `EtherscanV2Adapter`
- **What:** Write `src/lib/chains/types.ts` verbatim from §4.1, the metadata registry for all three `Chain` enum members, and `createEtherscanV2Adapter` for Base and BSC implementing all ten interface methods over the client, with lowercase-branded addresses, UTC date conversion, and explorer URL builders. Register Robinhood metadata (chain ID 4663, ETH, official explorer) but leave adapter construction behind an explicit `ProviderNotConfiguredError` until P0-T18.
- **Files:** `src/lib/chains/types.ts`, `src/lib/chains/registry.ts`, `src/lib/chains/etherscan-v2-adapter.ts`, `src/lib/chains/index.ts`.
- **Covers:** NFR-9, SRS §10.9, FR-4.8 (explorer URLs), FR-7.2 (`getTokenHolderSummary`).
- **Depends:** P0-T09
- **Approved amendment (2026-09-05):** adapter construction remains explicit
  dependency injection. The acceptance shorthand `getAdapter('base')` means
  `getAdapter('base', { base: () => configuredAdapter })`; the registry never
  creates an implicit network client or owns provider credentials. The same
  contract applies to BSC and Robinhood.
- **DoD:** `getAdapter('base', { base: factory })` returns chain ID 8453 and `getAdapter('bsc', { bsc: factory })` returns chain ID 56; all four NFR-9 methods plus the six support methods are implemented and typed for both; Robinhood registry metadata is correct and unconfigured construction fails explicitly; no chain-specific literal appears outside `src/lib/chains/**` and provider-client directories, verified by a grep-based test.
- **Tests:** `adapter: BASE, BSC, and ROBINHOOD have registry metadata`; `adapter: Base and BSC map Etherscan fields onto RawNativeTx`; `adapter: getInternalTxs preserves traceId and never collapses two traces of one hash`; `adapter: getTokenTransfers preserves logIndex`; `adapter: timestamps are parsed as UTC`; `adapter: addresses are lowercased`; `adapter: empty history returns an empty array, not an error`; `adapter: explorerTxUrl builds the correct host per chain`; `adapter: Robinhood fails explicitly before P0-T18`; `boundary: no chain literal outside provider boundary directories`.

#### P0-T11 — `MockChainAdapter`, fixture scenarios, recorder script
- **What:** Implement `createMockChainAdapter` and `loadScenario` per §4.1 (honouring block ranges, sort, `maxRecords`, and `pageCap` slicing, exposing `stats()`), author the initial scenario set, and add `scripts/record-fixtures.ts` to capture real responses into `tests/fixtures/etherscan/**` for later realism. Initial scenarios: `cex-funded-single`, `cluster-of-three`, `co-entry-24h`, `internal-tx-funded`, `dormant-wake`, `hot-block-2500`, `self-wallet-trades`.
- **Files:** `src/lib/chains/mock-adapter.ts`, `tests/fixtures/scenarios/*.json`, `tests/helpers/scenario.ts`, `scripts/record-fixtures.ts`.
- **Covers:** SRS §8 (all phase acceptance criteria are demonstrable offline), NFR-2 (deterministic job tests).
- **Depends:** P0-T10
- **DoD:** Every scenario loads and type-checks against `MockScenario`; the mock satisfies the same test suite as the real adapter for shape conformance; `hot-block-2500` reproduces the P0-T09 pagination case with zero network calls; `stats()` reports per-method call counts used by §6 quota tests.
- **Tests:** `mock: honours fromBlock/toBlock filtering`; `mock: slices results into pageCap-sized pages`; `mock: sort asc/desc respected`; `mock: stats counts calls per method`; `mock: internal-tx-funded scenario exposes funding visible only via internal traces`; `mock: conforms to the ChainAdapter contract suite`.

#### P0-T12 — DexScreener and CoinGecko clients
- **What:** Implement the DexScreener client (batch up to 30 token addresses per request, own token bucket at 3 rps, `priceCacheTtlSeconds` caching, pair discovery returning primary pair/liquidity/marketCap/FDV) and the optional CoinGecko client (own bucket at 0.5 rps, historical daily price by contract address, every failure degrading to `null`).
- **Files:** `src/lib/dexscreener/client.ts`, `src/lib/dexscreener/types.ts`, `src/lib/coingecko/client.ts`.
- **Covers:** SRS §5 (DexScreener, CoinGecko rows), §10.3.
- **Depends:** P0-T07
- **DoD:** A 45-address price request issues exactly 2 HTTP calls; a DexScreener 5xx retries then degrades to `null` without throwing into the caller; with no `COINGECKO_API_KEY`, the CoinGecko client reports itself disabled and every method returns `null` immediately with no HTTP call.
- **Tests:** `dexscreener: batches 45 addresses into 2 calls`; `dexscreener: caches within TTL and skips the second call`; `dexscreener: unknown token returns null, not an error`; `dexscreener: extracts priceUsd, marketCap, liquidityUsd, fdv, pairCreatedAt`; `coingecko: disabled without an API key`; `coingecko: failure degrades to null`.

#### P0-T13 — Queue infrastructure, `JobRun` projection, Bull Board
- **What:** Create the seven queues from §4.3 with their default job options and concurrencies, the `QueueEvents` listener that mirrors state into `JobRun`, `src/lib/queue/contracts.ts` (names, payload Zod schemas, `JobProgress`), the worker entrypoint, the repeatable-job registration module, and the Bull Board route guarded to loopback requests only.
- **Files:** `src/lib/queue/contracts.ts`, `src/lib/queue/progress.ts`, `src/server/workers/queues.ts`, `src/server/workers/main.ts`, `src/server/workers/schedules.ts`, `src/server/workers/job-run-projection.ts`, `src/app/api/bull-board/[[...path]]/route.ts`.
- **Covers:** NFR-2, SRS §7 (BullMQ + Bull Board), FR-5.4 (cadence registration point).
- **Depends:** P0-T04, P0-T03
- **DoD:** A trivial `noop` job enqueued from a tRPC procedure is executed by the worker container, and its `JobRun` row transitions `QUEUED → RUNNING → COMPLETED` with `progressPct` reaching 100; a request to `/api/bull-board` from a non-loopback address is refused with 403; enqueueing the same deterministic `jobId` twice yields one job.
- **Tests:** `queue: duplicate deterministic jobId enqueues once`; `queue: JobRun row mirrors queued/running/completed transitions`; `queue: failed job records error text and attemptsMade`; `queue: progress updates are monotonic and clamp to 100`; `queue: bull-board route refuses non-loopback requests`; `queue: worker registers every queue named in QUEUES`.

#### P0-T14 — tRPC server, client provider, health router
- **What:** Wire tRPC v11 (`initTRPC`, context with `prisma`/queues/settings/clock, error formatter mapping `AppError` to tRPC codes), the single HTTP route handler, the TanStack Query v5 client provider, and the `health` router returning DB status, Redis status, queue depths, migration version, and quota snapshots for Etherscan, the selected Robinhood provider, and DexScreener.
- **Files:** `src/server/trpc/trpc.ts`, `src/server/trpc/context.ts`, `src/server/trpc/root.ts`, `src/server/trpc/routers/health.ts`, `src/app/api/trpc/[trpc]/route.ts`, `src/lib/trpc/client.tsx`, `src/lib/logger.ts`.
- **Covers:** SRS §7 (tRPC v11 + TanStack Query v5), SRS §8 Phase 0 acceptance (quota display), NFR-1.
- **Depends:** P0-T13, P0-T07
- **DoD:** `health.status` returns `{ db: 'ok', redis: 'ok', queues: {...}, migration: '0001_phase0_initial' }` from a browser call; `health.quota` returns one `RateLimiterSnapshot` per enabled provider including `callsToday`, `dailyLimit` when known, and `remainingToday` when known; end-to-end types flow to the client with no `any`.
- **Tests:** `health: reports db down when Postgres is unreachable`; `health: reports redis down when Redis is unreachable`; `health: quota snapshot includes callsToday and remainingToday`; `trpc: AppError maps to the expected tRPC code`; `trpc: context exposes an injectable clock`.

#### P0-T15 — App shell and health page (Phase 0 acceptance surface)
- **What:** Build the approved dark-theme app shell (sidebar navigation with every route from §7, timezone provider reading `APP_TIMEZONE`, dense-table design tokens) and `/health` page rendering DB/Redis/queue status, migration version, per-provider quota/usage, and a link to Bull Board. Match the approved P0-D01 Stitch artifacts.
- **Files:** `src/app/layout.tsx`, `src/app/health/page.tsx`, `src/components/shared/StatusCard.tsx`, `src/components/shared/QuotaMeter.tsx`, `src/components/shared/TimeCell.tsx`, `src/components/shared/UsdCell.tsx`.
- **Covers:** SRS §8 Phase 0 acceptance, NFR-8, SRS §10.8 (timezone rendering).
- **Depends:** P0-T14
- **DoD:** After `docker compose up`, `http://127.0.0.1:3000/health` shows all-green status and usage for Etherscan, Robinhood provider, and DexScreener, displaying `unknown` rather than inventing a limit when a provider publishes none; a UTC timestamp renders in `Asia/Jakarta` and switches to block-number display; the surface matches approved Stitch screens.
- **Tests (e2e `tests/e2e/phase0.spec.ts`):** `phase0: health page renders db, redis, and queue status`; `phase0: health page displays every enabled provider and known/unknown quota state`; `phase0: time cell renders in APP_TIMEZONE and toggles to block display`; `phase0: navigation lists every top-level route`; `phase0: visual review matches approved Stitch artifacts`.

#### P0-T16 — Backup and restore scripts
- **What:** Implement `scripts/backup.ts` (`pg_dump` from the compose Postgres into `./backups/watchtower-<ISO-timestamp>.sql.gz`, exit non-zero on failure, print the path and write inspectable backup metadata) and `scripts/restore.ts` (explicit `--confirm` flag required, refuses to run against a non-empty DB without `--force`). Wire `npm run backup` exactly as NFR-6 names it, plus a `pnpm backup` alias, and make a successful backup a required pre-step of the `migrate` compose service. Do not schedule recurring backups and do not auto-delete backup files (§0 D-10).
- **Files:** `scripts/backup.ts`, `scripts/restore.ts`, `package.json`, `.gitignore` (`/backups`).
- **Covers:** NFR-6, NFR-5.
- **Depends:** P0-T02
- **DoD:** `npm run backup` produces a timestamped gzip in `./backups/` that `pg_restore --list` (or `gunzip | head`) can read; restore into a fresh database reproduces schema and row counts; migration aborts without applying changes if its pre-migration backup fails; `restore` without `--confirm` exits non-zero and changes nothing; no recurring backup or retention deletion job exists.
- **Tests:** `backup: writes a timestamped file and metadata into ./backups`; `backup: exits non-zero when pg_dump fails`; `migration: failed pre-backup prevents migrate deploy`; `restore: refuses without --confirm`; `restore: round-trips row counts for a seeded database`; `backup: no scheduled job creates or deletes backups`.

#### P0-T17 — Test harness and `pnpm verify`
- **What:** Build the shared test helpers: ephemeral DB reset (truncate all tables in FK-safe order), queue drain/flush, fixture loaders, a `FakeClock` implementing the injected `Clock` interface, and an HTTP stub layer for provider clients. Add the `verify` script chaining `typecheck → lint → test:unit → test:integration`, and document the one-command test bootstrap using `docker-compose.test.yml`.
- **Files:** `tests/helpers/db.ts`, `tests/helpers/queue.ts`, `tests/helpers/clock.ts`, `tests/helpers/http-stub.ts`, `tests/helpers/index.ts`, `vitest.config.ts`, `package.json`.
- **Covers:** NFR-2/NFR-3 verifiability; enables every later task's `Tests` block.
- **Depends:** P0-T04, P0-T13
- **DoD:** `pnpm verify` runs green from a clean checkout with only `docker compose -f docker-compose.test.yml up -d` as a prerequisite; integration tests reset state between files with no cross-test leakage; `FakeClock` controls every timestamp used by services under test.
- **Tests:** `harness: db reset truncates every table`; `harness: two integration tests do not share rows`; `harness: FakeClock advances deterministically`; `harness: http stub asserts unexpected outbound calls`.

#### P0-T18 — Robinhood Chain provider proof and `RobinhoodChainAdapter`
- **What:** Probe the official Robinhood Blockscout/PRO API, a managed read-only data API, and JSON-RPC against every §4.1 operation. Record coverage, pagination, rate limits, credentials, cost, internal-transaction fidelity, and failure behavior in an ADR; choose the smallest provider combination that supplies complete normal/internal/ERC-20 history and token metadata; implement `RobinhoodChainAdapter` behind the frozen interface. Verify DexScreener token/pair coverage separately and retain the §4.6 `UNKNOWN` degradation path when pricing is absent. No mainnet transaction may be signed or broadcast.
- **Files:** `docs/decisions/0001-robinhood-data-provider.md`, `scripts/probe-robinhood-provider.ts`, `src/lib/chains/robinhood-adapter.ts`, provider client files under `src/lib/robinhood/`, `src/lib/env.ts` and `.env.example` when a read-only key is required, `tests/fixtures/robinhood/**`.
- **Covers:** §0 D-1, NFR-9, FR-1.3, FR-2.1, SRS §10.4, §10.5.
- **Depends:** P0-T10, P0-T11, P0-T17
- **DoD:** The ADR names one selected provider strategy and its verified limits; any paid tier, new vendor account, or credential purchase received explicit user approval before selection; `getAdapter('robinhood')` returns chain ID 4663; the adapter passes the same contract suite as Base/BSC for normal/internal/ERC-20 transactions, balances, token info, timestamps, pagination, and explicit empty/error states; recorded fixtures run offline; missing price coverage produces `UNKNOWN`, never zero; the task performs no signing or broadcast.
- **Tests:** `robinhood: registry uses chain id 4663 and official explorer`; `robinhood: contract suite matches Base/BSC semantics`; `robinhood: internal traces preserve stable unique ordinals`; `robinhood: pagination loses and duplicates zero rows at page boundaries`; `robinhood: provider quota errors map to typed retry behavior`; `robinhood: absent market price degrades to UNKNOWN`; `robinhood: adapter exposes no signing or send-transaction method`; `boundary: Robinhood provider shapes do not escape src/lib/chains or src/lib/robinhood`.

### Phase 1 — Registry & Funding Tracer

*SRS §8 acceptance: import 10 wallets via CSV → each shows a profile with stats + funding tree; a known CEX funder displays as terminal entity; shared funders auto-create clusters; deep-trace button extends a branch.*

Covers FR-1.1–1.8 and FR-2.1–2.8 with the intake pipeline as background jobs.

#### P1-D01 — Stitch design: wallet registry, profile, and funding tracer
- **What:** Use the taste skill and Google Stitch to design `/wallets`, `/wallets/new`, wallet detail, cluster index/detail, import progress/errors, tagging, both heatmap modes and their toggle, parking timeline, funding tree, primary-wallet evidence, deep trace, and entity-label editing. Reuse the approved Phase 0 design system and obtain user approval under §5.0.
- **Files:** `docs/design/DESIGN.md`, `docs/design/phase-1/{prompt.md,screen-map.md,interaction-notes.md,approval.md}`, exported Stitch assets.
- **Covers:** FR-1.1–1.7, FR-2.2–2.8, NFR-2, NFR-7, NFR-8, §0 D-8.
- **Depends:** P0-T15, P0-T18
- **DoD:** Stitch covers normal, loading, empty, invalid-import, provider-degraded, depth-limited, and unknown-USD states; the habitual/recent heatmap toggle and funding evidence interactions are explicit; the user approves the recorded screen versions before Phase 1 UI code begins.
- **Tests:** Design checklist maps every Phase 1 UI row in §7 to an approved screen/state; keyboard, focus, contrast, long-address, large-tree, and 100-wallet progress behavior are specified; no Phase 1 UI code precedes approval.

#### P1-T01 — Wallet registry service and CRUD router
- **What:** Implement `src/server/services/wallet/registry.ts` (create/get/update/delete/list with normalization to lowercase addresses and EIP-55 validation via viem) and the `wallet` tRPC router's `list`, `get`, `add`, `update`, `delete` procedures. `add` validates the address, upserts the `Wallet` row plus an initial `SyncState` (`NEVER_SYNCED`), and enqueues `wallet.intake`.
- **Files:** `src/server/services/wallet/registry.ts`, `src/server/services/wallet/normalize.ts`, `src/server/trpc/routers/wallet.ts`, `src/server/trpc/root.ts`.
- **Covers:** FR-1.1 (single add), FR-1.8 (dedupe), NFR-3.
- **Depends:** P0-T14, P0-T13, P0-T18
- **DoD:** Adding `0xAbC…` and `0xabc…` (same address, different casing) results in exactly one `Wallet` row and one enqueued intake job; adding an invalid address returns a field-level validation error; deleting a wallet cascades its profile, sync state, and derived rows.
- **Tests:** `registry: address is stored lowercase`; `registry: mixed-case duplicate does not create a second row`; `registry: invalid address length is rejected`; `registry: non-hex address is rejected`; `registry: add enqueues exactly one intake job`; `registry: delete cascades profile and sync state`.

#### P1-T02 — ENS resolution
- **What:** Add `src/server/services/wallet/ens.ts` using viem's mainnet ENS resolver: forward resolution when the input is a `.eth` name (resolved address becomes the primary key), reverse resolution best-effort on add to populate `ensName`. Failures are non-fatal and recorded as a warning on the job result.
- **Files:** `src/server/services/wallet/ens.ts`, `src/server/trpc/routers/wallet.ts` (`resolveEns`), `src/server/workers/processors/wallet-intake.ts` (stage `resolve:ens`).
- **Covers:** FR-1.2.
- **Depends:** P1-T01
- **DoD:** Adding `vitalik.eth` stores the resolved address as the PK with `ensName = 'vitalik.eth'`; adding a raw address stores any reverse-resolved name; an ENS RPC outage still allows the wallet to be added, with a warning surfaced on the job.
- **Tests:** `ens: forward resolution sets the address primary key`; `ens: reverse resolution populates ensName`; `ens: unresolvable name returns a validation error`; `ens: resolver failure is non-fatal on a raw-address add`; `ens: address remains the primary key even when a name exists`.

#### P1-T03 — Batch import (textarea / CSV) with dedupe
- **What:** Implement the batch parser (`address,chain,label?` per line, blank lines and `#` comments skipped, chain omitted → `defaultChain` from settings, per-line error collection with line numbers) and the `wallet.import.batch` job as a BullMQ flow whose children are `wallet.intake` jobs, with aggregated parent progress. Re-importing an existing wallet enqueues an **incremental** `wallet.sync.incremental` instead of a duplicate row.
- **Files:** `src/server/services/wallet/import.ts`, `src/server/workers/processors/wallet-import-batch.ts`, `src/server/trpc/routers/wallet.ts` (`addBatch`).
- **Covers:** FR-1.1 (batch/CSV), FR-1.8 (re-import triggers r  e-sync, never a duplicate), NFR-2 (100 wallets must not block the UI).
- **Depends:** P1-T02, P0-T13
- **DoD:** Pasting 100 lines (including 3 malformed and 2 duplicates) returns immediately with `accepted: 95, duplicates: 2, invalid: 3` and per-line reasons; the parent job's progress advances as children complete; the UI stays responsive throughout (asserted by the Phase 1 e2e test navigating during import).
- **Tests:** `import: parses address,chain,label lines`; `import: missing chain falls back to defaultChain`; `import: blank and comment lines are ignored`; `import: malformed line reports its line number and reason`; `import: duplicate within the same batch counts once`; `import: existing wallet enqueues incremental sync, not intake`; `import: 100 entries create 100 child jobs under one parent`; `import: parent progress equals completed children over total`.

#### P1-T04 — Transaction ingestion and idempotent persistence
- **What:** Implement `src/server/services/ingestion/fetch.ts` (pull normal, internal, and ERC-20 records for an address through the `ChainAdapter`, streaming page progress) and `src/server/services/ingestion/persist.ts` (normalize to `Transaction` rows with `(chain, hash, kind, ordinal)`, bulk upsert via a repository helper, upsert `Token` stubs, advance `SyncState.cursorsJson` per endpoint only to `coveredThroughBlock`).
- **Files:** `src/server/services/ingestion/fetch.ts`, `src/server/services/ingestion/persist.ts`, `src/server/services/ingestion/normalize.ts`, `src/server/db/repositories/transaction-repo.ts`.
- **Covers:** FR-1.3 (fetch normal + internal + ERC-20), NFR-3, NFR-4, SRS §10.4, §10.5.
- **Depends:** P0-T11, P0-T10, P1-T01
- **DoD:** Ingesting the `internal-tx-funded` scenario twice yields identical row counts (no duplicates) and identical `SyncState` cursors; a hash with one normal tx, three internal traces, and two ERC-20 transfers produces exactly six `Transaction` rows; a truncated fetch leaves the cursor at the last fully covered block.
- **Tests:** `ingestion: one hash yields separate NATIVE, INTERNAL, and ERC20 rows`; `ingestion: re-run creates zero new rows`; `ingestion: internal traces of one hash are distinguished by ordinal`; `ingestion: ERC20 rows are distinguished by logIndex`; `ingestion: cursor advances only to coveredThroughBlock`; `ingestion: truncated fetch does not advance past covered block`; `ingestion: Token stub rows are created for unseen tokens`; `ingestion: amountRaw is stored as an exact decimal string for an 18-decimal token`.

#### P1-T05 — Native price snapshots and USD attribution engine
- **What:** Implement `src/server/services/pricing/*` per §4.6: swap grouping, the six-rung attribution ladder, `NativePriceSnapshot` refresh, `PriceSnapshot` writes with `source`/`confidence`, back-fill of `Transaction.amountUsd`/`priceUsdUsed`/`usdSource`, and the `price.snapshot.enrich` job processor.
- **Files:** `src/server/services/pricing/attribute.ts`, `src/server/services/pricing/swap.ts`, `src/server/services/pricing/native.ts`, `src/server/services/pricing/snapshot.ts`, `src/server/workers/processors/price-enrich.ts`.
- **Covers:** SRS §10.3, FR-4.1 (market cap at action groundwork), SRS §5 (DexScreener/CoinGecko roles).
- **Depends:** P1-T04, P0-T12
- **DoD:** A USDC→PEPE swap is priced exactly from the stable leg with `confidence: HIGH` and yields an implied PEPE unit price; an ETH→token swap is priced from the native leg; a bare token transfer with no priceable leg falls to DexScreener and records `MEDIUM`; an unpriceable transfer leaves `amountUsd` null with `usdSource: UNKNOWN` and never 0.
- **Tests:** `pricing: stable leg yields exact USD and HIGH confidence`; `pricing: native leg uses the nearest native snapshot`; `pricing: stablecoin transfer is valued at par`; `pricing: falls back to DexScreener for a bare transfer`; `pricing: CoinGecko fallback marked LOW confidence`; `pricing: unpriceable event stores null, not zero`; `pricing: implied unit price = stableUsd / tokenAmount`; `pricing: marketCap uses implied price × known supply`; `pricing: re-running enrichment does not duplicate PriceSnapshot rows`; `pricing: swapGroupKey groups all rows of one hash for one wallet`.

#### P1-T06 — Wallet profile statistics
- **What:** Implement `src/server/services/wallet/profile.ts` computing every FR-1.4 stat from local data: first tx date, wallet age at first memecoin trade, total tx count, distinct tokens traded, current stablecoin balance, dormant-since, and both activity views in one pass: (1) full-history hour-of-day × day-of-week and (2) rolling seven local calendar days × 24 hours. Persist the two matrices, `APP_TIMEZONE`, and rolling-window bounds in `WalletProfile.heatmapJson`. "First memecoin trade" = earliest `BUY`/`SELL` on a non-stable, non-native token.
- **Files:** `src/server/services/wallet/profile.ts`, `src/server/services/wallet/heatmap.ts`, `src/server/workers/processors/wallet-intake.ts` (stage `profile:stats`).
- **Covers:** FR-1.4.
- **Depends:** P1-T05, P1-T04
- **DoD:** For `cex-funded-single`, the profile reports the exact first-tx date; each heatmap has 168 cells; the habitual matrix sums to the full-history tx count; the recent matrix sums only transactions inside the stored seven-day local-time window; `distinctTokenCount` matches the scenario token set; and `dormantSince` is set only when appropriate.
- **Tests:** `profile: firstTxAt equals the earliest ingested timestamp`; `profile: habitual heatmap has 7×24 cells summing to full-history txCount`; `profile: recent heatmap has 7×24 cells and excludes events before the rolling window`; `profile: both modes bucket by APP_TIMEZONE local hour and weekday/date`; `profile: DST/local-date window boundaries are explicit`; `profile: distinctTokenCount excludes stables and native`; `profile: walletAgeDaysAtFirstMemecoinTrade computed from firstTxAt`; `profile: dormantSince is null for an active wallet`; `profile: stableBalanceUsd comes from the latest BalanceSnapshot`; `profile: recompute is idempotent`.

#### P1-T07 — Balance snapshots for stables and native
- **What:** Implement the `balance.snapshot` job and `src/server/services/pricing/balances.ts`: fetch native + configured stable balances via `getBalances`, value them with current snapshots, write `BalanceSnapshot`, and refresh `WalletProfile.stableBalanceUsd`, `Cluster.combinedStableUsd`, and `WalletState` baselines/peaks.
- **Files:** `src/server/services/pricing/balances.ts`, `src/server/workers/processors/balance-snapshot.ts`, `src/server/workers/schedules.ts` (hourly HIGH / daily NORMAL).
- **Covers:** FR-2.5 (current parked balance per chain), FR-1.4 (stablecoin balance), A1/A2/C4 groundwork.
- **Depends:** P1-T05
- **DoD:** After a snapshot run, each wallet has one `BalanceSnapshot` per stable token plus one for native, with USD values; `WalletProfile.stableBalanceUsd` equals the sum of the stable rows; re-running within the same hour does not create duplicate rows (unique on `(wallet, chain, token, timestamp)` with hour-truncated timestamps).
- **Tests:** `balances: native balance stored with null tokenAddress`; `balances: only configured stables are snapshotted`; `balances: stableBalanceUsd equals the sum of stable rows`; `balances: repeat run in the same hour is idempotent`; `balances: unpriced stable stores null USD without failing the job`.

#### P1-T08 — Stablecoin parking detection and timeline
- **What:** Implement `computeParking` per §4.4: flag every stable inflow/outflow per wallet and chain from ingested transfers, roll into `DailyFlow` with `isStable: true`, expose the per-chain parked balance (from snapshots) plus the chronological parking timeline with counterparty entity names, and record peak parked USD for C4.
- **Files:** `src/server/services/funding/parking.ts`, `src/server/trpc/routers/wallet.ts` (`parking`), `src/server/services/movement/daily-flow.ts`.
- **Covers:** FR-2.5.
- **Depends:** P1-T07, P0-T06
- **DoD:** For a wallet with 5 USDC inflows and 2 outflows across two chains, the parking summary reports correct per-chain balances, a 7-event timeline in chronological order with direction and USD, and a peak value with its timestamp.
- **Tests:** `parking: inflow and outflow events are both captured`; `parking: per-chain balances are separated`; `parking: timeline is ordered by timestamp`; `parking: counterparty CEX name is attached when labeled`; `parking: peak parked USD and timestamp are recorded`; `parking: non-configured token is not treated as stable`.

#### P1-T09 — Funding-tree builder
- **What:** Implement `buildFundingTree` and `loadFundingTree` exactly per §4.4 (BFS upstream, native + internal inbound aggregation, terminal-entity stop before recursion, depth default 3 / max 6, cycle safety, stop reasons, `FundingNode`/`FundingEdge` persistence) and the `funding.trace` job processor with per-depth progress. Enforce `childChain === parentChain`; a bridge is a labeled terminal leaf and no cross-chain continuation is inferred (§0 D-2).
- **Files:** `src/server/services/funding/trace.ts`, `src/server/services/funding/inbound.ts`, `src/server/db/repositories/funding-repo.ts`, `src/server/workers/processors/funding-trace.ts`.
- **Covers:** FR-2.1, FR-2.2, FR-2.3 (consumes `EntityService`), SRS §10.4.
- **Depends:** P1-T05, P0-T06
- **DoD:** On `internal-tx-funded`, the tree contains a funder reachable **only** through an internal trace (proving §10.4); on `cex-funded-single`, the Binance funder is a leaf with `stopReason: TERMINAL_ENTITY` and zero adapter calls spent on its history; default depth is 3 and depth 7 is rejected; a funding cycle terminates with `SELF_REFERENCE` rather than hanging.
- **Tests:** `funding: internal-only funder appears in the tree`; `funding: terminal CEX funder is a leaf`; `funding: no adapter call is made for a terminal node's history`; `funding: default depth is 3`; `funding: maxDepth above 6 is rejected`; `funding: depth-limited node reports DEPTH_LIMIT and canDeepTrace`; `funding: funder with no inbound reports NO_INBOUND`; `funding: cycle reports SELF_REFERENCE and terminates`; `funding: totalUsd aggregates native and internal values`; `funding: internalEventsCount is tracked separately`; `funding: re-running the trace produces identical edges (idempotent)`; `funding: HUMAN-labeled funder is still traced`.

#### P1-T10 — Primary-wallet detector
- **What:** Implement `classifyPrimaryWallet` per §4.5 as a pure function plus the outflow aggregation that feeds it (`realizedOutflowUsd` excluding router swaps and gas, per-destination USD breakdown), wire it into the trace's `classify:primary` stage, and persist the boolean columns and `FundingEdge.kind`.
- **Files:** `src/server/services/funding/primary-wallet.ts`, `src/server/services/funding/outflow.ts`, `src/server/services/funding/trace.ts` (wire-up).
- **Covers:** FR-2.4.
- **Depends:** P1-T09
- **DoD:** A funder with 2 fundings and 25% of outflow returned is labeled `PRIMARY_WALLET`; 2 fundings and 5% returned is `REPEATED_FUNDER_CANDIDATE`; 1 funding but the largest outflow destination is `PROFIT_SINK_CANDIDATE`; first-gas + 1 later funding + 30% returned is `PRIMARY_WALLET`; the evidence object names both conditions with their numbers.
- **Tests:** `primary: two fundings plus 25% return is PRIMARY_WALLET`; `primary: exactly 20.0% return satisfies the profit-sink threshold`; `primary: 19.9% does not`; `primary: exactly 2 fundings satisfies condition A`; `primary: single funding that is first gas does not satisfy A alone`; `primary: first gas plus one later funding satisfies A`; `primary: largest-destination path satisfies B without the ratio`; `primary: neither condition yields a null label`; `primary: zero realized outflow makes the ratio path unsatisfiable`; `primary: configurable ratio of 30 changes the verdict`; `primary: evidence includes both condition details and the numbers`; `primary: FundingEdge.kind maps PRIMARY/PROFIT_SINK/REPEATED/INITIAL correctly`.

#### P1-T11 — Deep trace mode
- **What:** Implement the `DEEP` branch of `buildFundingTree` (§4.4 step 6) and the `funding.deepTrace` tRPC mutation: extend one branch from its stored depth to the absolute cap of 6, stopping at a terminal entity or a dead end, recording `deepTracedAt`, resuming from `FundingNode.maxExpandedDepth` rather than restarting, and reporting progress.
- **Files:** `src/server/services/funding/trace.ts`, `src/server/trpc/routers/funding.ts`, `src/server/workers/processors/funding-trace.ts`.
- **Covers:** FR-2.7.
- **Depends:** P1-T10
- **DoD:** Deep-tracing a `DEPTH_LIMIT` node adds at least one new depth level for that branch only, leaves sibling branches unchanged, sets `deepTracedAt`, and stops at depth 6 with `stopReason: DEPTH_LIMIT` if nothing terminal is found sooner; a second deep trace on the same branch spends materially fewer calls than the first (resumption, asserted via `stats()`).
- **Tests:** `deep-trace: extends only the requested branch`; `deep-trace: stops at a terminal entity encountered mid-extension`; `deep-trace: stops at absolute depth 6`; `deep-trace: sets deepTracedAt on the extended node`; `deep-trace: resumes from maxExpandedDepth on a second run`; `deep-trace: sibling branch node counts are unchanged`.

#### P1-T12 — Shared-funder clustering
- **What:** Implement `src/server/services/cluster/detect.ts`: after any trace, find non-terminal `FundingNode`s shared by ≥ 2 tracked wallets, upsert `Cluster` (name derived from the funder's label or truncated address, deterministic `colorHex` from an address hash over a fixed 16-color palette), sync `ClusterMember` rows, refresh `memberCount`/`combinedStableUsd`/`lastActivityAt`, and expose the `cluster.list`/`cluster.get` procedures.
- **Files:** `src/server/services/cluster/detect.ts`, `src/server/services/cluster/rollup.ts`, `src/server/trpc/routers/cluster.ts`, `src/lib/format/cluster-color.ts`.
- **Covers:** FR-2.6.
- **Depends:** P1-T09
- **DoD:** On `cluster-of-three`, one cluster is created containing exactly the three wallets that share a non-terminal funder, with a stable color across rebuilds; two wallets sharing only a Binance hot wallet create **no** cluster; adding a fourth wallet with the same funder joins the existing cluster without creating a second one.
- **Tests:** `cluster: two wallets sharing a non-terminal funder create one cluster`; `cluster: shared terminal entity creates no cluster`; `cluster: third wallet joins the existing cluster`; `cluster: colorHex is deterministic for a given funder address`; `cluster: memberCount and combinedStableUsd roll up correctly`; `cluster: removing a wallet removes its membership but keeps the cluster when ≥2 remain`; `cluster: cluster is deleted or emptied when fewer than 2 members remain`; `cluster: detection is idempotent across repeated runs`.

#### P1-T13 — Manual tagging, computed label, flags
- **What:** Implement tag persistence and the computed-label preview: `wallet.updateTags` accepting `edge`/`style`/`size`/`label`/`notes` and the flags `isBlacklisted`, `watchPriority`, `isSelf`; plus `src/lib/format/wallet-label.ts` rendering `{EDGE}-{STYLE} [{SIZE}]` from the tags with defined behaviour for partially-set tags (missing parts are omitted along with their separators).
- **Files:** `src/server/services/wallet/tags.ts`, `src/lib/format/wallet-label.ts`, `src/server/trpc/routers/wallet.ts`, `src/components/wallets/TagEditor.tsx`, `src/components/wallets/LabelPreview.tsx`.
- **Covers:** FR-1.5, FR-1.6.
- **Depends:** P1-T01, P1-D01 (approved before the `TagEditor`/`LabelPreview` portion)
- **DoD:** Setting `edge: SMART, style: RIDER, size: W` renders `SMART-RIDER [W]`; setting only `edge` renders `SMART`; the free-text `label` and `notes` persist and re-render after reload; toggling `isSelf` is reflected in the registry and picked up by Phase 5.
- **Tests:** `label: all three tags render as EDGE-STYLE [SIZE]`; `label: edge only renders EDGE`; `label: edge and size render EDGE [SIZE]`; `label: no tags renders an empty preview`; `label: free-text label is independent of the computed label`; `tags: watchPriority and blacklist flags persist`; `tags: isSelf can be set on exactly the user's wallets`.

#### P1-T14 — Wallet list page with search, filters, bulk actions
- **What:** Build `/wallets` as a dense, virtualized table (address + ENS, computed label, chain, cluster color chip, stablecoin balance, last activity, alert-state placeholder badge) with server-side search and filters (tag, chain, cluster, stablecoin balance range, last-activity range, alert state) and bulk actions (re-sync, delete, add to priority watch). Query is cursor-paginated and index-backed.
- **Files:** `src/app/wallets/page.tsx`, `src/components/wallets/WalletTable.tsx`, `src/components/wallets/WalletFilters.tsx`, `src/components/wallets/BulkActionBar.tsx`, `src/components/shared/DataTable.tsx`, `src/server/services/wallet/list.ts`.
- **Covers:** FR-1.7, NFR-7 (< 500 ms), NFR-8.
- **Depends:** P1-T13, P1-T06, P1-D01 (approved)
- **DoD:** With 500 seeded wallets, the list's server query returns in < 500 ms (asserted in an integration benchmark) and the page renders interactively; every listed filter narrows results correctly; bulk re-sync of 20 selected wallets enqueues 20 incremental sync jobs and shows progress.
- **Tests:** `list: search matches address prefix and ENS name`; `list: tag filter narrows by edge/style/size`; `list: cluster filter returns only that cluster's members`; `list: stablecoin balance range filter works`; `list: last-activity filter works`; `list: alert-state filter works`; `list: cursor pagination returns stable non-overlapping pages`; `list: 500-wallet query completes under 500 ms`; `list: bulk resync enqueues one job per selected wallet`; `list: bulk delete removes exactly the selected rows`.

#### P1-T15 — Intake pipeline orchestration
- **What:** Implement `src/server/workers/processors/wallet-intake.ts` chaining every stage from §4.3 in order (`resolve:ens` → … → `alert:backfill` → `done`), each stage reporting `JobProgress` with a stable stage name, failures marking `SyncState.status = FAILED` with `lastError` and surfacing in the UI, and a resumable design where a retried job skips completed stages when their outputs already exist. Stages not yet implemented (movements, relations, alerts) are declared no-ops that later phases fill in — the stage list itself is frozen now.
- **Files:** `src/server/workers/processors/wallet-intake.ts`, `src/server/services/ingestion/pipeline.ts`.
- **Covers:** FR-1.3, NFR-2, NFR-4.
- **Depends:** P1-T09, P1-T12, P1-T06, P1-T08
- **DoD:** Adding one wallet runs the full pipeline to `done` with monotonic progress reaching 100 and a `WalletIntakeResult` reporting non-zero `txPersisted`, `fundingEdges`, and `clustersJoined` where applicable; killing the worker mid-pipeline and restarting resumes without duplicating transactions; a forced adapter failure marks the sync FAILED with a readable error.
- **Tests:** `intake: stages execute in the declared order`; `intake: progress is monotonic and ends at 100`; `intake: adapter failure marks SyncState FAILED with lastError`; `intake: retry after failure does not duplicate transactions`; `intake: resumed job skips already-completed stages`; `intake: result reports counts for tx, movements, funding edges, clusters`; `intake: forceFullResync re-fetches from block 0`.

#### P1-T16 — Incremental sync and the sync scheduler
- **What:** Implement `wallet.sync.incremental` (resume from per-endpoint cursors, fetch → persist → price → derive, never re-fetch from zero) and `schedule.sync.tick` (select due wallets by `watchPriority` and `lastSyncedAt`, check the daily budget before enqueueing, skip and report when the budget is short, honour `syncCadenceMinutes`).
- **Files:** `src/server/workers/processors/wallet-sync.ts`, `src/server/workers/processors/schedule-sync-tick.ts`, `src/server/services/ingestion/incremental.ts`, `src/server/workers/schedules.ts`.
- **Covers:** NFR-4, NFR-2, NFR-3, SRS §10.5, §6 of this plan (budget guard).
- **Depends:** P1-T15
- **DoD:** A second sync of an unchanged wallet spends ≤ 3 adapter calls (one per endpoint) and persists zero new rows; after new activity, only blocks above the cursor are fetched; when the daily budget is exhausted the tick enqueues nothing and reports `skippedForBudget` without failing; a full re-sync is only possible via the explicit `forceFullResync` flag.
- **Tests:** `sync: unchanged wallet spends one call per endpoint`; `sync: only blocks above the cursor are requested`; `sync: new rows are appended without duplicating old ones`; `sync: cursor is unchanged when the fetch fails`; `scheduler: HIGH-priority wallets are selected before NORMAL`; `scheduler: respects syncCadenceMinutes`; `scheduler: skips enqueueing when the budget is exhausted`; `scheduler: full re-sync requires the explicit flag`.

#### P1-T17 — Funding tree UI, entity labels, primary badge
- **What:** Build the wallet detail page's funding section: an interactive collapsible tree (`FundingTree`) whose nodes show truncated address + label, cumulative USD funded, funding count, and first/last funding dates; terminal entities styled as leaves with the entity name; the `PRIMARY WALLET` warning badge and the two candidate labels; the deep-trace button on depth-limited nodes with inline job progress; plus the settings-side entity-label editor for user-defined terminal/human labels.
- **Files:** `src/app/wallets/[chain]/[address]/page.tsx`, `src/components/funding/FundingTree.tsx`, `src/components/funding/FundingNode.tsx`, `src/components/funding/DeepTraceButton.tsx`, `src/components/funding/PrimaryWalletBadge.tsx`, `src/components/settings/EntityLabelEditor.tsx`, `src/components/wallets/ActivityHeatmap.tsx`, `src/components/wallets/ParkingTimeline.tsx`.
- **Covers:** FR-2.8, FR-2.2 (display), FR-2.3 (user labels UI), FR-2.4 (badge), FR-2.7 (button), FR-1.4 (heatmap, parking display), FR-1.6 (label preview placement).
- **Depends:** P1-T11, P1-T13, P1-T08, P1-D01 (approved)
- **DoD:** The wallet detail page renders profile stats, a toggle between habitual and recent 7-day heatmaps, the parking timeline, and a collapsible funding tree; a seeded Binance funder renders as a terminal leaf labeled "Binance 14"; a `PRIMARY WALLET` node shows the warning badge with an evidence tooltip; clicking deep-trace extends that same-chain branch without a reload; implementation matches the approved Phase 1 Stitch screens.
- **Tests (component/e2e):** `detail: profile stats render every FR-1.4 field`; `detail: heatmap toggle renders both 168-cell modes with correct labels`; `detail: funding node shows address, label, USD, count, first/last dates`; `detail: terminal entity node is a leaf with its entity name`; `detail: bridge node never offers cross-chain continuation`; `detail: primary wallet badge renders with evidence tooltip`; `detail: candidate labels render their exact SRS wording`; `detail: deep-trace button appears only on depth-limited nodes`; `detail: deep-trace adds nodes without a reload`; `detail: visual review matches approved Stitch artifacts`.

#### P1-T18 — Phase 1 acceptance: 10-wallet CSV import end to end
- **What:** Author the Phase 1 Playwright acceptance spec against the `MockChainAdapter`: import 10 wallets via CSV, wait for all intake jobs, then assert each SRS §8 Phase 1 criterion. Add the `phase1` scenario bundle that guarantees at least one CEX-terminal funder, one shared-funder trio, one internal-tx-only funding, and one depth-limited branch.
- **Files:** `tests/e2e/phase1.spec.ts`, `tests/fixtures/scenarios/phase1-bundle.json`, `tests/helpers/e2e-import.ts`.
- **Covers:** SRS §8 Phase 1 acceptance (all four criteria), FR-1.1, FR-1.3, FR-1.7, FR-2.2, FR-2.6, FR-2.7, FR-2.8.
- **Depends:** P1-T17, P1-T16, P1-T14, P1-T03
- **DoD:** `pnpm e2e tests/e2e/phase1.spec.ts` passes headlessly with zero network calls, asserting: 10 wallets imported and listed; each profile page shows stats and a funding tree; a known CEX funder displays as a terminal entity; ≥ 1 cluster auto-created from a shared funder with color-coded members; the deep-trace button extends a branch.
- **Tests:** `phase1: CSV import creates 10 wallets and 10 intake jobs`; `phase1: every wallet profile shows stats and a funding tree`; `phase1: CEX funder renders as a terminal entity leaf`; `phase1: shared funder produces a cluster with color-coded members`; `phase1: deep trace extends a branch`; `phase1: UI remains navigable during import`.

### Phase 2 — Interaction Graph

*SRS §8 acceptance: import set renders bubble map; edges labeled `TICKER · $USD` with breakdown on click; independence verdict panel populated; graph exports PNG.*

Covers FR-3.1–3.8.

#### P2-D01 — Stitch design: interaction graph
- **What:** Use the taste skill and Google Stitch to design the full-screen graph, filters, legend, compound clusters, edge breakdown, node side panel, independence verdicts, loading/performance states, and PNG-export feedback. Reuse the approved design system and obtain user approval under §5.0.
- **Files:** `docs/design/phase-2/{prompt.md,screen-map.md,interaction-notes.md,approval.md}`, `docs/design/DESIGN.md`, exported Stitch assets.
- **Covers:** FR-3.1–3.8, NFR-7, NFR-8, §0 D-2.
- **Depends:** P1-T18
- **DoD:** Approved Stitch screens define graph hierarchy and interactions at 300 nodes/1,000 edges, same-chain labeling, dependent/independent evidence, empty/loading/error states, keyboard alternatives to canvas interactions, and export feedback.
- **Tests:** Design checklist maps every Phase 2 UI requirement to a screen or interaction note; color is not the sole carrier of state/cluster meaning; no Phase 2 UI code precedes approval.

#### P2-T01 — Interaction edge aggregation
- **What:** Implement `src/server/services/interaction/aggregate.ts`: scan same-chain `Transaction` rows where both `fromAddress` and `toAddress` are tracked wallets (native, internal, and ERC-20), require both wallet keys to use the transaction's chain, and aggregate **per wallet pair per chain** into `InteractionEdge` with canonical A/B ordering, directional USD/count splits, first/last dates, distinct token count, and the top token by USD; write the per-token breakdown into `InteractionEdgeToken` including up to 25 recent sample txs. Never infer a cross-chain edge. Add a `derive.rebuild` target for `INTERACTION_EDGES` and incremental updates on sync.
- **Files:** `src/server/services/interaction/aggregate.ts`, `src/server/services/interaction/canonical.ts`, `src/server/db/repositories/interaction-repo.ts`, `src/server/workers/processors/derive-rebuild.ts`.
- **Covers:** FR-3.2, FR-3.3 (data), NFR-3, NFR-7.
- **Depends:** P1-T04, P1-T05
- **DoD:** For a pair with 23 transfers across 2 tokens in both directions, exactly one `InteractionEdge` row exists with `txCount: 23`, correct `usdAToB`/`usdBToA` split, two `InteractionEdgeToken` rows, and a `topTokenSymbol` matching the higher-USD token; rebuilding produces byte-identical aggregates.
- **Tests:** `edges: one row per wallet pair and chain regardless of direction`; `edges: same address pair on two chains creates two unrelated aggregates`; `edges: no cross-chain edge is inferred`; `edges: canonical ordering is stable when arguments are swapped`; `edges: directional USD and counts split correctly`; `edges: native transfers produce a null-token breakdown row`; `edges: topToken is the highest-USD token on the edge`; `edges: distinctTokenCount counts tokens, not transfers`; `edges: sampleTxsJson holds at most 25 entries, newest first`; `edges: rebuild is idempotent`; `edges: transfers involving an untracked address are excluded`.

#### P2-T02 — Graph load API with filters
- **What:** Implement `graph.load` returning nodes (tracked wallets with size inputs, cluster color, alert state, stable balance) and edges (aggregated, with label fields), plus optional secondary node sets (funders, cluster-mates, primary wallets) behind toggles; and server-side filters: min USD (default 100 from `minEdgeUsd`), token selector, direction, and time range. Filters are applied in SQL so the payload stays small.
- **Files:** `src/server/services/interaction/graph-query.ts`, `src/server/trpc/routers/graph.ts`.
- **Covers:** FR-3.1, FR-3.4, FR-3.5 (data), NFR-7.
- **Depends:** P2-T01, P1-T12
- **DoD:** `graph.load` with 300 tracked wallets and 1,000 edges responds in < 500 ms and returns a payload under 1 MB; raising `minUsd` to 10,000 reduces the edge set; selecting a token returns only edges whose breakdown contains it; a time-range filter recomputes edge aggregates for that window; toggling secondary nodes adds funder/primary nodes with a distinct node type.
- **Tests:** `graph-query: min USD filter excludes smaller edges`; `graph-query: token filter uses the breakdown table`; `graph-query: direction filter returns only the requested orientation`; `graph-query: time range restricts aggregates to the window`; `graph-query: secondary funder nodes appear only when toggled`; `graph-query: primary wallet nodes are flagged`; `graph-query: 300-node payload responds under 500 ms`; `graph-query: node size inputs include both size tag and stable balance`.

#### P2-T03 — Cytoscape canvas with fCoSE and compound clusters
- **What:** Build `GraphCanvas`: Cytoscape.js 3.x with `cytoscape-fcose` 2.2 force-directed layout, compound parent nodes grouping cluster members, pan/zoom, node drag, fit-to-screen, and performance settings tuned for 300 nodes / 1,000 edges (`hideEdgesOnViewport`, `textureOnViewport`, batched element updates, layout run off the initial paint).
- **Files:** `src/components/graph/GraphCanvas.tsx`, `src/components/graph/cytoscape-setup.ts`, `src/components/graph/graph-styles.ts`, `src/app/graph/page.tsx`.
- **Covers:** FR-3.1, FR-3.7, NFR-7 (>30 fps pan/zoom).
- **Depends:** P2-T02, P2-D01 (approved)
- **DoD:** The full-screen graph page renders the imported set with clusters as compound parents; pan/zoom sustains > 30 fps at 300 nodes / 1,000 edges measured via the Playwright performance trace; fit-to-screen frames all nodes; node positions survive a filter change without a full relayout jump when `randomize: false` is used.
- **Tests:** `graph-ui: renders one node per tracked wallet`; `graph-ui: cluster members are wrapped in a compound parent`; `graph-ui: fit-to-screen brings all nodes into the viewport`; `graph-ui: pan/zoom sustains >30 fps with 300 nodes and 1000 edges`; `graph-ui: node drag persists position during the session`; `graph-ui: layout does not block first paint`.

#### P2-T04 — Edge rendering: arrows, `TICKER · $USD` labels, breakdown panel
- **What:** Implement directional arrow styling, the edge label formatted exactly as `TICKER · $12.4K` (top token symbol + compact aggregate USD, native rendered with the chain's native symbol), edge width scaled by USD, and the `EdgeBreakdownPanel` opened by hover/click showing the per-token list with tx count, total amount, first/last date, and explorer tx links.
- **Files:** `src/components/graph/graph-styles.ts`, `src/components/graph/EdgeBreakdownPanel.tsx`, `src/lib/format/usd.ts`, `src/server/trpc/routers/graph.ts` (`edgeBreakdown`).
- **Covers:** FR-3.3, FR-4.8 (evidence links).
- **Depends:** P2-T03, P2-D01 (approved)
- **DoD:** An edge whose top token is PEPE with $12,400 aggregate renders the label `PEPE · $12.4K`; clicking it opens a panel listing every token on that edge with counts, totals, first/last dates, and working explorer links; an edge with only native transfers renders `ETH · $…`.
- **Tests:** `edge-label: formats ticker and compact USD as "PEPE · $12.4K"`; `edge-label: 999 renders as $999 and 1500 as $1.5K and 2400000 as $2.4M`; `edge-label: native-only edge uses the chain native symbol`; `breakdown: lists every token with count, total, first/last`; `breakdown: tx links point at the correct explorer host`; `breakdown: opens on click and closes on escape`.

#### P2-T05 — Node rendering: size, border state, cluster fill
- **What:** Implement node styling per FR-3.5: size scales with either the `size` tag or the current stablecoin balance (user toggle), border color encodes alert state (with an explicit IDLE default until Phase 4 fills real states), fill color encodes cluster membership using the deterministic cluster palette; plus a legend.
- **Files:** `src/components/graph/graph-styles.ts`, `src/components/graph/GraphLegend.tsx`, `src/components/graph/GraphFilters.tsx` (size-mode toggle).
- **Covers:** FR-3.5.
- **Depends:** P2-T03, P1-T12, P2-D01 (approved)
- **DoD:** Toggling size mode visibly rescales nodes and the legend updates; cluster members share a fill color matching their chips in the wallet list; an unclustered wallet uses the neutral fill; alert-state borders are wired to a single mapping function reused by Phase 4.
- **Tests:** `node-style: size mode "tag" maps W/M/S to descending sizes`; `node-style: size mode "balance" scales monotonically with stable balance`; `node-style: cluster fill matches the cluster color`; `node-style: unclustered wallet uses the neutral fill`; `node-style: border color mapping covers IDLE, ARMED, TRIGGERED`; `node-style: legend lists every encoding in use`.

#### P2-T06 — Independence verdict computation and panel
- **What:** Implement `areMutuallyIndependent`, `computeWalletVerdict`, and `rebuildWalletRelations` per §4.7 (shared funder, direct transfer, same cluster, co-entry), persist `WalletRelation` rows with their exact statement strings, wire the rebuild into intake/trace/cluster changes, and build the `IndependenceVerdict` panel rendering the statement list or the verbatim INDEPENDENT line.
- **Files:** `src/server/services/independence/verdict.ts`, `src/server/services/independence/statements.ts`, `src/server/trpc/routers/graph.ts` (`independence`), `src/components/graph/IndependenceVerdict.tsx`.
- **Covers:** FR-3.6, FR-4.2 (independence input), SRS §10.7.
- **Depends:** P2-T01, P1-T12, P2-D01 (approved before the panel portion)
- **DoD:** For a wallet connected by a shared funder, direct transfers, and co-entry, the panel lists all three statements with correct counts and USD; for an isolated wallet it renders exactly `INDEPENDENT — no funding, transfer, or co-entry relationship with any other tracked wallet.`; relation rows are removed when the underlying relationship disappears after a rebuild.
- **Tests:** `independence: shared non-terminal funder creates a SHARED_FUNDER relation`; `independence: shared terminal entity creates no relation`; `independence: direct transfer relation reports txCount and USD`; `independence: same-cluster relation is distinct from shared-funder`; `independence: co-entry relation counts tokens within the window`; `independence: co-entry is excluded from the FR-4.2 independence test`; `independence: isolated wallet returns the exact INDEPENDENT sentence`; `independence: statements match the SRS wording pattern`; `independence: rebuild deletes stale relations`; `independence: areMutuallyIndependent is symmetric`.

#### P2-T07 — Node side panel and PNG export
- **What:** Build the `NodeSidePanel` (key stats, alert state, stablecoin balance, cluster, independence summary, link to the wallet detail page) opened by node click, and `PngExportButton` exporting the current graph view via Cytoscape's PNG export with the dark background preserved and a filename containing the timestamp.
- **Files:** `src/components/graph/NodeSidePanel.tsx`, `src/components/graph/PngExportButton.tsx`.
- **Covers:** FR-3.8, FR-3.7 (PNG export).
- **Depends:** P2-T05, P2-T06, P2-D01 (approved)
- **DoD:** Clicking a node opens the panel with the wallet's stats and a working link to `/wallets/[chain]/[address]`; the export button downloads a PNG whose pixel dimensions match the viewport scale and whose background is the dark theme color, not transparent.
- **Tests:** `side-panel: opens on node click with stats, state, balance, cluster`; `side-panel: link navigates to the wallet detail route`; `side-panel: closes on escape and on background click`; `png-export: produces a non-empty PNG buffer`; `png-export: background is opaque dark, not transparent`; `png-export: filename contains an ISO timestamp`.

#### P2-T08 — Phase 2 acceptance spec
- **What:** Author the Phase 2 Playwright acceptance spec: load the imported set into the graph, assert edge labels, open a breakdown, assert the independence panel, and export a PNG.
- **Files:** `tests/e2e/phase2.spec.ts`, `tests/fixtures/scenarios/phase2-bundle.json`.
- **Covers:** SRS §8 Phase 2 acceptance (all four criteria), FR-3.1–3.8.
- **Depends:** P2-T07, P2-T04
- **DoD:** `pnpm e2e tests/e2e/phase2.spec.ts` passes offline, asserting: the bubble map renders the imported set; at least one edge label matches `/^[A-Z0-9]+ · \$/`; clicking that edge opens a per-token breakdown; the independence verdict panel is populated for a connected wallet and shows the INDEPENDENT line for an isolated one; the PNG export downloads.
- **Tests:** `phase2: graph renders imported wallets as nodes`; `phase2: edge label matches TICKER · $USD`; `phase2: edge click opens the token breakdown`; `phase2: independence panel lists connections`; `phase2: independence panel shows INDEPENDENT for an isolated wallet`; `phase2: PNG export downloads a file`.

### Phase 3 — Narrative Radar

*SRS §8 acceptance: movement feed streams live actions; a simulated two-wallet same-token buy within 24h produces a co-accumulation group card; netflow table and breadth indicator populated.*

Covers FR-4.1–4.8. Requires price snapshots (P1-T05) and token deploy dates.

#### P3-D01 — Stitch design: movement radar and evidence
- **What:** Use the taste skill and Google Stitch to design `/radar`, movement rows, co-accumulation/co-distribution cards, the distinct cluster warning treatment, evidence expansion, netflow, breadth/market-quiet state, and cluster rotation. Reuse prior approved patterns and obtain user approval under §5.0.
- **Files:** `docs/design/phase-3/{prompt.md,screen-map.md,interaction-notes.md,approval.md}`, `docs/design/DESIGN.md`, exported Stitch assets.
- **Covers:** FR-4.1–4.8, NFR-7, NFR-8, §0 D-9.
- **Depends:** P2-T08
- **DoD:** Approved Stitch screens cover live/paused/loading feeds, unpriced values, unknown supply, quiet market, cluster warnings that cannot be confused with independent co-entry, pagination, and raw-evidence navigation.
- **Tests:** Design checklist maps every Phase 3 UI requirement and degraded state to an approved artifact; warning meaning is conveyed by text/icon as well as color; no Phase 3 UI code precedes approval.

#### P3-T01 — Token metadata, deploy dates, and pair discovery
- **What:** Implement `token.metadata.refresh`: resolve symbol/name/decimals/total supply plus **deployer address and contract-creation timestamp** through the chain's `ChainAdapter`, and use DexScreener for `pairCreatedAt`, primary pair, liquidity, and market cap; persist to `Token` and cache immutable deploy data. Base/BSC delegate to Etherscan; Robinhood delegates to P0-T18's provider without service-level branching.
- **Files:** `src/server/services/token/metadata.ts`, `src/server/workers/processors/token-metadata.ts`, `src/lib/chains/etherscan-v2-adapter.ts` (`getTokenInfo` wire-up).
- **Covers:** FR-4.1 (token age at action), FR-7.2 (deployer, token age), SRS §5.
- **Depends:** P1-T05, P0-T12
- **DoD:** For a known token on each supported chain, `deployedAt`, `deployerAddress`, `decimals`, and `totalSupplyRaw` are stored when the adapter provides them; a second refresh spends zero provider calls for immutable fields; unavailable metadata or DexScreener pairs store explicit nulls without failing.
- **Tests:** `token-meta: deployedAt and deployerAddress are resolved from contract creation`; `token-meta: decimals and totalSupply are stored`; `token-meta: pairCreatedAt comes from DexScreener`; `token-meta: second refresh reuses the cache for immutable fields`; `token-meta: missing pair stores nulls without error`; `token-meta: age is computed from deployedAt with pairCreatedAt fallback`.

#### P3-T02 — Movement classification and `MovementEvent` persistence
- **What:** Implement `classifyMovements` per §4.9 mapping swap groups and transfers to the nine `MovementKind` values, attaching persisted USD, `marketCapAtAction`, `priceUsdAtAction`, `tokenAgeSeconds`, counterparty entity context, and `isFirstEntryForWallet`; wire it into the intake pipeline's `derive:movements` stage and the incremental sync path.
- **Files:** `src/server/services/movement/classify.ts`, `src/server/services/movement/persist.ts`, `src/server/workers/processors/wallet-intake.ts` (stage fill-in), `src/server/services/ingestion/incremental.ts`.
- **Covers:** FR-4.1 (row data), FR-4.8, SRS §10.3.
- **Depends:** P3-T01, P1-T05
- **DoD:** A USDC→PEPE swap produces one `BUY` with the correct USD, market cap, and token age; a stablecoin inflow produces `STABLE_PARK`; an outgoing transfer to a labeled CEX produces `CEX_DEPOSIT` with the entity name; a first-ever buy sets `isFirstEntryForWallet`; re-classification creates no duplicates (unique on `(transactionId, kind, wallet)`).
- **Tests:** `movement: swap in yields BUY with USD and market cap`; `movement: swap out yields SELL`; `movement: stable inflow yields STABLE_PARK and outflow STABLE_SPEND`; `movement: transfer to a CEX entity yields CEX_DEPOSIT with the entity name`; `movement: transfer from a CEX entity yields CEX_WITHDRAWAL`; `movement: native value transfer yields NATIVE_FUNDING_IN/OUT`; `movement: first buy of a token sets isFirstEntryForWallet`; `movement: unpriced event stores null USD and keeps the row`; `movement: token age null when deployedAt unknown`; `movement: re-classification is idempotent`.

#### P3-T03 — Position and PnL accounting
- **What:** Implement `src/server/services/position/account.ts`: build `Position` rows from movement history using average-cost basis, tracking `amountRaw`, `costUsd`, `realizedUsd`, `avgEntryPriceUsd`, `entryMarketCap`, `peakPriceUsd`/`peakPriceAt` (local high since opening, refreshed from price snapshots), `unrealizedUsd`/`unrealizedMultiple`, buy/sell counts, `cexDepositedUsd`, and open/closed state.
- **Files:** `src/server/services/position/account.ts`, `src/server/services/position/peak.ts`, `src/server/db/repositories/position-repo.ts`.
- **Covers:** T4/C3/C4 inputs, FR-7.1 (holding/distributed status), FR-6 ROI inputs, Phase 6 grading inputs.
- **Depends:** P3-T02
- **DoD:** A buy-buy-partial-sell sequence yields one open position with correct average cost, realized PnL on the sold portion, and a peak price reflecting the highest snapshot since opening; selling the full balance closes the position with `closedAt` set; a CEX deposit of the token increments `cexDepositedUsd` without being treated as a realized sale at market.
- **Tests:** `position: average cost basis across two buys`; `position: partial sell realizes proportional PnL`; `position: full sell closes the position`; `position: re-buy after close opens a new position row`; `position: peakPriceUsd tracks the local high since opening`; `position: unrealizedMultiple equals current/avgEntry`; `position: CEX deposit increments cexDepositedUsd and does not realize PnL`; `position: unpriced buy does not corrupt the cost basis`; `position: rebuild from movements is idempotent`.

#### P3-T04 — Movement feed API and UI
- **What:** Implement the `radar.feed` cursor-paginated query (50 rows per page, filters by wallet, kind, token, time range, priority) and the `MovementFeed` UI: timestamp, wallet with tags + cluster color, action, token ticker with symbol avatar, USD amount, market cap at action, token age at action, and an explorer tx link per row; live updates via TanStack Query polling at the radar cadence.
- **Files:** `src/server/services/movement/feed.ts`, `src/server/trpc/routers/radar.ts`, `src/app/radar/page.tsx`, `src/components/radar/MovementFeed.tsx`, `src/components/shared/TokenAvatar.tsx`.
- **Covers:** FR-4.1, FR-4.8, NFR-7 (50-row pages), NFR-8.
- **Depends:** P3-T02, P3-D01 (approved before the UI portion)
- **DoD:** The feed renders newest-first with every FR-4.1 column populated (or `—` with a tooltip when USD/market cap/age is unknown); pagination returns stable 50-row pages; a new movement appears within one radar cadence without a manual reload; every row's tx link opens the correct explorer URL.
- **Tests:** `feed: returns 50 rows per page newest-first`; `feed: cursor pagination has no overlap or gaps`; `feed: every row exposes a tx link`; `feed: unknown USD renders an em dash with a reason tooltip`; `feed: wallet filter narrows to one wallet`; `feed: kind filter narrows by action`; `feed: token filter narrows by token`; `feed: cluster color and tags render on the wallet chip`; `feed: new event appears after the polling interval`.

#### P3-T05 — Co-accumulation and co-distribution grouping
- **What:** Implement `detectCoGroups` per §4.9 for `CO_ACCUMULATION` and `CO_DISTRIBUTION`: greedy independent-participant admission using stored `WalletRelation` kinds, configurable windows (1h/6h/24h/48h, default 24h), `minWallets` default 2, bucket-snapped `windowStart` for stable upserts, combined USD, supply share, time span, and an evidence object containing the pairwise independence proof and tx links.
- **Files:** `src/server/services/radar/group.ts`, `src/server/services/radar/independence-admission.ts`, `src/server/db/repositories/movement-group-repo.ts`.
- **Covers:** FR-4.2, FR-4.3, FR-4.8, SRS §10.7.
- **Depends:** P3-T02, P2-T06
- **DoD:** Two independent wallets buying the same token 6 hours apart produce one `CO_ACCUMULATION` group with `walletCount: 2` and combined USD; two wallets sharing a funder produce **no** group; two wallets selling within 12 hours produce a `CO_DISTRIBUTION` group; re-running the evaluation updates the same group instead of creating a second one.
- **Tests:** `cogroup: two independent buyers within 24h form a group`; `cogroup: dependent pair (shared funder) forms no group`; `cogroup: dependent pair (direct transfer) forms no group`; `cogroup: same-cluster pair forms no CO_ACCUMULATION group`; `cogroup: buyers 25h apart form no 24h group`; `cogroup: third independent buyer extends the existing group`; `cogroup: window snapping keeps windowStart stable across re-runs`; `cogroup: combined USD excludes unpriced events and notes them in evidence`; `cogroup: supply share computed when total supply is known`; `cogroup: co-distribution groups sells and CEX deposits together`; `cogroup: evidence includes a pairwise independence proof`; `cogroup: re-evaluation upserts rather than duplicates`.

#### P3-T06 — Cluster co-entry detection (separate, warning-styled)
- **What:** Implement the `CLUSTER_CO_ENTRY` path: ≥ 2 wallets of the **same** cluster entering the same token within 1h, stored with `clusterId`, excluded from co-accumulation queries by kind, and surfaced through a dedicated `radar.groups` filter so the UI renders it as a distinct warning card.
- **Files:** `src/server/services/radar/cluster-co-entry.ts`, `src/server/trpc/routers/radar.ts`, `src/components/radar/ClusterCoEntryCard.tsx`.
- **Covers:** FR-4.4.
- **Depends:** P3-T05, P1-T12
- **DoD:** Two same-cluster wallets buying one token 20 minutes apart produce exactly one `CLUSTER_CO_ENTRY` group and **zero** `CO_ACCUMULATION` groups; the card renders with warning styling and names the cluster and shared funder; the co-accumulation feed does not contain the event.
- **Tests:** `cluster-co-entry: same-cluster pair within 1h creates a CLUSTER_CO_ENTRY group`; `cluster-co-entry: pair 90 minutes apart creates none`; `cluster-co-entry: event does not appear in the co-accumulation list`; `cluster-co-entry: group stores clusterId and the shared funder in evidence`; `cluster-co-entry: card uses warning styling distinct from co-accumulation cards`.

#### P3-T07 — Movement group cards UI
- **What:** Build `MovementGroupCard`: token identity, participating wallets with their frozen grade labels, time span, combined USD bought/sold, combined % of supply, window label, and an expandable evidence section listing every member movement with its tx link.
- **Files:** `src/components/radar/MovementGroupCard.tsx`, `src/components/radar/GroupEvidence.tsx`, `src/app/radar/page.tsx`.
- **Covers:** FR-4.2, FR-4.3, FR-4.8.
- **Depends:** P3-T05, P3-D01 (approved)
- **DoD:** A co-accumulation group renders every field FR-4.2 names, with grade labels frozen at detection time and an evidence list whose tx links resolve; a group whose combined USD includes unpriced members shows the count of unpriced events rather than understating silently.
- **Tests:** `group-card: renders token, wallets with grades, span, combined USD, supply share`; `group-card: evidence lists one row per member movement with a tx link`; `group-card: unpriced member count is disclosed`; `group-card: window label reflects the configured window`.

#### P3-T08 — Netflow table
- **What:** Implement `computeNetflow` over `DailyFlow` for 24h/7d/30d: per token, buys − sells − CEX deposits in persisted USD, sortable by net/gross, with top gainers and losers; and the `NetflowTable` UI with timeframe tabs and sortable columns.
- **Files:** `src/server/services/movement/netflow.ts`, `src/server/trpc/routers/radar.ts`, `src/components/radar/NetflowTable.tsx`.
- **Covers:** FR-4.5, NFR-7.
- **Depends:** P3-T02, P1-T08, P3-D01 (approved before the UI portion)
- **DoD:** For a fixture with known flows, the 24h/7d/30d nets match hand-computed values; sorting reverses order correctly; top gainers/losers reflect the extremes of the same result set; the query completes in < 500 ms over 100k `DailyFlow` rows.
- **Tests:** `netflow: net equals buys minus sells minus CEX deposits`; `netflow: 24h/7d/30d windows aggregate the correct days`; `netflow: sorting by net ascending and descending`; `netflow: top gainers and losers come from the same result set`; `netflow: unpriced flows are excluded and disclosed`; `netflow: query completes under 500 ms on 100k rows`.

#### P3-T09 — Breadth indicator with explicit quiet state
- **What:** Implement `computeBreadth` (% of priority-watch wallets with ≥ 1 movement in 24h/7d, `isMarketQuiet` when zero) and the dashboard `BreadthIndicator` that renders the percentage, the counts, and an explicit "market quiet" state.
- **Files:** `src/server/services/movement/breadth.ts`, `src/components/radar/BreadthIndicator.tsx`, `src/app/page.tsx`.
- **Covers:** FR-4.7.
- **Depends:** P3-T02, P3-D01 (approved before the UI portion)
- **DoD:** With 10 HIGH-priority wallets of which 3 acted in 24h, the indicator shows `30% (3/10)`; with zero active it renders the explicit "market quiet" state rather than `0%` alone; NORMAL-priority wallets do not affect the denominator.
- **Tests:** `breadth: percentage equals active over priority wallets`; `breadth: only HIGH-priority wallets count`; `breadth: zero activity sets isMarketQuiet and renders the quiet state`; `breadth: 7d window counts a wallet active once regardless of event count`; `breadth: no priority wallets yields a defined empty state, not a divide-by-zero`.

#### P3-T10 — Cluster rotation view
- **What:** Implement `computeClusterRotation` (exits from token set A and entries into set B within a 7-day window, intersection removed, summary sentence rendered) with `ClusterRotation` persistence, and the `RotationTimeline` UI on the cluster page.
- **Files:** `src/server/services/cluster/rotation.ts`, `src/server/trpc/routers/cluster.ts` (`rotation`), `src/components/radar/RotationTimeline.tsx`, `src/app/clusters/[id]/page.tsx`.
- **Covers:** FR-4.6, FR-2.6 (cluster page content).
- **Depends:** P3-T02, P1-T12, P3-D01 (approved before the UI portion)
- **DoD:** A cluster that sold PEPE and WOJAK then bought BRETT inside 7 days renders `Cluster X rotated: exited [PEPE, WOJAK] → entered [BRETT]` with a timeline; tokens both exited and entered are excluded from both lists; the record persists so the timeline is stable across reloads.
- **Tests:** `rotation: exited and entered sets are computed within the window`; `rotation: tokens in both sets are excluded`; `rotation: summary sentence matches the SRS phrasing`; `rotation: window boundary excludes older exits`; `rotation: persistence upserts on (cluster, windowStart, windowEnd)`.

#### P3-T11 — Radar evaluation job and cadence
- **What:** Implement `radar.evaluate` chaining the grouping, netflow rollup, breadth, and rotation stages over newly ingested events (`radarEvaluatedAt IS NULL`), register it as a repeatable job at `radarCadenceMinutes` (default 5), mark events evaluated, and add the `WINDOW` mode for explicit re-evaluation of a range.
- **Files:** `src/server/workers/processors/radar-evaluate.ts`, `src/server/workers/schedules.ts`, `src/server/services/radar/evaluate.ts`.
- **Covers:** FR-5.4 (cadence), FR-4.2–4.7, NFR-2, NFR-3.
- **Depends:** P3-T05, P3-T06, P3-T08, P3-T09, P3-T10
- **DoD:** New movements are grouped within one cadence interval; a second run over the same events creates zero additional groups and reports them as updated; `WINDOW` mode re-evaluates a historical range and converges to the same group set; the job runs at concurrency 1 so no duplicate groups can race.
- **Tests:** `radar-job: processes only unevaluated events in INCREMENTAL mode`; `radar-job: marks events radarEvaluatedAt`; `radar-job: second run creates zero new groups`; `radar-job: WINDOW mode reproduces the same groups`; `radar-job: registered as repeatable at radarCadenceMinutes`; `radar-job: concurrency is 1`.

#### P3-T12 — Phase 3 acceptance spec
- **What:** Author the Phase 3 Playwright acceptance spec using the `co-entry-24h` scenario: assert the feed streams actions, that a simulated two-wallet same-token buy within 24h yields a co-accumulation card, and that the netflow table and breadth indicator are populated.
- **Files:** `tests/e2e/phase3.spec.ts`, `tests/fixtures/scenarios/phase3-bundle.json`.
- **Covers:** SRS §8 Phase 3 acceptance (all three criteria), FR-4.1, FR-4.2, FR-4.5, FR-4.7.
- **Depends:** P3-T11, P3-T07, P3-T04
- **DoD:** `pnpm e2e tests/e2e/phase3.spec.ts` passes offline, asserting: the movement feed lists ingested actions with USD and market cap; a co-accumulation group card appears for the two independent buyers; the netflow table shows non-zero rows; the breadth indicator shows a percentage or the explicit quiet state.
- **Tests:** `phase3: feed streams ingested movements`; `phase3: two independent buys within 24h render a co-accumulation card`; `phase3: cluster co-entry renders as a separate warning card`; `phase3: netflow table populates for 24h`; `phase3: breadth indicator renders a percentage`.

### Phase 4 — Alert Engine

*SRS §8 acceptance: historical backfill of alerts after first sync; a test wallet with stablecoin inflow trips A1 with evidence tooltip; state badges (IDLE/ARMED/TRIGGERED) render on list, graph, and detail.*

Covers FR-5.1–5.5, all A/T/C rules, the Settings page for thresholds, and optional Telegram.

#### P4-D01 — Stitch design: alerts, state, evidence, and settings
- **What:** Use the taste skill and Google Stitch to design `/alerts`, unread/acknowledge flows, evidence details, wallet/cluster state treatments across existing surfaces, the full Settings experience, backup-staleness placement, and optional Telegram controls. Show `isSelf` C3 findings more prominently without hiding non-self findings. Obtain user approval under §5.0.
- **Files:** `docs/design/phase-4/{prompt.md,screen-map.md,interaction-notes.md,approval.md}`, `docs/design/DESIGN.md`, exported Stitch assets.
- **Covers:** FR-5.1–5.5, NFR-5, NFR-8, §0 D-4, D-5, D-7, D-10.
- **Depends:** P3-T12
- **DoD:** Approved Stitch screens cover all alert states, filters, unread/acknowledged states, malformed/missing evidence, the A2 floor and cold-start explanation, graded-definition and C3-scope controls, Telegram disabled/error states, and state consistency on list/graph/detail.
- **Tests:** Design checklist maps every Phase 4 surface/state to approved artifacts; state is not conveyed by color alone; destructive maintenance controls include irreversible-intent copy; no Phase 4 UI code precedes approval.

#### P4-T01 — Rule framework, registry, evidence contract
- **What:** Implement `src/lib/rules/` scaffolding per §4.8: the `RuleContext`/`RuleFinding`/`AlertRule` types, the `ALERT_RULES` registry keyed by `AlertType`, the `dedupeKey` builder (with the window-bucket convention), the evidence Zod schema (non-empty `ruleText`, `thresholds`, `observed`, ≥ 1 `txLink` for event-derived rules), and a shared helper for "null USD never satisfies a ≥ comparison".
- **Files:** `src/lib/rules/types.ts`, `src/lib/rules/registry.ts`, `src/lib/rules/dedupe.ts`, `src/lib/rules/evidence.ts`, `src/lib/rules/guards.ts`.
- **Covers:** FR-5.1, FR-5.5, SRS §10.6.
- **Depends:** P3-T02, P0-T05
- **DoD:** The registry contains exactly the 15 SRS rule IDs (A1–A6, T1–T5, C1–C4) with correct categories and lookbacks; an evidence object missing `ruleText` or `txLinks` fails schema validation; the null-USD guard returns false for `null >= 1000`.
- **Tests:** `rules: registry contains exactly A1-A6, T1-T5, C1-C4`; `rules: every rule declares a category and a lookback`; `rules: dedupeKey is stable for the same logical firing`; `rules: dedupeKey differs across window buckets`; `rules: evidence without ruleText is rejected`; `rules: evidence without txLinks is rejected for event rules`; `rules: null USD fails a threshold comparison`.

#### P4-T02 — Baseline statistics for arming rules
- **What:** Implement `src/server/services/alert/baselines.ts`: median daily stable inflow and median daily native inflow per wallet from `DailyFlow` (excluding zero days, requiring ≥ 7 qualifying days before the median term is considered available), the 30-day stable/native baselines for de-arming, and the stable peak tracker used by C4.
- **Files:** `src/server/services/alert/baselines.ts`, `src/server/services/alert/peak.ts`.
- **Covers:** A1, A2, C4, de-arm conditions.
- **Depends:** P1-T08, P1-T07
- **DoD:** For a wallet with inflow days `[100, 200, 300, 400, 500, 600, 700]`, the median is 400 and A1's multiple arm is 1,200; with only 5 qualifying days the median is reported unavailable; the stable peak equals the maximum snapshot since arming with its timestamp.
- **Tests:** `baselines: median excludes zero-inflow days`; `baselines: fewer than 7 qualifying days reports unavailable`; `baselines: even-count median uses the standard midpoint`; `baselines: 30-day baseline covers exactly 30 days`; `baselines: stable peak resets on arming`; `baselines: peak timestamp accompanies the peak value`.

#### P4-T03 — ARMED rules A1–A4
- **What:** Implement A1 (stablecoin arming), A2 (gas arming), A3 (CEX withdrawal), and A4 (dormancy wake) as pure rule functions with full evidence, using the exact thresholds and windows from §4.8.
- **Files:** `src/lib/rules/a1-stable-arming.ts`, `src/lib/rules/a2-gas-arming.ts`, `src/lib/rules/a3-cex-withdrawal.ts`, `src/lib/rules/a4-dormancy-wake.ts`.
- **Covers:** A1, A2, A3, A4 (FR-5.1, FR-5.5).
- **Depends:** P4-T02, P4-T01
- **DoD:** A wallet receiving $1,500 stable in 24h with a $200 median fires A1 (threshold `max($1,000, $600)`); $900 does not. For A2, a cold-start wallet receiving exactly $100 of native value fires on the floor while $99.99 does not; a wallet with a $60 median requires $180. A $1,000 CEX withdrawal fires A3 naming the entity; a 31-day-dormant wallet receiving $500 fires A4 while $499 does not. Evidence identifies the binding threshold arm and cold-start status.
- **Tests:** `A1: fires at the absolute floor when the median arm is lower`; `A1: fires at 3× median when that exceeds the floor`; `A1: does not fire below both arms`; `A1: window is exactly 24h`; `A1: evidence names which arm bound`; `A2: cold start fires at the $100 floor`; `A2: cold start does not fire at $99.99`; `A2: median arm binds when 3× median exceeds $100`; `A2: configured floor 0 restores literal median-only behavior`; `A2: evidence records both arms and cold-start status`; `A3: fires only for CEX-kind entities`; `A3: exactly $1,000 fires`; `A3: $999.99 does not fire`; `A4: 30 days dormant plus $500 fires`; `A4: 29 days dormant does not fire`; `A4: dormancy measured before the waking event`; `A1-A4: every finding carries thresholds, observed values, and tx links`.

#### P4-T04 — ARMED rules A5 (cluster) and A6 (consolidation)
- **What:** Implement A5 (one funder funding ≥ 2 same-cluster wallets within 48h → cluster-level ARMED, deduped per cluster+funder+window, attributed to every member, highest-priority visual treatment flag) and A6 (≥ 2 sweep sources that the wallet previously funded, within 48h).
- **Files:** `src/lib/rules/a5-cluster-arming.ts`, `src/lib/rules/a6-consolidation.ts`, `src/server/services/cluster/armed-state.ts`.
- **Covers:** A5, A6, FR-2.6 (cluster ARMED badge).
- **Depends:** P4-T03, P1-T12
- **DoD:** One funder funding two members of a cluster 40 hours apart fires exactly one A5 alert (not two), sets `Cluster.isArmed` with `armedAt`, and flags the escalated treatment; 50 hours apart fires nothing; a wallet receiving sweeps from two addresses it previously funded fires A6 with both sources in evidence.
- **Tests:** `A5: two cluster members funded by one funder within 48h fires once`; `A5: dedupe prevents one alert per member`; `A5: sets Cluster.isArmed and armedAt`; `A5: 49-hour gap does not fire`; `A5: different funders do not aggregate`; `A5: payload flags the escalated treatment`; `A6: two prior-funded sweep sources fire`; `A6: sources never funded by the wallet do not count`; `A6: single source does not fire`; `A6: evidence lists each sweep source with amount and tx`.

#### P4-T05 — TRIGGERED rules T1–T5
- **What:** Implement T1 (armed entry: ARMED state + token age < 7d + position ≥ $500), T2 (independent co-entry cross-referenced with FR-4.2 groups), T3 (fresh-launch entry < 1h), T4 (add-on-retrace after ≥ 20% drawdown from the local high), and T5 (cluster co-entry within 1h, warning-styled, paired with the FR-4.4 group). Resolve `hasGrade` from `gradedDefinition`: default `ANY_TAG_OR_COMPUTED` means any manual edge/style/size tag or a computed grade with sufficient sample; `EDGE_TAG_ONLY` means a manual edge tag only (§0 D-5).
- **Files:** `src/lib/rules/t1-armed-entry.ts`, `src/lib/rules/t2-independent-co-entry.ts`, `src/lib/rules/t3-fresh-launch.ts`, `src/lib/rules/t4-add-on-retrace.ts`, `src/lib/rules/t5-cluster-co-entry.ts`.
- **Covers:** T1–T5 (FR-5.1, FR-5.5), FR-4.2 and FR-4.4 cross-references.
- **Depends:** P4-T04, P3-T05, P3-T06, P3-T03
- **DoD:** An ARMED wallet buying a 3-day-old token for $600 fires T1; the same buy from an IDLE wallet does not; two independent graded wallets buying within 24h fire T2 for both and reference the co-accumulation group ID; a buy on a 45-minute-old token fires T3; adding to a position 25% below its peak fires T4 while 15% does not; two same-cluster buys within 1h fire T5 with the warning flag.
- **Tests:** `T1: requires ARMED state`; `T1: token age 7 days exactly does not fire (strict <)`; `T1: position below $500 does not fire`; `T1: null token age suppresses the rule`; `graded: default accepts any manual edge/style/size tag`; `graded: default accepts a computed grade with sufficient sample`; `graded: EDGE_TAG_ONLY rejects style-only and computed-only wallets`; `T2: two independent graded wallets fire`; `T2: dependent pair does not fire`; `T2: ungraded wallet is not counted`; `T2: finding references the co-accumulation group id`; `T3: 59-minute-old token fires`; `T3: 61-minute-old token does not`; `T3: null age suppresses`; `T4: 20% drawdown exactly fires`; `T4: 19% does not`; `T4: requires an open position and a known peak`; `T5: two same-cluster buys within 1h fire with warningStyle`; `T5: references the CLUSTER_CO_ENTRY group`.

#### P4-T06 — Exit-risk rules C1–C4 and the de-arm condition
- **What:** Implement C1 (memecoin CEX deposit by a graded wallet), C2 (≥ 2 graded wallets exiting one token within 12h), C3 (open position > 10x unrealized and older than 3 days, deduped daily), C4 (stable balance dropping > 70% from the recent peak within 48h after a TRIGGERED event), and the de-arm evaluation. C1/C2 use the same configurable graded definition as T2/T3. C3 evaluates all tracked wallets by default, marks `isSelf` findings for prominent rendering, and restricts to self wallets only when `c3SelfOnly=true` (§0 D-7).
- **Files:** `src/lib/rules/c1-distribution-prep.ts`, `src/lib/rules/c2-co-distribution.ts`, `src/lib/rules/c3-moon-discipline.ts`, `src/lib/rules/c4-campaign-spent.ts`, `src/lib/rules/dearm.ts`.
- **Covers:** C1–C4, the de-arm conditions (FR-5.1, FR-5.5).
- **Depends:** P4-T05, P3-T03, P4-T02
- **DoD:** A graded wallet depositing a memecoin to a labeled CEX emits C1 as `EXIT_RISK` **without** changing state; two graded wallets exiting within 12h emit C2 for both; an 11x non-self position older than 3 days emits C3 under the default setting, while an equivalent `isSelf` finding is marked prominent; enabling `c3SelfOnly` suppresses only the non-self finding; C3 emits once per day; C4 and de-arm behave as specified in §4.8.
- **Tests:** `C1: memecoin CEX deposit by a graded wallet emits EXIT_RISK`; `C1: stablecoin CEX deposit does not fire`; `C1: does not change wallet state`; `C2: two graded exits within 12h fire`; `C2: 13-hour spread does not fire`; `C2: sells and CEX deposits both count as exits`; `C3: 10x exactly does not fire (strict >)`; `C3: default evaluates self and non-self tracked wallets`; `C3: self finding carries prominent marker`; `C3: c3SelfOnly suppresses non-self findings`; `C3: 11x younger than 3 days does not fire`; `C3: deduped to once per day`; `C4: 71% drop within 48h of a trigger fires`; `C4: 69% drop does not fire`; `C4: drop outside the 48h window does not fire`; `dearm: 7 consecutive days at ≤120% baseline de-arms`; `dearm: 6 days does not de-arm`; `dearm: a single day above 120% resets the streak`; `dearm: outflow to a terminal entity de-arms immediately`.

#### P4-T07 — Alert evaluator, state machine, dedupe, backfill
- **What:** Implement `evaluateAlerts` and `applyStateTransition` per §4.8: batched context loading, ordered rule execution (arming → triggers → exit-risk → de-arm), transition precedence (de-arm > TRIGGERED > ARMED > no change), exit-risk never altering state, `ON CONFLICT DO NOTHING` alert persistence with suppression counting, and BACKFILL mode replaying history in ascending daily slices under a virtual clock. Register the incremental evaluation to run immediately after each radar run and trigger a one-time backfill after a wallet's first full sync.
- **Files:** `src/server/services/alert/evaluate.ts`, `src/server/services/alert/context.ts`, `src/server/services/alert/state-machine.ts`, `src/server/services/alert/persist.ts`, `src/server/workers/processors/alert-evaluate.ts`, `src/server/workers/schedules.ts`.
- **Covers:** FR-5.1, FR-5.4, NFR-3, SRS §8 Phase 4 acceptance (backfill).
- **Depends:** P4-T06, P3-T11
- **DoD:** After a wallet's first full sync, a backfill produces the historically correct alert sequence and the wallet's final state matches a replay computed independently in the test; re-running the same backfill creates zero new alerts and reports them suppressed; an EXIT_RISK finding leaves the state unchanged; a de-arm in the same batch as an ARMED finding results in IDLE.
- **Tests:** `evaluator: arming rules run before triggers`; `evaluator: exit-risk findings never change state`; `evaluator: de-arm takes precedence over ARMED in the same batch`; `evaluator: TRIGGERED takes precedence over ARMED`; `evaluator: duplicate findings are suppressed by dedupeKey`; `evaluator: incremental mode processes only unevaluated events`; `evaluator: backfill replays daily slices in order`; `evaluator: backfill is idempotent`; `evaluator: backfill state matches an independently computed replay`; `evaluator: first full sync enqueues exactly one backfill`; `evaluator: concurrency 1 prevents duplicate alerts under parallel enqueues`.

#### P4-T08 — Alert center page
- **What:** Build `/alerts`: a dense list of alerts with filters by type, state, token, and wallet; an unread badge in the navigation; acknowledge/mark-read (single and all); grouping by wallet or token; and cursor pagination.
- **Files:** `src/app/alerts/page.tsx`, `src/components/alerts/AlertList.tsx`, `src/components/alerts/AlertFilters.tsx`, `src/components/alerts/UnreadBadge.tsx`, `src/server/services/alert/list.ts`, `src/server/trpc/routers/alert.ts`.
- **Covers:** FR-5.2.
- **Depends:** P4-T07, P4-D01 (approved)
- **DoD:** Filters narrow by each dimension; the unread count decreases when an alert is marked read and reaches zero after "mark all read"; the badge reflects the count without a manual reload; pagination is stable.
- **Tests:** `alert-center: filters by type, state, token, wallet`; `alert-center: unread badge counts unread alerts`; `alert-center: marking one read decrements the badge`; `alert-center: mark all read zeroes the badge`; `alert-center: pagination is stable and non-overlapping`; `alert-center: grouping by wallet aggregates correctly`.

#### P4-T09 — Evidence tooltip
- **What:** Build `EvidenceTooltip` rendering, for any alert, the exact rule text, every threshold with its configured value, every observed number, the evaluation window, cluster context when present, and the list of tx links — reading `evidenceJson` through its Zod schema so a malformed evidence blob is a visible error, not a blank tooltip.
- **Files:** `src/components/alerts/EvidenceTooltip.tsx`, `src/lib/rules/evidence.ts` (render helpers).
- **Covers:** FR-5.5, SRS §10.6.
- **Depends:** P4-T08, P4-D01 (approved)
- **DoD:** Hovering an A1 alert shows "A1 — Stablecoin arming", the threshold `max($1,000, 3× median $200 = $600)`, the observed 24h inflow, the window, and ≥ 1 working tx link; every rule type renders a populated tooltip in the component test matrix.
- **Tests:** `evidence-tooltip: renders rule id and text`; `evidence-tooltip: lists thresholds with configured values`; `evidence-tooltip: lists observed numbers`; `evidence-tooltip: renders tx links that open the explorer`; `evidence-tooltip: renders cluster context for A5 and T5`; `evidence-tooltip: malformed evidence renders an explicit error state`; `evidence-tooltip: all 15 rule types render non-empty content`.

#### P4-T10 — State badges on list, graph, and detail
- **What:** Wire real `WalletState` values into the shared `StateBadge` component and render it on the wallet list, the graph node borders (replacing the Phase 2 placeholder mapping), and the wallet detail header; include the escalated cluster-ARMED treatment on cluster chips and compound graph parents.
- **Files:** `src/components/shared/StateBadge.tsx`, `src/components/wallets/WalletTable.tsx`, `src/components/graph/graph-styles.ts`, `src/app/wallets/[chain]/[address]/page.tsx`, `src/components/clusters/ClusterChip.tsx`.
- **Covers:** SRS §8 Phase 4 acceptance (badges on list, graph, detail), FR-5.1, A5 escalation, FR-3.5.
- **Depends:** P4-T07, P2-T05, P4-D01 (approved)
- **DoD:** A wallet in ARMED state shows the ARMED badge on all three surfaces simultaneously; the graph node border color matches the badge color via the shared mapping; a cluster with `isArmed` renders the escalated treatment distinct from a single wallet's ARMED badge.
- **Tests:** `badge: IDLE, ARMED, TRIGGERED each render distinct styling`; `badge: same mapping function used by list, graph, and detail`; `badge: cluster ARMED uses the escalated treatment`; `badge: state change is reflected on all surfaces after refetch`.

#### P4-T11 — Settings page for thresholds and configuration
- **What:** Build `/settings` with validated forms for: every A/T/C threshold (including `a2MinNativeInflowUsd`), `gradedDefinition`, `c3SelfOnly`, de-arm parameters, stable tokens per chain, co-entry windows and `minWallets`, sync/radar cadences, `minEdgeUsd`, `maxTraceDepth`, `profitSinkRatioPct`, quota reserve, entity labels, and maintenance actions. Changing a cadence re-registers the repeatable job; changing a threshold or definition takes effect on the next evaluation without a restart.
- **Files:** `src/app/settings/page.tsx`, `src/components/settings/ThresholdForm.tsx`, `src/components/settings/StableListEditor.tsx`, `src/components/settings/CadenceForm.tsx`, `src/components/settings/MaintenancePanel.tsx`, `src/server/trpc/routers/settings.ts`.
- **Covers:** SRS §9 (settings editable in UI), FR-5.4, FR-2.1, FR-2.4, FR-2.5, FR-3.4, FR-4.2, NFR-5 (prune entry point).
- **Depends:** P4-T07, P0-T05, P4-D01 (approved)
- **DoD:** Editing `a2MinNativeInflowUsd`, `gradedDefinition`, or `c3SelfOnly` changes the next evaluation as documented; invalid values are rejected without persistence; changing `radarCadenceMinutes` re-registers the repeatable job; every SRS §9 and §0-added setting is present; implementation matches approved Phase 4 Stitch screens.
- **Tests:** `settings-ui: every documented setting has a control`; `settings-ui: A2 floor defaults to $100`; `settings-ui: graded definition defaults to ANY_TAG_OR_COMPUTED`; `settings-ui: c3SelfOnly defaults false`; `settings-ui: invalid threshold shows a field error and does not persist`; `settings-ui: setting changes affect the next evaluation`; `settings-ui: cadence change re-registers the repeatable job`; `settings-ui: stable list edit updates parking detection`; `settings-ui: maxTraceDepth is capped at 6 in the UI`; `settings-ui: visual review matches approved Stitch artifacts`.

#### P4-T12 — Optional Telegram delivery
- **What:** Implement `src/server/services/alert/telegram.ts` and the `alert.deliver` job: off by default, enabled only when a bot token and chat ID are configured (from `.env` or Settings), formatted messages including rule, wallet label, token, amounts, and explorer links, per-alert delivery status recorded (`deliveredAt` / `deliveryError`), retries bounded, and a "send test message" action. Delivery failures never block evaluation.
- **Files:** `src/server/services/alert/telegram.ts`, `src/server/workers/processors/alert-deliver.ts`, `src/components/settings/TelegramForm.tsx`, `src/server/trpc/routers/alert.ts` (`testTelegram`).
- **Covers:** FR-5.3, NFR-1 (no telemetry beyond this explicit user-configured outbound).
- **Depends:** P4-T08, P4-T11
- **DoD:** With Telegram disabled (default), no outbound HTTP call is made and no delivery job is enqueued; with credentials configured, a new alert produces a formatted message and `deliveredAt` is set; a delivery failure records `deliveryError` and leaves the alert intact; the test action reports success or the exact API error.
- **Tests:** `telegram: disabled by default, no outbound call`; `telegram: enqueues delivery only when enabled and credentialed`; `telegram: message includes rule, wallet, token, amounts, and links`; `telegram: failure records deliveryError without failing evaluation`; `telegram: bounded retries then gives up`; `telegram: test message reports the API error verbatim`.

#### P4-T13 — Phase 4 acceptance spec
- **What:** Author the Phase 4 Playwright acceptance spec: seed a test wallet with a stablecoin inflow, run the first full sync, assert the historical backfill produced alerts, assert A1 fired with a populated evidence tooltip, and assert state badges render on the list, the graph, and the detail page.
- **Files:** `tests/e2e/phase4.spec.ts`, `tests/fixtures/scenarios/phase4-bundle.json`.
- **Covers:** SRS §8 Phase 4 acceptance (all three criteria), FR-5.1–5.5.
- **Depends:** P4-T12, P4-T10, P4-T09
- **DoD:** `pnpm e2e tests/e2e/phase4.spec.ts` passes offline, asserting: alerts exist after the first sync's backfill; the A1 alert is present with an evidence tooltip showing rule, thresholds, observed numbers, and a tx link; ARMED badges appear on `/wallets`, on the graph node, and on the wallet detail header.
- **Tests:** `phase4: first sync produces backfilled alerts`; `phase4: stablecoin inflow trips A1`; `phase4: A1 evidence tooltip shows rule, thresholds, numbers, tx link`; `phase4: ARMED badge renders on the wallet list`; `phase4: ARMED border renders on the graph node`; `phase4: ARMED badge renders on the wallet detail page`.

### Phase 5 — Self-Tracking

*SRS §8 acceptance: register self wallet → auto-linked trades with lag data; edge decay curve renders for a followed wallet with ≥ 5 linked trades.*

Covers FR-6.1–6.6.

#### P5-D01 — Stitch design: self-tracking and edge decay
- **What:** Use the taste skill and Google Stitch to design self-wallet registration, the trade log and thesis form, linked-signal evidence, lag/market-cap comparisons, the edge-decay chart plus accessible table, PnL breakdowns, and empty/insufficient-sample states. Obtain user approval under §5.0.
- **Files:** `docs/design/phase-5/{prompt.md,screen-map.md,interaction-notes.md,approval.md}`, `docs/design/DESIGN.md`, exported Stitch assets.
- **Covers:** FR-6.1–6.6, NFR-8, §0 D-5.
- **Depends:** P4-T13
- **DoD:** Approved Stitch screens cover auto and manual trades, required thesis errors, pinned links, unknown ROI, open versus realized PnL, lag buckets, and insufficient samples without implying financial advice.
- **Tests:** Design checklist maps every Phase 5 UI requirement/state to an approved artifact; every chart has an equivalent readable table; no Phase 5 UI code precedes approval.

#### P5-T01 — Self wallet registration and ingestion
- **What:** Ensure `isSelf` wallets flow through the identical intake pipeline and are excluded from watchlist-signal roles: they never count as participants in co-accumulation groups, never appear as followed-wallet candidates, and are excluded from breadth denominators. Add a self-wallet section to the registry UI.
- **Files:** `src/server/services/wallet/self.ts`, `src/server/services/radar/group.ts` (exclusion), `src/server/services/movement/breadth.ts` (exclusion), `src/app/self/page.tsx` (registration entry), `src/components/wallets/SelfWalletCard.tsx`.
- **Covers:** FR-6.1, FR-1.5 (`is-self` flag semantics).
- **Depends:** P4-T07, P1-T15, P5-D01 (approved before the registration UI portion)
- **DoD:** Marking a wallet `isSelf` runs the same intake and produces movements and positions; that wallet never appears as a member of a co-accumulation group nor as a followed-wallet candidate; breadth percentages are unaffected by self wallets.
- **Tests:** `self: isSelf wallet is ingested by the same pipeline`; `self: excluded from co-accumulation membership`; `self: excluded from followed-wallet candidates`; `self: excluded from the breadth denominator`; `self: can be toggled back to a normal watchlist wallet`.

#### P5-T02 — Auto-link trades to watchlist signals
- **What:** Implement `linkTradeToSignal` per §4.10 (nearest qualifying graded-wallet entry before the user's entry within the lookback, `gradedDefinition`, deterministic tie-breaking, `lagMinutes`, `lagMcDelta`, `walletRoiPct`, `userRoiPct`, `lagBucket`, link evidence, pinned-link respect) plus the `self.link.trades` job and automatic invocation after self-wallet ingestion.
- **Files:** `src/server/services/self/link.ts`, `src/server/workers/processors/self-link.ts`, `src/server/services/self/roi.ts`.
- **Covers:** FR-6.2.
- **Depends:** P5-T01, P3-T03
- **DoD:** A user buy 90 minutes after a graded wallet's buy on the same token links to that wallet with `lagMinutes: 90`, `lagBucket: '1-6h'`, and a market-cap delta; a user buy with no preceding graded entry stays unlinked with a recorded reason; a pinned link is never overwritten.
- **Tests:** `link: nearest preceding graded entry is chosen`; `link: ANY_TAG_OR_COMPUTED accepts tagged or sufficiently computed grades`; `link: EDGE_TAG_ONLY accepts only manual edge tags`; `link: later wallet entry is not chosen`; `link: lagMinutes computed as user minus wallet entry`; `link: lagMcDelta null when either market cap is unknown`; `link: lagBucket boundaries 60, 360, 1440 minutes`; `link: bucket boundary exactly 60 minutes falls in 1-6h`; `link: ungraded wallet is not a candidate`; `link: self wallets are not candidates`; `link: no candidate leaves the trade unlinked with a reason`; `link: pinned link is not overwritten`; `link: tie broken by watch priority then USD then address`.

#### P5-T03 — Manual trade log with required thesis
- **What:** Implement `self.addTrade`/`self.updateTrade` with a Zod schema requiring a non-empty `thesis` for `source: MANUAL`, an optional explicit `followedWallet` (which sets `isLinkPinned`), and the `TradeLogForm` UI. Manual trades participate in all analytics identically to AUTO trades.
- **Files:** `src/server/services/self/trades.ts`, `src/server/trpc/routers/self.ts`, `src/components/self/TradeLogForm.tsx`, `src/app/self/trades/page.tsx`.
- **Covers:** FR-6.3.
- **Depends:** P5-T02, P5-D01 (approved before the UI portion)
- **DoD:** Submitting a manual trade without a thesis is rejected server-side with a field error (not merely disabled in the UI); supplying a followed wallet pins the link; manual trades appear in the dashboard and decay analytics alongside auto trades.
- **Tests:** `manual-trade: empty thesis is rejected server-side`; `manual-trade: whitespace-only thesis is rejected`; `manual-trade: explicit followedWallet sets isLinkPinned`; `manual-trade: appears in dashboard aggregates`; `manual-trade: AUTO trades do not require a thesis`; `manual-trade: update preserves the pinned link`.

#### P5-T04 — Edge decay curve
- **What:** Implement `computeEdgeDecay` (per followed wallet, average user ROI and win rate bucketed 0–1h / 1–6h / 6–24h / >24h, sample size, `insufficientSample` when below the minimum) and the `EdgeDecayChart` UI rendering both the table and the Recharts line chart, with an explicit low-sample notice.
- **Files:** `src/server/services/self/decay.ts`, `src/components/self/EdgeDecayChart.tsx`, `src/app/self/page.tsx`.
- **Covers:** FR-6.4.
- **Depends:** P5-T02, P5-D01 (approved before the UI portion)
- **DoD:** With 5+ linked trades for one followed wallet, the chart and table render all four buckets with average ROI and win rate; buckets with no trades render as empty rather than zero; below the minimum sample the UI states the sample is insufficient instead of implying a conclusion.
- **Tests:** `decay: buckets trades by the FR-6.4 boundaries`; `decay: average ROI computed per bucket`; `decay: win rate computed per bucket`; `decay: empty bucket renders empty, not 0%`; `decay: sampleSize below minimum sets insufficientSample`; `decay: chart and table show identical numbers`; `decay: per-followed-wallet filtering works`.

#### P5-T05 — Personal dashboard
- **What:** Implement `computeSelfDashboard` (win rate, total PnL, PnL by followed wallet with average lag, PnL by token, PnL by lag bucket) and the dashboard UI answering "when I follow within 1h do I actually win?" with the 0–1h bucket highlighted.
- **Files:** `src/server/services/self/dashboard.ts`, `src/components/self/PnlBreakdown.tsx`, `src/app/self/page.tsx`.
- **Covers:** FR-6.5.
- **Depends:** P5-T04, P5-D01 (approved)
- **DoD:** The dashboard reports win rate and total PnL matching hand-computed fixture values, with breakdowns by followed wallet, token, and lag bucket; open positions are excluded from realized PnL and shown separately as unrealized.
- **Tests:** `dashboard: win rate equals winning trades over closed trades`; `dashboard: total PnL sums realized results`; `dashboard: open positions are excluded from realized PnL`; `dashboard: PnL by followed wallet aggregates correctly`; `dashboard: PnL by token aggregates correctly`; `dashboard: PnL by lag bucket matches the decay table`; `dashboard: zero trades renders a defined empty state`.

#### P5-T06 — Comparison view
- **What:** Build the per-linked-trade comparison: user ROI vs followed-wallet ROI side by side with the lag and market-cap delta, sortable, with an explicit "captured / decayed" indicator derived from the ROI gap sign.
- **Files:** `src/components/self/ComparisonTable.tsx`, `src/server/services/self/comparison.ts`, `src/server/trpc/routers/self.ts` (`comparison`).
- **Covers:** FR-6.6.
- **Depends:** P5-T05, P5-D01 (approved)
- **DoD:** Each linked trade shows both ROIs, the lag, and the market-cap delta; a trade where user ROI ≥ wallet ROI is marked as captured and otherwise as decayed; trades with an unknown wallet ROI show `—` rather than a misleading verdict.
- **Tests:** `comparison: renders user and wallet ROI per linked trade`; `comparison: captured when user ROI ≥ wallet ROI`; `comparison: decayed when user ROI < wallet ROI`; `comparison: unknown wallet ROI renders an em dash with no verdict`; `comparison: sortable by lag and by ROI gap`.

#### P5-T07 — Phase 5 acceptance spec
- **What:** Author the Phase 5 Playwright acceptance spec on the `self-wallet-trades` scenario: register a self wallet, assert auto-linked trades carry lag data, and assert the edge decay curve renders for a followed wallet with ≥ 5 linked trades.
- **Files:** `tests/e2e/phase5.spec.ts`, `tests/fixtures/scenarios/phase5-bundle.json`.
- **Covers:** SRS §8 Phase 5 acceptance (both criteria), FR-6.1–6.6.
- **Depends:** P5-T06
- **DoD:** `pnpm e2e tests/e2e/phase5.spec.ts` passes offline, asserting: registering the self wallet produces auto-linked trades with non-null `lagMinutes` and `followedWallet`; the edge decay chart renders four buckets for a wallet with ≥ 5 linked trades; the comparison view lists both ROIs.
- **Tests:** `phase5: self wallet registration ingests trades`; `phase5: trades are auto-linked with lag data`; `phase5: decay curve renders with ≥5 linked trades`; `phase5: dashboard shows win rate and PnL`; `phase5: comparison view lists user vs wallet ROI`.

### Phase 6 — Token Lookup & Grading

*SRS §8 acceptance: paste a token → holders/netflow/red-flag panel renders in < 3s from local DB.*

Covers FR-7.1–7.2 plus auto-grade computation (win rate, realized PnL, entry-timing ratio) on the wallet profile.

#### P6-D01 — Stitch design: token lookup, grading, and maintenance
- **What:** Use the taste skill and Google Stitch to design token lookup entry/detail, holder/grade/status tables, netflow, cluster and promoter warnings, concentration, wallet grade blocks, refresh progress, and safe maintenance/quota/backup-reminder surfaces. Obtain user approval under §5.0.
- **Files:** `docs/design/phase-6/{prompt.md,screen-map.md,interaction-notes.md,approval.md}`, `docs/design/DESIGN.md`, exported Stitch assets.
- **Covers:** FR-7.1–7.2, Phase 6 grading, NFR-2, NFR-5, NFR-7, NFR-8, §0 D-10.
- **Depends:** P5-T07
- **DoD:** Approved Stitch screens cover unknown token, unavailable holder data, unknown USD/supply, low-sample grade, refresh progress/failure, stale backup reminder, explicit prune confirmation, and quota exhaustion.
- **Tests:** Design checklist maps every Phase 6 UI requirement/state to an approved artifact; destructive actions are unmistakable and keyboard accessible; no Phase 6 UI code precedes approval.

#### P6-T01 — Auto-grade computation
- **What:** Implement `src/server/services/wallet/grade.ts`: win rate (closed positions with positive realized PnL ÷ closed positions), realized PnL total, and entry-timing ratio (the wallet's average entry market cap ÷ the token's peak market cap across its positions, i.e. how early it entered), with a minimum sample size below which the grade is reported as unavailable; persist to `WalletProfile.gradeJson` and render on the profile.
- **Files:** `src/server/services/wallet/grade.ts`, `src/components/wallets/GradeCard.tsx`, `src/app/wallets/[chain]/[address]/page.tsx`.
- **Covers:** SRS §8 Phase 6 (auto-grade computation: WR, realized PnL, entry-timing ratio), FR-1.4 (profile surface).
- **Depends:** P3-T03, P1-T06, P6-D01 (approved before the grade UI portion)
- **DoD:** For a wallet with 10 closed positions of which 6 are profitable, the grade reports 60% win rate, the exact realized PnL sum, and an entry-timing ratio in (0, 1]; below the minimum sample the grade is explicitly unavailable rather than a misleading number; the grade label used by radar groups (`gradeLabel`) reflects FR-1.6's computed label.
- **Tests:** `grade: win rate equals profitable over closed positions`; `grade: realized PnL sums closed positions only`; `grade: entry-timing ratio uses entry market cap over peak market cap`; `grade: below minimum sample reports unavailable`; `grade: recompute is idempotent`; `grade: gradeLabel matches the FR-1.6 computed label`.

#### P6-T02 — Token holder concentration and red-flag checks
- **What:** Implement `src/server/services/token/red-flags.ts`: the deployer→wallet transfer check (any tracked wallet that received the token directly from its deployer = paid-promoter warning), the top-10 holder share from explorer data via `getTokenHolderSummary`, and token age; persist to `Token.redFlagJson` with `redFlagCheckedAt` and handle "holder data unavailable" as an explicit state, never as zero concentration.
- **Files:** `src/server/services/token/red-flags.ts`, `src/lib/chains/etherscan-v2-adapter.ts` (`getTokenHolderSummary`), `src/server/trpc/routers/token.ts` (`redFlags`).
- **Covers:** FR-7.2, FR-7.1 (red flags).
- **Depends:** P3-T01, P0-T10
- **DoD:** A tracked wallet that received the token directly from the deployer address raises the paid-promoter warning naming the wallet and the tx; top-10 holder share is stored when available and reported as unavailable otherwise; token age is reported from `deployedAt`.
- **Tests:** `red-flags: deployer-to-tracked-wallet transfer raises the promoter warning`; `red-flags: transfer from a non-deployer does not`; `red-flags: warning names the wallet and the tx hash`; `red-flags: top-10 share stored when the explorer provides holders`; `red-flags: unavailable holder data reported explicitly, not as 0%`; `red-flags: token age derived from deployedAt`; `red-flags: multiple promoter wallets are all listed`.

#### P6-T03 — Token lookup panel
- **What:** Build `/tokens` (paste address + chain) and `/tokens/[chain]/[address]`: tracked-wallet holders with grades, entry market caps, and current status (holding / distributed / exited, derived from `Position` and `cexDepositedUsd`); the netflow history of tracked wallets on this token; cluster presence warnings; the red-flag list; and supply concentration among tracked wallets. All reads come from the local DB; a background refresh job updates metadata without blocking the render.
- **Files:** `src/app/tokens/page.tsx`, `src/app/tokens/[chain]/[address]/page.tsx`, `src/components/tokens/TokenLookupForm.tsx`, `src/components/tokens/HolderTable.tsx`, `src/components/tokens/RedFlagList.tsx`, `src/components/tokens/TokenNetflowChart.tsx`, `src/server/services/token/lookup.ts`, `src/server/trpc/routers/token.ts` (`lookup`, `refresh`).
- **Covers:** FR-7.1, FR-7.2 (display), NFR-2 (refresh is a job).
- **Depends:** P6-T02, P3-T08, P6-T01, P6-D01 (approved)
- **DoD:** Pasting a token address renders holders with grades and entry MCs, the netflow chart, cluster warnings, and red flags in **< 3 s measured from the local DB** with no blocking external call; a token with no tracked-wallet activity renders a defined empty state; pressing refresh enqueues a metadata job whose progress is visible.
- **Tests:** `lookup: renders tracked holders with grades and entry market caps`; `lookup: status reflects holding vs distributed vs exited`; `lookup: netflow history renders for the token`; `lookup: cluster presence warning appears when a cluster holds the token`; `lookup: red flags render including the promoter warning`; `lookup: supply concentration among tracked wallets is computed`; `lookup: unknown token renders an empty state`; `lookup: panel renders in under 3 seconds from the local DB`; `lookup: refresh enqueues a job and does not block the render`.

#### P6-T04 — Maintenance: prune, rebuild, quota reporting
- **What:** Implement the manual "prune token history" utility (delete transactions, movements, snapshots, positions, and flows for one token after an explicit confirmation, never automatically), the `derive.rebuild` UI entry points, quota/usage reporting, and `maintenance.backupInfo`. Show a non-blocking dashboard reminder when the newest successful backup is older than 7 days or absent; link it to the documented manual backup command. Do not schedule backups or delete old files (§0 D-10).
- **Files:** `src/server/services/maintenance/prune.ts`, `src/server/workers/processors/maintenance-prune.ts`, `scripts/prune-token-history.ts`, `src/components/settings/MaintenancePanel.tsx`, `src/app/health/page.tsx`, `src/server/trpc/routers/maintenance.ts`.
- **Covers:** NFR-5, NFR-2, SRS §5 (quota visibility), §6 of this plan.
- **Depends:** P6-T03, P0-T15, P6-D01 (approved before the UI portion)
- **DoD:** Pruning requires explicit confirmation, reports exact deleted row counts, and leaves other tokens untouched; scheduled jobs never reduce retained row or backup-file counts; the health page shows provider usage; the dashboard reminder appears for no backup or age >7 days, disappears at ≤7 days, and never blocks use.
- **Tests:** `prune: requires explicit confirmation`; `prune: deletes only the named token's rows`; `prune: reports per-table deleted counts`; `prune: does not touch other tokens' data`; `retention: no scheduled job ever deletes rows or backup files`; `quota-report: shows calls today, remaining, and rate-limit hits per provider`; `backup-reminder: visible when no backup exists`; `backup-reminder: visible only when newest backup is older than 7 days`; `backup-reminder: links to manual backup instructions`.

#### P6-T05 — Phase 6 acceptance spec
- **What:** Author the Phase 6 Playwright acceptance spec: paste a token address and assert the holders/netflow/red-flag panel renders within 3 seconds, plus assert the grade block renders on a wallet profile.
- **Files:** `tests/e2e/phase6.spec.ts`, `tests/fixtures/scenarios/phase6-bundle.json`.
- **Covers:** SRS §8 Phase 6 acceptance, FR-7.1, FR-7.2.
- **Depends:** P6-T04
- **DoD:** `pnpm e2e tests/e2e/phase6.spec.ts` passes offline, asserting the panel's three sections render and the measured render time is under 3 seconds; the wallet profile shows win rate, realized PnL, and entry-timing ratio.
- **Tests:** `phase6: token panel renders holders, netflow, and red flags`; `phase6: panel renders in under 3 seconds`; `phase6: promoter red flag is visible for a deployer-funded wallet`; `phase6: wallet profile shows the auto-grade block`.

### Phase 7 (optional, later) — Solana via Helius

Out of scope for v1 (SRS §1 non-goal, §8 marks it optional). The plan does not decompose it into tasks. Two things are required of Phases 0–6 so that Phase 7 is additive rather than a rewrite, and both are already enforced above: the `ChainAdapter` boundary with no chain literals outside `src/lib/chains/**` (P0-T10's boundary test), and `Chain` as an additive enum (§3.4). When Phase 7 is authorized, the work is: add `SOLANA` to the enum, add a registry entry, implement `HeliusAdapter` against the same interface (including its `funded-by` endpoint for FR-2.1), and extend the stable-token settings map. No service, rule, or component should require modification.

### Phase 8 — Documentation & Walkthrough (required for v1 completion)

*Plan-added acceptance: a new user can understand Watchtower, run it locally from a clean machine, complete its core workflow, interpret its evidence, back up and restore data, and perform routine maintenance using only the checked-in documentation.*

Phase 8 runs after Phase 6 acceptance; optional Phase 7 is not a prerequisite. Documentation describes only verified, shipped behavior. It must not copy secrets, private wallet material, live API keys, personal addresses, or mutable vendor limits without an access date.

#### P8-T01 — Documentation inventory, information architecture, and source map
- **What:** Inventory the shipped routes, commands, environment variables, queue jobs, data models, business rules, tests, approved Stitch artifacts, provider integrations, and existing comments. Freeze the documentation map below, assign one canonical page per fact, and create a coverage checklist that links every topic to its source code/test owner so later docs do not drift through duplication.
- **Files:** `docs/documentation-map.md`, `docs/documentation-coverage.md`, documentation front matter/template shared by Phase 8 pages.
- **Covers:** §0 D-12; documentation accuracy and maintainability.
- **Depends:** P6-T05
- **DoD:** Every v1 route, public command, required/optional environment variable, queue, provider, major data model, decision D-1–D-12, and maintenance action has exactly one canonical documentation destination and a source pointer; gaps block later Phase 8 tasks.
- **Tests:** `docs inventory: routes match src/app`; `docs inventory: scripts match package.json`; `docs inventory: env keys match the Zod schema and .env.example`; `docs inventory: no topic has two competing canonical pages`; `docs inventory: no secret value or personal address is captured`.

#### P8-T02 — README, product overview, objective, scope, key features, and glossary
- **What:** Write the project entry point and conceptual overview: user/problem, objective, v1 scope, non-goals, supported chains, same-chain limitation, feature tour, core terminology, data/privacy posture, current maturity, and links into deeper docs. Clearly distinguish factual intelligence from financial advice and explain local-only/read-only behavior.
- **Files:** `README.md`, `docs/overview.md`.
- **Covers:** Requested overview, objective, key features, scope, glossary, and safety context.
- **Depends:** P8-T01
- **DoD:** A reader with no project context can explain what Watchtower does, who it is for, which three chains it supports, what it deliberately does not do, and where to go for setup, architecture, business rules, walkthrough, or operations; all feature claims map to shipped acceptance tests.
- **Tests:** `overview: names Base, BSC, and Robinhood only`; `overview: states same-chain-only and links backlog B-1`; `overview: states local-only, read-only, no key handling, no trade execution`; `overview: links every canonical guide`; `overview: no unshipped feature is presented as available`.

#### P8-T03 — Architecture and data-flow documentation
- **What:** Document the runtime/container architecture, module boundaries, `ChainAdapter` implementations, provider/rate-limit layer, BullMQ job flows, ingestion and derivation pipeline, PostgreSQL schema domains, Redis responsibilities, tRPC/UI boundary, cache/cursor/idempotency strategy, pricing attribution, time handling, and failure/degraded paths. Add Mermaid diagrams for container topology, wallet-intake sequence, alert evaluation, and backup/migration flow.
- **Files:** `docs/architecture.md`, `docs/diagrams/{containers.mmd,wallet-intake.mmd,alert-evaluation.mmd,backup-migration.mmd}`.
- **Covers:** Requested architecture documentation; NFR-1–NFR-9; provider decisions.
- **Depends:** P8-T01
- **DoD:** Every diagram and narrative agrees with deployed compose services and frozen interfaces; data ownership and external-call boundaries are explicit; Base/BSC versus Robinhood provider paths and all `UNKNOWN` degradation states are documented; adding a future adapter is explained without implying cross-chain analytics.
- **Tests:** `architecture: compose service names and ports match docker-compose.yml`; `architecture: ChainAdapter method list matches source`; `architecture: queue names/cadences match source and Settings`; `architecture: schema/domain names match Prisma`; `architecture: Mermaid diagrams render`; `architecture: every external API call is shown behind a worker boundary`.

#### P8-T04 — Key decisions and business-logic reference
- **What:** Turn §0 plus the implemented algorithms into a durable reference with formulas, boundary examples, evidence fields, configurable values, null/unknown behavior, and links to tests. Cover funding traversal/terminal stops, primary-wallet outflow accounting, stable parking, clustering, independence, both heatmaps, movement classification, co-groups and supply share, position/PnL, A1–C4 including state transitions and de-arm, graded-wallet semantics, self-trade linking/lag buckets, token red flags, backup policy, and same-chain restrictions.
- **Files:** `docs/business-logic.md`, `docs/decisions/README.md`; normalize or cross-link ADRs in `docs/decisions/` without duplicating their authority.
- **Covers:** Requested key decisions and business logic; D-1–D-12; FR-1.x–FR-7.x.
- **Depends:** P8-T01
- **DoD:** Each rule has inputs, formula/algorithm, exact inclusive/exclusive boundary semantics, default settings, cold-start/null behavior, persisted evidence, and at least one worked example; each D-1–D-12 decision points to the code/tests that implement it; historical decisions are separated from future backlog.
- **Tests:** `business logic: every AlertType A1–C4 appears exactly once`; `business logic: A2 uses max($100, 3× median) and documents cold start`; `business logic: outflow excludes router swap legs and gas`; `business logic: CO_ENTRY excluded from independence`; `business logic: both heatmap modes documented`; `business logic: C3 default/all and self-only toggle documented`; `business logic: formulas match unit-test fixtures`.

#### P8-T05 — Installation, configuration, and how-to-run guide
- **What:** Write a clean-machine setup for prerequisites, cloning/unpacking, `.env`, provider keys, Docker Compose boot, migrations, seed, dev mode, worker mode, production-local mode, health checks, verification commands, shutdown, and update/restart. Explain required versus optional credentials and safe placeholders; include Windows PowerShell and POSIX command variants where syntax differs.
- **Files:** `docs/getting-started.md`, `docs/configuration.md`, README quick-start section.
- **Covers:** Requested how-to-run documentation; NFR-1, NFR-2, NFR-6; SRS §7/§9.
- **Depends:** P8-T01, P0-T18
- **DoD:** A clean-room user can reach a healthy local app and worker using only this guide; every command is copy/pasteable from the repository root; configuration tables state type, requiredness, safe example, default, consumer, and restart requirement; no real secret is present.
- **Tests:** `getting started: clean-room docker compose procedure reaches healthy`; `getting started: every command exits 0 in its documented context`; `configuration: key set equals env schema/.env.example`; `configuration: DEFAULT_CHAIN is base`; `configuration: no key is described as a signing/private key`; `configuration: provider failure path links troubleshooting`.

#### P8-T06 — End-user walkthrough with approved UI captures
- **What:** Write a task-oriented walkthrough using screenshots captured from the implemented UI that matches approved Stitch screens: import one/batch wallets, monitor job progress, inspect a profile and both heatmaps, trace funding and understand terminal/primary labels, explore graph/independence, use radar/groups/netflow, inspect/acknowledge alerts and evidence, configure thresholds, register a self wallet and interpret lag/decay, look up a token, and recognize empty/degraded/unknown states. Use deterministic fixtures; redact addresses unless they are documented public fixtures.
- **Files:** `docs/user-guide.md`, `docs/assets/walkthrough/*.webp`, screenshot capture spec/script under `tests/e2e/docs-screenshots.spec.ts`.
- **Covers:** Requested complete walkthrough; FR-1.x–FR-7.x; NFR-2, NFR-8; approved Stitch fidelity.
- **Depends:** P8-T02, P8-T04, all `P0-D01`–`P6-D01` approvals
- **DoD:** The walkthrough covers every top-level route and complete MVP happy path, explains evidence rather than merely naming buttons, includes visible version-matched captures for each major step, and links to troubleshooting at every recoverable failure point.
- **Tests:** `walkthrough: screenshot automation completes against deterministic fixtures`; `walkthrough: every top-level route has a task or explicit reference`; `walkthrough: screenshots contain no secrets or personal wallet data`; `walkthrough: captures match current approved design identifiers`; `walkthrough: keyboard path exists for graph-dependent insights`.

#### P8-T07 — Maintenance, backup/restore, troubleshooting, and upgrade runbooks
- **What:** Document routine operations and safe recovery: health/quota interpretation, job retry/cancel, log locations, manual backup, automatic pre-migration backup, restore rehearsal, backup-staleness reminder, migrations/rollback posture, full re-sync, derived-data rebuild, token prune, entity/stable-token maintenance, provider credential rotation, adding a same-chain adapter, dependency/container upgrades, data growth, incident triage, and known limitations. For each destructive command, state exact scope, prerequisites, confirmation, expected output, recovery, and what must never be run against unspecified targets.
- **Files:** `docs/operations.md`, `docs/troubleshooting.md`, `docs/runbooks/{backup-restore.md,provider-outage.md,failed-job.md,upgrade.md}`.
- **Covers:** Requested maintenance documentation; NFR-1–NFR-6; D-1, D-2, D-10.
- **Depends:** P8-T03, P8-T05
- **DoD:** An operator can diagnose each health state, restore a disposable database from backup, recover a failed job without duplicates, rotate a read-only provider key, and distinguish rebuild/resync/prune; destructive actions are never presented as routine shortcuts; vendor-specific limits carry source links and access dates.
- **Tests:** `runbook: backup and disposable restore reproduce seeded row counts`; `runbook: failed-job retry remains idempotent`; `runbook: prune scope and irreversibility warning are explicit`; `runbook: no recursive delete or mainnet broadcast command exists`; `runbook: provider URLs/limits are source-linked and dated`; `runbook: upgrade sequence performs backup before migration`.

#### P8-T08 — Documentation QA and clean-room acceptance
- **What:** Run the final documentation audit: link/anchor/image checks, markdown lint, Mermaid rendering, command extraction, terminology consistency, source-code drift checks, secret scan, screenshot freshness, and a clean-room walkthrough by a verifier who did not author the pages. Fix every blocker and record the verification report with app version/date.
- **Files:** `scripts/verify-docs.mjs`, `package.json` (`docs:verify`), `docs/verification-report.md`; corrections anywhere under `README.md`/`docs/**`.
- **Covers:** Phase 8 acceptance and documentation maintenance quality.
- **Depends:** P8-T02–P8-T07
- **DoD:** `pnpm docs:verify` exits 0 with no broken internal links, missing assets, invalid Mermaid, undocumented env keys/routes/commands, or detected secrets; a clean-room verifier boots the app, completes the core walkthrough, makes a backup, and restores it into a disposable database using only the docs; all discrepancies are corrected and the signed-off report records commands/results.
- **Tests:** `docs: markdown and links pass`; `docs: Mermaid renders`; `docs: code blocks marked runnable execute in isolated documented contexts`; `docs: env/routes/scripts coverage has zero gaps`; `docs: secret scan has zero findings`; `docs: screenshots exist and match current capture manifest`; `docs: clean-room setup and walkthrough pass`; `docs: backup/restore rehearsal passes`.

---

## 6. API Quota Budget

**Known limits from the SRS.** Etherscan V2: ~5 calls/sec, **100,000 calls/day**, max **1,000 records per request**, with one key shared by Base and BSC. DexScreener: no key and no published daily cap in the SRS, so Watchtower imposes 20,000 calls/day at 3 rps. CoinGecko is optional and best-effort. Robinhood provider limits are not guessed: P0-T18 measures and records them before Phase 1 (§6.7).

The call-count math in §6.1–§6.6 is provider-neutral at the `ChainAdapter` level, but the named 100,000-call percentages apply only to the portion of the watchlist on Base/BSC. The tables conservatively model all 100 wallets on Etherscan-backed chains. A mixed watchlist splits calls by provider; every enabled provider gets its own limiter, budget guard, and health status.

**Modelling assumptions, stated so the math is auditable.**

| Symbol | Meaning | Assumed value |
|---|---|---|
| `E` | Indexed-history endpoints per wallet per chain | 3 (normal, internal, ERC-20) |
| `T` | Median tracked-wallet lifetime tx count (memecoin trader) | 1,500 records per endpoint |
| `P` | Records per request | 1,000 |
| `F` | Funder nodes expanded per trace at default depth 3 | 8 non-terminal nodes |
| `W` | Watchlist size | 100 wallets (SRS's own batch-import figure) |
| `H` | Priority (HIGH) wallets | 30 |
| `C` | Sync cadence | 15 min → 96 ticks/day |
| `B` | Balance-snapshot tokens per wallet | 4 (3 stables + native) |

### 6.1 Single-wallet intake

| Step | Calls | Math |
|---|---|---|
| History fetch | 3 endpoints × ⌈1,500 ÷ 1,000⌉ = 3 × 2 | **6** |
| Boundary re-fetch overhead (§4.2 step 4, ~1 extra page per endpoint) | 3 | **3** |
| Latest block | 1 | **1** |
| Funding trace: inbound history for `F` non-terminal funders (2 endpoints each — native + internal only; ERC-20 is not a funding source) | 8 × 2 | **16** |
| Funding trace: entity lookups | 0 (local DB) | **0** |
| Token metadata for new tokens (assume 12 distinct tokens; contract-creation + supply = 2 calls each, cached forever) | 12 × 2 | **24** |
| Balances (`getBalances`, batched per token) | 4 | **4** |
| **Etherscan subtotal** | | **54 calls** |
| DexScreener: token prices (12 tokens ÷ 30 per batch) + pair discovery | 1 + 12 | **13 calls** |

At 4 calls/sec effective, one intake takes **≈ 14 s of quota time**; the wall-clock is dominated by that, not by CPU. A heavy wallet (10,000 txs per endpoint) rises to 3 × 10 + 3 + 1 + 16 + 24 + 4 = **78 calls**.

### 6.2 Batch import of 100 wallets

| Component | Calls |
|---|---|
| 100 × intake (54 each) | 5,400 |
| Shared-token dedup saving (assume 40% token overlap across wallets) | −(0.4 × 100 × 24) ≈ −960 |
| Cross-wallet funder overlap saving (clusters share funders; assume 25% overlap) | −(0.25 × 100 × 16) = −400 |
| **Etherscan total** | **≈ 4,040 calls** |
| DexScreener total (unique tokens ≈ 720, batched 30/req + pair discovery) | ≈ 24 + 720 = **744 calls** |

For the conservative all-Base/BSC case, **4,040 ÷ 100,000 = 4.0% of the daily Etherscan budget.** Wall-clock at 4 calls/sec ≈ **17 minutes**, which is why NFR-2 requires visible background progress. Robinhood wall-clock and percentage use the P0-T18 ADR instead of this 100,000-call denominator.

### 6.3 Incremental sync (steady state)

Per wallet per tick, an unchanged wallet costs 3 calls (one empty page per endpoint); a wallet with new activity costs 3–6.

| Scenario | Calls/day | Math |
|---|---|---|
| Naive: all 100 wallets every 15 min | **28,800** | 100 × 3 × 96 |
| Naive with activity (assume 20% of wallets have new pages each tick) | **34,560** | 28,800 + (0.2 × 100 × 3 × 96) |
| Plus hourly balance snapshots for 30 HIGH wallets | **+720** | 30 × 1 batched call × 24 |
| Plus daily balance snapshots for 70 NORMAL wallets | **+70** | 70 × 1 |
| **Naive total** | **≈ 35,350 calls/day (35%)** | |
| Naive at 300 wallets | **≈ 106,000 calls/day (106%)** | 300 × 3 × 96 + activity + balances |

**This is the one operation that can exhaust the daily budget.** At 100 wallets the naive schedule fits with 65% headroom; at ~280 wallets it breaks the 100k limit outright, and at ~180 wallets it leaves too little headroom for intake plus radar work on a busy day.

**Mitigation (implemented in P1-T16, P0-T07, P4-T11):**

1. **Priority-tiered cadence.** HIGH wallets every `syncCadenceMinutes` (15 min); NORMAL wallets every 4th tick (60 min); wallets with no activity in 30 days every 24 h. At 100 wallets (30 HIGH / 60 NORMAL / 10 dormant): 30 × 3 × 96 + 60 × 3 × 24 + 10 × 3 × 1 = 8,640 + 4,320 + 30 = **12,990 calls/day (13%)**. At 300 wallets with the same distribution ratios: ≈ **39,000 calls/day (39%)** — the tier policy is what makes 300 wallets viable.
2. **Budget guard with an interactive reserve.** `schedule.sync.tick` calls `budgetRemaining()` before enqueueing and stops enqueueing `BACKGROUND` work at 90,000 calls, preserving 10,000 for user-triggered intake, deep traces, and token lookups (P0-T07). Skipped ticks are reported, not silently dropped.
3. **Latest-block short-circuit.** One `getLatestBlock` call per chain per tick (not per wallet) is cached for the tick; any wallet whose cursor equals the latest block is skipped entirely with **zero** endpoint calls. On quiet chains this removes most of the 3-calls-per-wallet floor.
4. **Adaptive backoff on quiet wallets.** A wallet that returns three consecutive empty syncs has its personal cadence doubled (capped at 24 h) and reset on the first new record. This is the largest real-world saving because most watchlist wallets are idle most days.
5. **Explicit degradation.** On `DAILY_LIMIT_REACHED`, the scheduler pauses until UTC midnight and the UI shows a banner with the reset time; queued jobs remain queued rather than failing (P0-T08).

### 6.4 Radar evaluation cycle

| Component | Etherscan calls | DexScreener calls |
|---|---|---|
| Grouping, netflow, breadth, rotation (pure SQL over `MovementEvent`/`DailyFlow`) | **0** | **0** |
| Price refresh for tokens with open positions or recent activity (assume 60 tokens, batched 30/req) | 0 | **2** |
| Unrealized-PnL refresh for C3/T4 (uses the same prices) | 0 | 0 |
| **Per 5-minute cycle** | **0** | **2** |
| **Per day (288 cycles)** | **0** | **576** |

Radar and alert evaluation consume **zero history-provider quota by construction** — they read the local event store only (§10.3, §4.9). This is the key consequence of persisting USD at ingest: the 5-minute cadence in FR-5.4 does not multiply Etherscan or Robinhood-provider calls.

### 6.5 Other operations

| Operation | Etherscan | DexScreener | Note |
|---|---|---|---|
| Deep trace one branch (FR-2.7, depth 3→6) | ≈ 6–20 | 0 | 2 calls per newly expanded node; user-triggered, `INTERACTIVE` priority |
| Token lookup panel (FR-7.1) | 0–2 | 0–1 | 0 when metadata is cached; the holder call is the only extra |
| Full re-sync of one wallet (explicit, NFR-4) | ≈ 50 | ≈ 13 | Same as intake, minus already-cached token metadata |
| Alert historical backfill (FR-5.4) | **0** | 0 | Replays local events under a virtual clock |
| Graph load, wallet list, netflow, breadth | **0** | 0 | Local DB only |

### 6.6 Daily budget summary at 100 wallets

| Consumer | Etherscan calls/day | Share of 100k |
|---|---|---|
| Tiered incremental sync + balances | 12,990 | 13.0% |
| Interactive work (5 intakes, 10 deep traces, 20 lookups) | ≈ 500 | 0.5% |
| Radar + alert evaluation | 0 | 0% |
| **Total steady state** | **≈ 13,500** | **13.5%** |
| Headroom for a 100-wallet bulk import on the same day | 4,040 | 4.0% |
| **Peak day total** | **≈ 17,500** | **17.5%** |

**Flagged risks and their mitigations.** (a) *Naive uniform polling* is the only operation that can exhaust the budget — mitigated by the tiered cadence, the latest-block short-circuit, and adaptive backoff (§6.3). (b) *A single hot address* (a wallet with 100k+ transactions, e.g. a bot) can cost 300+ calls in one intake — mitigated by `maxRecords` on intake (default cap 50,000 records per endpoint) with the remainder pulled progressively by later incremental syncs, and by surfacing the truncation in the UI rather than hiding it. (c) *Accidental tracing past a CEX* would be catastrophic (millions of txs) — structurally prevented by the terminal-entity stop (FR-2.2) and asserted by P1-T09's "no adapter call for a terminal node's history" test. (d) *DexScreener* has no documented cap; the self-imposed soft limit plus 60-second price caching keeps usage under ~1,400 calls/day at 100 wallets.

### 6.7 Robinhood provider budget gate

P0-T18 must add a provider-specific appendix to `docs/decisions/0001-robinhood-data-provider.md` with: verified records/page, requests/second, daily/monthly credits or cost, pagination model, normal/internal/ERC-20 calls needed per unchanged wallet, bulk-intake estimate for 100 Robinhood wallets, and reserved interactive capacity. The acceptance gate is binary: the selected configuration must sustain 100 wallets under the §6.3 tiered cadence with **at least 25% documented headroom**, or the ADR must propose a lower supported-wallet cap and obtain explicit user approval. The scheduler exposes the cap and never silently schedules beyond it.

---

## 7. UI Inventory

Every page is desktop-first at 1440px+, dark theme by default, dense tables, times in `APP_TIMEZONE` with a block-number toggle (NFR-8, §10.8). No page performs an external API call; all external work is enqueued and observed through `JobProgress` (NFR-2). This inventory is the minimum input to each §5.0 Stitch design task, not permission to implement UI directly: approved Google Stitch artifacts remain the visual/interaction source of truth for code.

| Route | Purpose | Key components | Data dependencies (tRPC) | FRs / NFRs |
|---|---|---|---|---|
| `/` | Dashboard: breadth, market-quiet state, wallet-state census, recent alerts, active jobs, cluster ARMED banners, non-blocking backup-staleness reminder | `BreadthIndicator`, `StateCensus`, `AlertList` (compact), `JobProgress`, `ClusterArmedBanner`, `BackupReminder` | `radar.breadth`, `alert.list`, `alert.counts`, `wallet.list` (state census), `jobs.list`, `cluster.list`, `maintenance.backupInfo` | FR-4.7, FR-5.2, A5, NFR-2, NFR-6, NFR-8 |
| `/health` | DB/Redis/queue health, migration version, Etherscan + DexScreener quota, Bull Board link | `StatusCard`, `QuotaMeter` | `health.status`, `health.quota` | SRS §8 Phase 0, SRS §5, NFR-1, NFR-2 |
| `/wallets` | Searchable, filterable wallet table with bulk actions | `WalletTable`, `WalletFilters`, `BulkActionBar`, `DataTable`, `StateBadge`, `AddressChip`, `UsdCell`, `TimeCell` | `wallet.list`, `wallet.bulkAction`, `cluster.list` | FR-1.7, FR-1.6, FR-5.1, NFR-7, NFR-8 |
| `/wallets/new` | Single add + batch import (textarea / CSV paste) with per-line error report and live import progress | `WalletAddForm`, `BatchImportForm`, `ImportErrorList`, `JobProgress` | `wallet.add`, `wallet.addBatch`, `wallet.resolveEns`, `jobs.get` | FR-1.1, FR-1.2, FR-1.8, NFR-2 |
| `/wallets/[chain]/[address]` | Wallet detail: profile stats, habitual/recent heatmap toggle, tags, computed label, parking timeline, same-chain funding tree, positions, alerts, independence summary, auto-grade | `WalletHeader`, `StateBadge`, `TagEditor`, `LabelPreview`, `ActivityHeatmap`, `ParkingTimeline`, `FundingTree`, `FundingNode`, `PrimaryWalletBadge`, `DeepTraceButton`, `GradeCard`, `IndependenceVerdict`, `AlertList` (scoped), `JobProgress` | `wallet.get`, `wallet.profile`, `wallet.parking`, `funding.tree`, `funding.deepTrace`, `graph.independence`, `alert.list`, `wallet.updateTags`, `wallet.resync` | FR-1.3–1.6, FR-2.4, FR-2.5, FR-2.7, FR-2.8, FR-3.6, FR-5.1, FR-5.5, Phase 6 grading |
| `/clusters` | Cluster index: funder, members, combined stablecoin balance, recent activity, ARMED state | `ClusterTable`, `ClusterChip`, `StateBadge` | `cluster.list` | FR-2.6, A5 |
| `/clusters/[id]` | Cluster detail: funder, members, combined balance, combined activity, rotation timeline, cluster co-entry events | `ClusterHeader`, `MemberTable`, `RotationTimeline`, `ClusterCoEntryCard` | `cluster.get`, `cluster.rotation`, `radar.groups` (kind filter) | FR-2.6, FR-4.4, FR-4.6 |
| `/graph` | Full-screen interaction graph | `GraphCanvas`, `GraphFilters`, `GraphLegend`, `EdgeBreakdownPanel`, `NodeSidePanel`, `IndependenceVerdict`, `PngExportButton` | `graph.load`, `graph.edgeBreakdown`, `graph.independence`, `graph.node` | FR-3.1–3.8, NFR-7 |
| `/radar` | Movement feed + movement groups + netflow + breadth, with window and filter controls | `MovementFeed`, `MovementGroupCard`, `ClusterCoEntryCard`, `GroupEvidence`, `NetflowTable`, `BreadthIndicator`, `TokenAvatar` | `radar.feed`, `radar.groups`, `radar.netflow`, `radar.breadth` | FR-4.1–4.5, FR-4.7, FR-4.8, NFR-7 |
| `/alerts` | Alert center with filters, unread badge, acknowledge, evidence tooltips | `AlertList`, `AlertFilters`, `UnreadBadge`, `EvidenceTooltip`, `StateBadge` | `alert.list`, `alert.counts`, `alert.markRead`, `alert.markAllRead` | FR-5.1, FR-5.2, FR-5.5 |
| `/self` | Personal dashboard: win rate, total PnL, PnL by wallet/token/lag bucket, edge decay curve, comparison view, self-wallet registration | `PnlBreakdown`, `EdgeDecayChart`, `ComparisonTable`, `SelfWalletCard` | `self.dashboard`, `self.decay`, `self.comparison`, `wallet.update` (isSelf) | FR-6.1, FR-6.4–6.6 |
| `/self/trades` | Trade log: auto-linked and manual trades, thesis, followed wallet, lag data, manual entry form | `TradeLogForm`, `TradeTable`, `AddressChip` | `self.trades`, `self.addTrade`, `self.updateTrade`, `self.linkTrade` | FR-6.2, FR-6.3 |
| `/tokens` | Token lookup entry (paste address + chain) | `TokenLookupForm` | `settings.get` (default chain) | FR-7.1 |
| `/tokens/[chain]/[address]` | Token panel: tracked holders with grades/entry MCs/status, netflow history, cluster warnings, red flags, supply concentration | `HolderTable`, `TokenNetflowChart`, `RedFlagList`, `ClusterWarning`, `JobProgress` | `token.lookup`, `token.redFlags`, `token.refresh` | FR-7.1, FR-7.2 |
| `/settings` | All thresholds/configuration: A/T/C values including A2 floor, graded definition, C3 self-only toggle, de-arm, stable list, co-entry windows, cadences, min edge USD, trace depth, profit-sink ratio, provider quota reserve, entity labels, Telegram, maintenance | `ThresholdForm`, `StableListEditor`, `CadenceForm`, `EntityLabelEditor`, `TelegramForm`, `MaintenancePanel` | `settings.get`, `settings.update`, `settings.entityLabels`, `settings.upsertEntityLabel`, `alert.testTelegram`, `maintenance.prune`, `maintenance.rebuild`, `maintenance.backupInfo` | SRS §9, D-4, D-5, D-7, D-10, FR-2.1, FR-2.3–2.5, FR-3.4, FR-4.2, FR-5.3, FR-5.4, NFR-5 |
| `/jobs` | Job list with progress, retry, cancel, and failure details | `JobTable`, `JobProgress`, `JobErrorPanel` | `jobs.list`, `jobs.get`, `jobs.retry`, `jobs.cancel` | NFR-2 |
| `/api/bull-board` | Bull Board (loopback-guarded) | — | — | NFR-2 |

**Shared components used across pages:** `DataTable` (dense, virtualized, cursor-paginated), `AddressChip` (checksum display, copy, explorer link, cluster color), `UsdCell` (compact USD, `—` with reason tooltip when null), `TimeCell` (APP_TIMEZONE + block toggle), `StateBadge` (single mapping for IDLE/ARMED/TRIGGERED and cluster escalation), `TokenAvatar`, `JobProgress`, `EvidenceTooltip`, `IndependenceVerdict`.

**Empty and degraded states are mandatory, not optional:** every page defines the copy for no-data ("no wallets yet — import a CSV"), market-quiet (FR-4.7), unknown USD/market cap/token age (`—` plus the reason), insufficient sample (FR-6.4 decay), holder data unavailable (FR-7.2), truncated sync, and quota exhausted. A component that renders `0` where the underlying value is unknown is a defect.

---

## 8. Risk Register

### R1 — Funding via internal transactions is incomplete on the free tier
**Why it's hard.** FR-2.1 and §10.4 make internal transactions mandatory, because contract-mediated gas funding is invisible in the normal tx list. Etherscan and the selected Robinhood provider expose different trace identifiers and pagination, some providers report traces incompletely, and one hash can carry dozens of traces — so naive normalization both loses funders and double-counts value.
**Chosen approach.** Treat internal traces as first-class rows with `(chain, hash, INTERNAL, ordinal)` as the natural key and `traceId` retained as provenance (§3.1.3); fetch the endpoint separately with its own cursor (`SyncState.cursorsJson`); count internal funding events separately in `FundingEdge.internalEventsCount` so evidence can prove the source; and assert the behaviour with the `internal-tx-funded` fixture whose funder is reachable *only* through a trace (P1-T09).
**Fallback.** If a chain's internal-trace coverage proves unreliable, add a per-chain `internalTraceQuality` flag in the registry; on low-quality chains, supplement with a viem `eth_getBlockReceipts`-based verification pass for the specific blocks where a funding edge is suspected, and mark affected funding edges with a `coverage: PARTIAL` note in the tree UI rather than presenting a false-complete tree.

### R2 — USD attribution at ingest for young memecoins
**Why it's hard.** §10.3 forbids render-time USD, but free price sources give reliable *current* prices and poor *historical* prices exactly where this app needs them: tokens minutes to days old. Every downstream number (A1/A3/A4 thresholds, T1's $500 floor, netflow, ROI, market cap at action, PnL) inherits this error, and a silently wrong USD figure is worse than a missing one because it fires alerts.
**Chosen approach.** Derive price from the transaction's own counter-leg first — stable leg, then native leg (§4.6 rungs 1–2) — which is exact, free, and independent of any price API; fall back to DexScreener at ingest, then optional CoinGecko; and store `usdSource` + `usdConfidence` on every row so the UI and evidence tooltips can disclose provenance. Null is a first-class value: unpriced never means zero, and every threshold comparison against null fails closed (P4-T01's guard).
**Fallback.** If leg-derived pricing proves insufficient for a class of events (e.g. multi-hop swaps with no stable or native leg), add a fourth rung that prices the swap from the pool reserves at that block via a viem archive call, and if that is unavailable, keep the event with `UNKNOWN` and expose a "review unpriced events" queue in maintenance rather than guessing.

### R3 — Incremental sync idempotency and cursor correctness under the 1,000-record cap
**Why it's hard.** NFR-3 and NFR-4 demand no duplicates and resumability, while the provider caps records per request and caps page depth. Paging by number alone silently loses records on hot addresses; advancing a cursor to the highest block *seen* rather than the highest block *fully covered* permanently skips data; and a crash mid-persist must not corrupt the cursor.
**Chosen approach.** Block-window advancement with boundary-block discard and re-fetch (§4.2), a per-endpoint cursor advanced only to `coveredThroughBlock`, upserts on the four-part natural key, and cursor persistence only after the persist transaction commits. The `hot-block-2500` fixture and nine pagination tests (P0-T09) lock this behaviour in before any real data flows.
**Fallback.** If the provider's page-depth cap makes even single-block windows unreadable for an extreme address, fall back to per-block iteration for that address over the affected range, and if that exceeds the call budget, record the range as `PARTIAL` in `SyncState` and surface it in the UI — never a silently incomplete history.

### R4 — Radar evaluation over a growing event stream at a 5-minute cadence
**Why it's hard.** FR-5.4 requires a 5-minute evaluation, FR-4.2 requires pairwise-independence-constrained grouping across four configurable windows, and the event table grows without bound (NFR-5 forbids deletion). Naive re-evaluation is O(events × windows × pairs) and would either miss events or duplicate groups when a run overlaps the next.
**Chosen approach.** Incremental evaluation keyed on `radarEvaluatedAt IS NULL`; pre-computed `WalletRelation` rows so independence is a lookup rather than a computation (§4.7); grid-snapped window buckets so the same real event always lands in one bucket, making group upserts stable; greedy participant admission in time order; concurrency 1 on the radar and alert queues; and rollups (`DailyFlow`) for netflow/breadth so those never scan raw events.
**Fallback.** If a 5-minute cycle still exceeds its interval as data grows, degrade in this order: (1) evaluate only the default window incrementally and the other windows hourly; (2) partition `MovementEvent` by month; (3) raise `radarCadenceMinutes` with an explicit UI notice. Never skip events silently — the unevaluated backlog is visible on the jobs page.

### R5 — fCoSE compound layout with clusters at 300 nodes / 1,000 edges
**Why it's hard.** NFR-7 requires >30 fps pan/zoom, while FR-3.7 requires compound cluster nodes and FR-3.3 requires per-edge text labels — and edge labels plus compound parents are the two most expensive things in Cytoscape. Compound layouts also destabilize on every filter change, making the graph feel random.
**Chosen approach.** Run fCoSE once on load with `randomize: false` and cached positions; batch element updates; enable `hideEdgesOnViewport` and `textureOnViewport`; render edge labels only above a zoom threshold and only for edges above `minEdgeUsd` (FR-3.4's default $100 is also a rendering budget); keep the breakdown in a panel rather than in the graph. Measured in P2-T03 with a Playwright performance trace, not assumed.
**Fallback.** If the budget is still missed: (1) render labels for the top-N edges by USD only, with the rest on hover; (2) replace compound parents with cluster-colored hulls (visual grouping without layout cost); (3) offer a WebGL renderer or a canvas-only mode. FR-3.3's label requirement is preserved in every fallback — only *when* labels draw changes.

### R6 — Independence as the trust root of the entire radar
**Why it's hard.** §10.7 makes independence first-class, and every headline feature depends on it: co-accumulation (FR-4.2), T2, and the verdict panel (FR-3.6). A false "independent" verdict manufactures fake smart-money signals; a false "dependent" verdict suppresses real ones. Worse, the definition is subtly circular — co-entry is both an input to relatedness and the thing being detected.
**Chosen approach.** Define independence exactly as FR-4.2 states (different funders AND no direct interaction edge), implement it as stored `WalletRelation` rows with explicit kinds, and **exclude `CO_ENTRY` from the independence test while still displaying it** in FR-3.6's statement list (§0 D-6, §4.7 step 4). Terminal entities are excluded from shared-funder logic so two Binance withdrawers are not called related. Every group carries a pairwise `independenceProof` in its evidence so the user can audit the verdict (P3-T05).
**Fallback.** If real-world use shows the funder-based definition is too loose (e.g. sibling wallets funded by different hops of the same operator), add a configurable `independenceDepth` that treats wallets sharing any ancestor within N funding hops as related, defaulting to the SRS behaviour and surfacing the choice in Settings — a policy change, not a rewrite, because the relation table already stores the graph.

### R7 — History-provider quota exhaustion under continuous polling
**Why it's hard.** §6.3 shows naive uniform polling can exhaust Etherscan at larger watchlists; the Robinhood provider has a separate, P0-T18-verified limit. Exhausting either provider means stale sync and alerts for that chain while other chains may remain healthy.
**Chosen approach.** One Redis token bucket and budget guard per provider, with Etherscan shared only by Base/BSC; provider-specific priority cadences; a latest-block short-circuit; adaptive backoff on quiet wallets; and an interactive reserve of at least 10% (and 25% overall headroom at the supported Robinhood wallet cap). `/health` exposes each provider independently, so one outage does not present the whole app as current.
**Fallback.** Raise `syncCadenceMinutes` or lower the supported-wallet cap for the affected provider, then consider a higher provider tier or a separately approved self-hosted/indexer adapter. Never rotate multiple keys to evade provider terms, and never silently apply Etherscan's 100k denominator to Robinhood.

### R8 — Alert correctness: duplicates, races, and unreproducible evidence
**Why it's hard.** FR-5.1/FR-5.5 demand every alert carry reproducible evidence, and the system evaluates continuously plus backfills history — a combination that invites duplicates (same firing counted twice), races (two evaluators creating the same alert), and evidence that cannot be reproduced later because the thresholds changed in Settings.
**Chosen approach.** Rules are pure functions over an explicit `RuleContext` with an injected clock, so every firing is reproducible in a unit test; `dedupeKey` with a window bucket plus a unique constraint makes duplicate creation impossible at the database level; the alert queue runs at concurrency 1; the evidence blob **snapshots the thresholds that were in force at firing time**, so a later Settings change never rewrites history; and backfill replays in ascending daily slices under a virtual clock so historical state matches what live evaluation would have produced (P4-T07).
**Fallback.** If a rule proves too noisy in practice, the mitigation is a Settings threshold change plus an optional per-rule enable toggle — not code surgery — because the registry already keys rules by ID. If backfill and live evaluation ever disagree, the `derive.rebuild` + `alert.evaluate BACKFILL` pair regenerates alerts deterministically from the immutable event store.

---

## 9. Resolved Open Questions

The product owner resolved all ten questions on 2026-09-04. Section 0 is the binding decision surface; this section preserves the question-to-answer record so future implementers do not reopen settled scope.

**OQ-1 — Which EVM chains ship in v1?**
- **Chosen:** Base, BSC, and Robinhood Chain only. This is a fixed enum for v1; Ethereum mainnet and the former 10-chain option are not included. Default chain is Base. Robinhood provider readiness is gated by P0-T18.

**OQ-2 — Cross-chain funding and interaction edges?**
- **Chosen: (a), same-chain only.** Every asserted funding or interaction edge stays within one chain. Bridge addresses are terminal entities. Cross-chain intelligence is deferred to Backlog B-1 rather than smuggled into v1 as a heuristic.

**OQ-3 — What is "realized outflow value" for the profit-sink test?**
- **Chosen: (a).** Sum all native, internal, and ERC-20 value leaving the wallet for any address, excluding gas fees and DEX-router swap legs. A swap changes a position; it is not treated as value sent to a person. The exact zero-denominator and largest-destination behavior is frozen in §4.5.

**OQ-4 — Does A2 gas arming have an absolute floor?**
- **Chosen on product owner's delegation: (b).** Use a configurable $100 default floor and `max(floor, 3× wallet median)`. When the wallet median is unavailable, use the floor alone. Do not use a pooled global median. Rationale and external monitoring guidance are recorded under D-4.

**OQ-5 — What makes a wallet "graded"?**
- **Chosen: (a).** By default, any manual `edge`, `style`, or `size` tag, or a computed auto-grade with sufficient sample. Settings exposes `gradedDefinition`, allowing a later switch to manual edge-tag-only without code changes.

**OQ-6 — Is CO_ENTRY part of the independence test?**
- **Chosen: (a).** Show co-entry in the FR-3.6 relationship statement list but exclude it from the FR-4.2 independence predicate. Including it would make the detection cancel itself.

**OQ-7 — Whose position does C3 monitor?**
- **Chosen: (a).** Evaluate all tracked wallets and visually prioritize `isSelf` findings. `c3SelfOnly` defaults to false and can restrict evaluation later.

**OQ-8 — How is the activity heatmap bucketed?**
- **Chosen: (c), both modes.** Provide a toggle between full-history hour-of-day × weekday and rolling seven-day × 24-hour views. Compute both from the same query/pass and persist their timezone/window metadata.

**OQ-9 — What is "combined % of token supply"?**
- **Chosen: (a).** Token units bought in the detection window ÷ total supply, persisted with the group and null when supply is unknown. Current combined holdings remain a separate live concentration metric on token lookup.

**OQ-10 — Should backups be scheduled?**
- **Chosen: (a) + (c).** Backups are manual, with an automatic pre-migration backup and a non-blocking dashboard reminder when the newest successful backup is absent or older than 7 days. No recurring backup schedule and no automatic retention deletion.

No product open question remains from this set. Provider facts discovered by P0-T18 are an implementation gate and ADR, not permission to change D-1 without the product owner's approval.

---

## 10. Backlog

### B-1 — Cross-chain funding and interaction intelligence (post-MVP)

- **Status:** Deferred; explicitly out of v1 scope. Same-chain behavior in D-2 must ship and stabilize first.
- **User value:** Continue an evidence trail when a watched wallet funds or interacts across a known bridge, without falsely presenting amount/time coincidence as proof of common control.
- **Recommended first slice:** Add a non-assertive "possible bridge continuation" hint that shows the terminal bridge deposit and candidate destination-chain withdrawals with amount, asset, time delta, fees, provider coverage, and confidence. Keep it out of funding edges, clusters, and the independence predicate until validated.
- **Later slice:** Promote a candidate into a cross-chain evidence edge only after an evaluation corpus measures precision/recall by bridge and route. Require bridge contract/route registry, canonical message or transfer IDs where available, chain finality/reorg handling, token decimal/fee normalization, clock/window rules, idempotent dedupe, and a visible explanation of why the match exists.
- **Do not do:** Do not equate same amount + nearby timestamp with identity, merge wallet clusters automatically, or let speculative links suppress an independence/co-entry alert.
- **Definition of ready:** Same-chain v1 has production-like fixture coverage; at least two target bridge protocols and destination chains are named; provider APIs expose required bridge evidence; a labeled positive/negative evaluation set exists; acceptable false-positive ceiling and confidence thresholds are approved by the user; security and quality reviewers approve the design.
- **Schema posture:** Existing chain-qualified wallet/funding keys remain. Any future cross-chain evidence model must be additive and distinguish `ASSERTED_ONCHAIN` from `HEURISTIC_CANDIDATE`; it must not overload v1's same-chain `InteractionEdge` semantics.

---

## Appendix A — Requirement Traceability Matrix

Every SRS requirement maps to at least one task. This table is the coverage proof; a requirement with no task ID is a plan defect.

### A.1 Functional requirements

| FR | Requirement (abbreviated) | Tasks |
|---|---|---|
| FR-1.1 | Add single wallet; batch import textarea/CSV; raw-address paste with default chain | P1-T01, P1-T03 |
| FR-1.2 | ENS resolution on input, address stays primary key | P1-T02 |
| FR-1.3 | Auto intake pipeline as a background job, ending at the profile page | P1-T04, P1-T15 |
| FR-1.4 | Profile stats: first tx, age at first memecoin trade, tx count, token diversity, stable balance, 24×7 heatmap, dormant-since | P1-T06, P1-T07, P1-T17 |
| FR-1.5 | Manual tags: edge, style, size, label, notes, flags (blacklist, watch-priority, is-self) | P1-T13 |
| FR-1.6 | Computed label `{EDGE}-{STYLE} [{SIZE}]` | P1-T13 |
| FR-1.7 | Wallet list: search, filters, bulk actions | P1-T14 |
| FR-1.8 | Dedupe on import; re-import triggers incremental re-sync | P1-T01, P1-T03 |
| FR-2.1 | Funding tree: native + **internal** inbound, depth default 3 / max 6 | P1-T09 |
| FR-2.2 | Terminal entity stop, never trace past it | P1-T09, P1-T17 |
| FR-2.3 | Bundled entity dataset + user-managed labels (entity/terminal/human) | P0-T06, P1-T17, P4-T11 |
| FR-2.4 | Primary-wallet detection, both conditions, two candidate labels, warning badge | P1-T10, P1-T17 |
| FR-2.5 | Stablecoin parking: per-chain balances + in/out timeline | P1-T07, P1-T08 |
| FR-2.6 | Shared-funder auto-clustering, color coding, cluster page | P1-T12, P3-T10 |
| FR-2.7 | Deep trace mode per node until terminal / dead end / depth 6 | P1-T11, P1-T17 |
| FR-2.8 | Funding tree visualization with address, label, USD, count, first/last | P1-T17 |
| FR-3.1 | Full-screen graph, tracked nodes, toggleable secondary nodes | P2-T02, P2-T03 |
| FR-3.2 | Edge exists on any direct transfer, aggregated per pair | P2-T01 |
| FR-3.3 | Directional arrows, `TICKER · $USD` labels, breakdown panel with tx links | P2-T01, P2-T04 |
| FR-3.4 | Edge filters: min USD (default $100), token, direction, time range | P2-T02 |
| FR-3.5 | Node size (tag or balance), border = alert state, fill = cluster | P2-T05, P4-T10 |
| FR-3.6 | Independence verdict panel with explicit statements or INDEPENDENT line | P2-T06 |
| FR-3.7 | fCoSE layout, compound clusters, pan/zoom/drag/fit, PNG export | P2-T03, P2-T07 |
| FR-3.8 | Node click → side panel with stats, state, balance, detail link | P2-T07 |
| FR-4.1 | Movement feed with all row fields incl. market cap and token age at action | P3-T02, P3-T04 |
| FR-4.2 | Co-accumulation: ≥N mutually independent wallets, configurable windows, group card | P3-T05, P3-T07 |
| FR-4.3 | Co-distribution: same logic for sells / CEX deposits | P3-T05, P3-T07 |
| FR-4.4 | Cluster co-entry as a distinct warning-styled event, not mixed in | P3-T06 |
| FR-4.5 | Netflow table per token, 24h/7d/30d, sortable, top gainers/losers | P3-T08 |
| FR-4.6 | Cluster rotation view with the summary sentence | P3-T10 |
| FR-4.7 | Breadth indicator with explicit market-quiet state | P3-T09 |
| FR-4.8 | Every detection links back to raw events (tx hash + explorer URL) | P2-T04, P3-T04, P3-T07, P4-T09 |
| FR-5.1 | Alert records with type, wallet, token, amounts, timestamp, tx links, cluster, evidence | P4-T01, P4-T03–T07 |
| FR-5.2 | Alert center: filters, unread badge, acknowledge | P4-T08 |
| FR-5.3 | Optional Telegram delivery, off by default | P4-T12 |
| FR-5.4 | 5-minute configurable evaluation; one-time historical backfill after first full sync | P3-T11, P4-T07 |
| FR-5.5 | "Why" tooltip with the exact rule, thresholds, and numbers | P4-T09, P4-T01 |
| FR-6.1 | Register own wallets with `is-self`, same pipeline | P5-T01 |
| FR-6.2 | Auto-link trades to the nearest graded-wallet signal with lag metrics | P5-T02 |
| FR-6.3 | Manual trade log with required thesis, optional followed wallet | P5-T03 |
| FR-6.4 | Edge decay curve: ROI by lag bucket, table + chart | P5-T04 |
| FR-6.5 | Personal dashboard: win rate, PnL by wallet/token/lag | P5-T05 |
| FR-6.6 | Comparison view: user ROI vs followed wallet ROI per linked trade | P5-T06 |
| FR-7.1 | Token lookup panel: holders, netflow, cluster warnings, red flags, concentration | P6-T03 |
| FR-7.2 | Token red flags: deployer→wallet transfers, top-10 holder share, token age | P6-T02, P6-T03 |

### A.2 Alert rules (SRS Module 5)

| Rule | Task | Rule | Task |
|---|---|---|---|
| A1 Stablecoin arming | P4-T03 | T3 Fresh-launch entry | P4-T05 |
| A2 Gas arming | P4-T03 | T4 Add-on-retrace | P4-T05 |
| A3 CEX withdrawal | P4-T03 | T5 Cluster co-entry | P4-T05 |
| A4 Dormancy wake | P4-T03 | C1 Distribution prep | P4-T06 |
| A5 Cluster arming (escalated) | P4-T04 | C2 Co-distribution | P4-T06 |
| A6 Consolidation | P4-T04 | C3 Moon discipline | P4-T06 |
| T1 Armed entry | P4-T05 | C4 Campaign spent | P4-T06 |
| T2 Independent co-entry | P4-T05 | De-arm conditions | P4-T06 |

### A.3 Non-functional requirements

| NFR | Requirement | Tasks |
|---|---|---|
| NFR-1 | Local-only, localhost binding, no telemetry, keys in `.env` | P0-T02, P0-T03, P0-T13 |
| NFR-2 | Async everything, BullMQ progress in UI, Bull Board, 100-wallet import non-blocking | P0-T13, P1-T03, P1-T15, P6-T04 |
| NFR-3 | Idempotent ingestion, upsert by natural key | P1-T04, P0-T09, P4-T07 |
| NFR-4 | Incremental sync per wallet+chain; full re-sync explicit | P1-T16, P0-T09 |
| NFR-5 | Never auto-delete; manual prune utility | P6-T04, §3.4 |
| NFR-6 | `npm run backup` → `pg_dump` to `./backups/` timestamped; pre-migration backup; stale reminder | P0-T16, P6-T04 |
| NFR-7 | Wallet list <500 ms; 300-node graph >30 fps; feed pages of 50 | P1-T14, P2-T03, P3-T04, P3-T08 |
| NFR-8 | Dark theme, desktop-first, dense tables, local timezone + block toggle, Stitch approval | P0-D01–P6-D01, P0-T15, P1-T14 |
| NFR-9 | All chain logic behind `ChainAdapter` | P0-T10, P0-T11, P0-T18 |

### A.4 SRS §10 notes for the implementing agent

| Note | Requirement | Where enforced |
|---|---|---|
| §10.1 | Build phases in order; intake pipeline before graph/radar | §5 task dependencies; Phase 1 gates Phases 2–6 |
| §10.2 | Never fetch on the UI thread; progress visible | P0-T13, P1-T15; §7 states no page performs an external call |
| §10.3 | Persist USD at ingest (`PriceSnapshot`) | §3.1.4, §4.6, P1-T05, P3-T02 |
| §10.4 | Internal transactions mandatory for funding traces | §4.4, P1-T04, P1-T09, R1 |
| §10.5 | Respect the 1,000-record cap; paginate; cache; incremental re-sync | §4.2, P0-T08, P0-T09, P1-T16, §6 |
| §10.6 | Alerts must show evidence (rule + numbers + tx links) | §4.8, P4-T01, P4-T09 |
| §10.7 | Independence is a first-class computation | §4.7, P2-T06, P3-T05, R6 |
| §10.8 | Timestamps stored UTC, rendered in `APP_TIMEZONE` | §3.2 header, P0-T15, P1-T06 |
| §10.9 | Keep the `ChainAdapter` boundary clean from day one | §4.1, P0-T10, P0-T18 (contract/boundary tests), Phase 7 note |

### A.5 SRS §8 phase acceptance criteria

| Phase | Criterion | Task that proves it |
|---|---|---|
| 0 | `docker compose up` boots app + DB + Redis | P0-T02 |
| 0 | Health page shows usage/quota state for every enabled provider | P0-T15 |
| 0 | Robinhood Chain adapter passes the shared read-only contract | P0-T18 |
| 1 | Import 10 wallets via CSV → profiles with stats + funding tree | P1-T18 |
| 1 | Known CEX funder displays as terminal entity | P1-T18, P1-T09 |
| 1 | Shared funders auto-create clusters | P1-T18, P1-T12 |
| 1 | Deep-trace button extends a branch | P1-T18, P1-T11 |
| 2 | Import set renders bubble map | P2-T08 |
| 2 | Edges labeled `TICKER · $USD` with breakdown on click | P2-T08, P2-T04 |
| 2 | Independence verdict panel populated | P2-T08, P2-T06 |
| 2 | Graph exports PNG | P2-T08, P2-T07 |
| 3 | Movement feed streams live actions | P3-T12, P3-T04 |
| 3 | Two-wallet same-token buy within 24h → co-accumulation card | P3-T12, P3-T05 |
| 3 | Netflow table and breadth indicator populated | P3-T12, P3-T08, P3-T09 |
| 4 | Historical backfill of alerts after first sync | P4-T13, P4-T07 |
| 4 | Test wallet stablecoin inflow trips A1 with evidence tooltip | P4-T13, P4-T03, P4-T09 |
| 4 | State badges render on list, graph, and detail | P4-T13, P4-T10 |
| 5 | Register self wallet → auto-linked trades with lag data | P5-T07, P5-T02 |
| 5 | Edge decay curve renders with ≥ 5 linked trades | P5-T07, P5-T04 |
| 6 | Paste a token → holders/netflow/red-flag panel in < 3 s from local DB | P6-T05, P6-T03 |
| 6 | Auto-grade (WR, realized PnL, entry-timing ratio) on the wallet profile | P6-T01, P6-T05 |
| 8 | Clean-machine setup reaches a healthy app using only checked-in docs | P8-T05, P8-T08 |
| 8 | New user completes the MVP walkthrough and understands alert evidence | P8-T06, P8-T08 |
| 8 | Backup/restore rehearsal reproduces seeded row counts | P8-T07, P8-T08 |
| 8 | Documentation links, diagrams, commands, coverage, and secret scan pass | P8-T08 |

### A.6 Non-goals guard (SRS §1)

No task in this plan implements social/narrative/meta detection, copy-trading execution, transaction signing, private-key handling, multi-user auth, deployment or cloud targets, telemetry, a mobile app, or Solana support. Any task that appears to require one of these is a spec conflict and must be escalated, not implemented.

### A.7 Documentation deliverables

| Requested documentation | Canonical artifact | Tasks |
|---|---|---|
| Project overview, objective, audience, scope, non-goals, key features, glossary | `README.md`, `docs/overview.md` | P8-T02 |
| Architecture, data flow, providers, queues, storage, boundaries, diagrams | `docs/architecture.md`, `docs/diagrams/**` | P8-T03 |
| Key decisions and business logic with formulas/examples | `docs/business-logic.md`, `docs/decisions/**` | P8-T04 |
| Prerequisites, configuration, how to run, verify, stop, update | `docs/getting-started.md`, `docs/configuration.md` | P8-T05 |
| Complete end-user walkthrough with current UI captures | `docs/user-guide.md`, `docs/assets/walkthrough/**` | P8-T06 |
| Maintenance, backup/restore, migrations, provider outages, troubleshooting | `docs/operations.md`, `docs/troubleshooting.md`, `docs/runbooks/**` | P8-T07 |
| Coverage map, automated docs checks, clean-room verification evidence | `docs/documentation-map.md`, `docs/documentation-coverage.md`, `docs/verification-report.md` | P8-T01, P8-T08 |

### A.8 Task count summary

| Phase | Tasks | ID range |
|---|---|---|
| Phase 0 — Scaffold | 19 | P0-D01; P0-T01 … P0-T18 |
| Phase 1 — Registry & Funding Tracer | 19 | P1-D01; P1-T01 … P1-T18 |
| Phase 2 — Interaction Graph | 9 | P2-D01; P2-T01 … P2-T08 |
| Phase 3 — Narrative Radar | 13 | P3-D01; P3-T01 … P3-T12 |
| Phase 4 — Alert Engine | 14 | P4-D01; P4-T01 … P4-T13 |
| Phase 5 — Self-Tracking | 8 | P5-D01; P5-T01 … P5-T07 |
| Phase 6 — Token Lookup & Grading | 6 | P6-D01; P6-T01 … P6-T05 |
| Phase 7 — Solana (optional) | 0 (not decomposed; SRS §1 non-goal for v1) | — |
| Phase 8 — Documentation & Walkthrough | 8 | P8-T01 … P8-T08 |
| **Total** | **96** | |
