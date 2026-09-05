# Software Requirements Specification — "Watchtower"

**Personal Onchain Wallet Intelligence & Smart Money Radar**
Local-first, single-user web application for EVM memecoin trading intelligence.

Version: 1.0 · Status: Approved for build · Audience: implementing AI agent / developer

---

## 1. Purpose & Context

This document is the complete build specification for a local-only web application owned and operated by a single user (a memecoin trader). The user maintains a **personal, hard-won watchlist of wallets** discovered through manual research. The app's job is to turn that watchlist into a live intelligence system:

1. **Profile & organize** every wallet the user adds (funding source, cluster membership, custom grading).
2. **Detect early onchain movement** by watchlist wallets — especially *fund preparation* before coordinated buying — earlier than the user could catch manually.
3. **Surface co-accumulation / co-distribution patterns** across the watchlist with strict time windows, described factually (no narrative naming — narrative judgment is the user's job).
4. **Measure the user's own trades** against the watchlist wallets they follow ("did I ride the edge, and how much lag killed it?").

The app runs entirely on the user's local machine. It is never deployed. It MAY call external public APIs (block explorers, price feeds) as sources of truth.

### Non-Goals (do NOT build)

- No social media / narrative / meta detection of any kind.
- No copy-trading execution, no transaction signing, no wallet private key handling. Read-only analytics.
- No multi-user auth. Single local user.
- No deployment targets, no cloud hosting, no telemetry.
- No mobile apps. Desktop-first web UI.
- Solana support is out of scope for v1 (EVM chains first; architecture must not block adding Solana later).

---

## 2. System Architecture (High Level)

A single local monolith with background workers:

```
┌────────────────────────────────────────────────────────┐
│  Next.js App (localhost:3000)                          │
│  UI (React 19) ── tRPC ─── Server (route handlers)    │
└───────────────┬────────────────────────────────────────┘
                │ Prisma
        ┌───────▼────────┐        ┌───────────────┐
        │ PostgreSQL 18  │◄──────►│ Redis 8       │
        │ (source of     │        │ (queue + cache)│
        │  local truth)  │        └───────┬───────┘
        └────────────────┘                │
                                          │ BullMQ workers
                          ┌───────────────▼────────────────┐
                          │ Ingestion workers              │
                          │ • Etherscan V2 fetch (rate-    │
                          │   limited, paginated)          │
                          │ • Funding-tree builder         │
                          │ • Price snapshot enricher      │
                          │ • Radar evaluation engine      │
                          │ • Polling scheduler (cron)     │
                          └───────────────┬────────────────┘
                                          │ HTTPS (outbound only)
                          ┌───────────────▼────────────────┐
                          │ External sources of truth      │
                          │ Etherscan V2 · DexScreener     │
                          └────────────────────────────────┘
```

All API keys live in `.env`. All long-running work (batch import, history backfill, radar evaluation) runs as BullMQ jobs with visible progress in the UI.

---

## 3. Functional Requirements

Requirement IDs are stable and referenced by the implementation plan.

### Module 1 — Wallet Registry & Watchlist

- **FR-1.1** Add a single wallet by `address + chain`, or batch import via textarea / CSV (one `address,chain,label?` per line). Support pasting raw addresses (auto-detect chain by user-selected default).
- **FR-1.2** ENS resolution on input (best-effort; store resolved name, keep address as primary key).
- **FR-1.3** On add, the system auto-runs an **intake pipeline** (background job): fetch full tx history (normal + internal + ERC-20 transfers), compute profile stats, build funding tree (Module 2), detect cluster membership, then display a wallet profile page.
- **FR-1.4** Wallet profile stats: first tx date, wallet age at first memecoin trade, total tx count, token diversity (distinct tokens traded), stablecoin balance (current), activity heatmap (24h × 7d grid of tx counts), dormant-since date.
- **FR-1.5** Manual tagging per wallet, persisted and editable:
  - `edge`: Smart | Insider | Early | Bot | KOL | Degen | Fresh | Dev
  - `style`: Sniper | Jeet | Rider | Swing | Diamond
  - `size`: W | M | S
  - `label`: free-text display label (e.g. "Whale that diamond-hands runners")
  - `notes`: free text
  - `flags`: blacklist, watch-priority (high/normal), is-self (marks the user's own wallet)
- **FR-1.6** Computed label preview: display final label as `{EDGE}-{STYLE} [{SIZE}]` derived from the manual tags.
- **FR-1.7** Wallet list page: searchable, filterable table (by tag, chain, cluster, stablecoin balance, last activity, alert state). Bulk actions: re-sync, delete, add to priority watch.
- **FR-1.8** Dedupe on import; re-importing an existing wallet triggers a re-sync (incremental), never a duplicate.

### Module 2 — Funding Source Tracer

The core "trace until the source is exhausted" feature.

- **FR-2.1** For each tracked wallet, build a **funding tree**: walk incoming native transfers AND internal transactions (contract-sent value) recursively, up to configurable depth (default 3, max 6). Internal transactions MUST be included — many gas fundings happen via router/contract calls invisible in normal tx lists.
- **FR-2.2** **Terminal entity stop:** if a funder address matches a known entity label (CEX hot wallet, bridge, router, DEX), stop recursion there and label the node as that entity (e.g. "Binance 14"). Never trace past terminal entities.
- **FR-2.3** Entity label source: bundled open dataset of known CEX/bridge addresses (seeded at install, stored in DB) + user-managed labels (user can label any address as entity/terminal, or as human "operator").
- **FR-2.4** **Primary wallet detection.** A funder is marked `primary wallet` when BOTH:
  - it has funded the tracked wallet ≥ 2 times (repeated funder), OR it funded the tracked wallet's first-ever gas AND ≥ 1 later funding; AND
  - it is a **profit sink**: it received back ≥ 20% (configurable) of the tracked wallet's realized outflow value, or it is the single largest destination of the tracked wallet's outgoing value.
  If only the first condition holds: label `repeated funder (candidate primary)`. If only the second: label `profit sink (candidate primary)`. Both → `PRIMARY WALLET` with a warning badge in the UI.
- **FR-2.5** **Stablecoin parking detection.** Flag every inflow/outflow of USDT, USDC, USDG (configurable stable list) per wallet and per chain. Display: current parked stablecoin balance per chain, and a timeline of parking events (in/out). This powers the ARMED state (Module 5).
- **FR-2.6** **Shared-funder auto-clustering.** If ≥ 2 tracked wallets share any non-terminal funder in their funding trees, create a Cluster entity; color-code cluster members everywhere in the UI (list + graph). Cluster page shows: funder address, members, combined stablecoin balance, combined recent activity.
- **FR-2.7** **Deep trace mode ("trace until stuck"):** user-actionable button on any funding-tree node to extend recursion beyond default depth for that branch, until a terminal entity, a dead end, or depth 6 is reached.
- **FR-2.8** Funding tree visualization: interactive collapsible tree on the wallet detail page; nodes show address (truncated + label if any), cumulative USD funded, funding count, and first/last funding date.

### Module 3 — Interaction Graph (Bubble Map)

- **FR-3.1** Dedicated full-screen graph page. Nodes = tracked wallets. Optional secondary nodes (toggleable): funders, cluster-mates, primary wallets.
- **FR-3.2** An edge exists between two tracked wallets if any direct token transfer or native transfer occurred between them in either direction. Edges are **aggregated per wallet-pair** (not per tx).
- **FR-3.3** Edge rendering: line with directional arrow; **label shows ticker + aggregate USD amount** (e.g. `PEPE · $12.4K`). Hover/click opens a breakdown panel: per-token list with tx count, total amount, first/last date, tx links.
- **FR-3.4** Edge filters: min USD threshold (default $100), token selector, direction, time range slider. Filters re-layout the graph live.
- **FR-3.5** Node rendering: size scales with wallet `size` tag or current stablecoin balance (toggle); border color = alert state (Module 5); fill color = cluster.
- **FR-3.6** **Independence verdict panel:** for each tracked wallet, an explicit statement list: "Connected to X via shared funder · Connected to Y via direct transfers (23 txs, $45K) · Connected to Z via co-entry (5 tokens within 24h)" or "INDEPENDENT — no funding, transfer, or co-entry relationship with any other tracked wallet."
- **FR-3.7** Layout: force-directed (fCoSE), with compound nodes grouping clusters. Support pan/zoom, node drag, fit-to-screen, and export graph as PNG.
- **FR-3.8** Click a node → side panel with the wallet's key stats, alert state, stablecoin balance, and link to wallet detail page.

### Module 4 — Narrative Radar (Onchain Movement Detection)

Onchain-only. The system describes movements; the human names the narrative.

- **FR-4.1** **Movement feed:** chronological, real-time list of meaningful watchlist actions: buy, sell, stablecoin park, stablecoin spend, CEX deposit/withdrawal, new token entry. Each row: timestamp, wallet (with tags + cluster color), action, token (ticker + symbol avatar), amount USD, market cap at action, token age at action, tx link.
- **FR-4.2** **Co-accumulation detection:** group events where ≥ N (default 2) **mutually independent** tracked wallets buy the same token within a time window (configurable windows: 1h / 6h / 24h / 48h; default 24h). Independence = different funders AND no direct interaction edge between them. Produce a "movement group" card: token, participating wallets (with grades), time span, combined USD bought, combined % of token supply.
- **FR-4.3** **Co-distribution detection:** same logic for sells / CEX deposits of the same token.
- **FR-4.4** **Cluster co-entry detection:** ≥ 2 wallets of the SAME cluster entering the same token within 1h. Displayed as a **distinct, warning-styled event** (coordination/insider signal — one actor pretending to be many), not mixed into the co-accumulation feed.
- **FR-4.5** **Netflow table:** per token, aggregated net USD flow (buys − sells − CEX deposits) of all tracked wallets, over selectable timeframes (24h / 7d / 30d). Sortable. Top gainers/losers of flow.
- **FR-4.6** **Cluster rotation view:** for each cluster, a timeline showing exits from token set A and entries into token set B within a 7-day window, summarized as "Cluster X rotated: exited [tickers] → entered [tickers]".
- **FR-4.7** **Breadth indicator:** dashboard stat = % of priority-watch wallets with ≥ 1 action in the last 24h/7d. Displays "market quiet" state explicitly.
- **FR-4.8** All radar detections must link back to raw events (tx hash + explorer URL). No black-box conclusions without evidence.

### Module 5 — Alert Engine & Wallet State Machine

Each priority-watch wallet has an alert state: `IDLE → ARMED → TRIGGERED`, plus exit-risk annotations. All thresholds below are defaults and configurable in Settings.

**ARMED triggers (funds are being prepared):**

- **A1 — Stablecoin arming:** wallet receives stablecoin inflow ≥ max($1,000, 3× its median historical single-day inflow) within 24h.
- **A2 — Gas arming:** native chain asset inflow ≥ 3× median single-day inflow within 24h.
- **A3 — CEX withdrawal:** funds received from a labeled CEX entity ≥ $1,000.
- **A4 — Dormancy wake:** wallet inactive ≥ 30 days receives any funding ≥ $500.
- **A5 — Cluster arming (escalated):** one funder funds ≥ 2 wallets of the same cluster within 48h → cluster-level ARMED badge (highest priority visual treatment).
- **A6 — Consolidation:** wallet receives sweeps from ≥ 2 other addresses it has funded before (operator gathering ammunition).

**TRIGGERED triggers (armed money is moving into assets):**

- **T1 — Armed entry:** an ARMED wallet buys any token with age < 7 days, position ≥ $500.
- **T2 — Independent co-entry:** ≥ 2 mutually independent graded wallets buy the same token within 24h (cross-referenced with FR-4.2).
- **T3 — Fresh-launch entry:** graded wallet buys a token < 1h old.
- **T4 — Add-on-retrace:** wallet holding a position adds after a ≥ 20% drawdown from the token's local high (accumulation behavior).
- **T5 — Cluster co-entry:** ≥ 2 same-cluster wallets enter the same token within 1h (warning-styled; see FR-4.4).

**Exit-risk annotations (position management, not wallet states):**

- **C1 — Distribution prep:** graded wallet deposits a memecoin token to a CEX.
- **C2 — Co-distribution:** ≥ 2 graded wallets exit the same token within 12h.
- **C3 — Moon discipline:** tracked wallet's position > 10x unrealized and older than 3 days (take-profit discipline reminder for the user's own position).
- **C4 — Campaign spent:** wallet's stablecoin balance drops > 70% from its recent peak within 48h after a TRIGGERED event.

**De-arm conditions:** stablecoin/native balance returns to ≤ 120% of 30-day baseline for 7 consecutive days, or funds return to a terminal entity.

- **FR-5.1** All events (A1–C4) produce Alert records: type, wallet, token (if any), amounts, timestamp, tx links, cluster context, and the evidence trail (which balances/inflows tripped it).
- **FR-5.2** Alert center page: filter by type/state/token/wallet; unread badge; acknowledge/mark-read.
- **FR-5.3** Optional Telegram delivery (off by default): user supplies a bot token + chat ID in Settings; alerts forwarded as formatted messages. Purely optional local convenience.
- **FR-5.4** Evaluation cadence: radar evaluation job runs every 5 minutes (configurable) over newly ingested events; historical backfill evaluation runs once after any wallet's first full sync.
- **FR-5.5** Every alert carries a "why" tooltip rendering the exact rule and thresholds that fired, with the underlying numbers.

### Module 6 — Self-Tracking (Edge Rider)

- **FR-6.1** The user registers their own wallet(s) with the `is-self` flag. Their trades are ingested through the same pipeline.
- **FR-6.2** Auto-link each user trade to the most relevant watchlist signal: same token, nearest-in-time watchlist entry by a graded wallet. Store: `followed_wallet`, `lag_minutes` (user entry − wallet entry), `lag_mc_delta` (MC at user entry − MC at wallet entry), `wallet_roi`, `user_roi`.
- **FR-6.3** Manual trade log: user can add trades manually with a required `thesis` free-text field ("what narrative I judged") and optional `followed_wallet`.
- **FR-6.4** **Edge decay curve:** per followed wallet, a chart of the user's average ROI bucketed by entry lag (0–1h, 1–6h, 6–24h, >24h). Table + line chart.
- **FR-6.5** Personal dashboard: win rate, total PnL, PnL by followed wallet, PnL by token, PnL by lag bucket. Answers: "when I follow within 1h do I actually win?"
- **FR-6.6** Comparison view: user ROI vs followed wallet ROI per linked trade (did I capture the edge or arrive after it decayed?).

### Module 7 — Token Lookup Panel (Phase 6)

- **FR-7.1** Paste any token address + chain → panel shows: tracked-wallet holders (with grades, entry MCs, current status holding/distributed), netflow history of tracked wallets on this token, cluster presence warnings, red flags (any tracked wallet that received this token directly from its deployer address = paid-promoter warning; supply concentration among tracked wallets).
- **FR-7.2** Token red-flag checks (auto): deployer → wallet transfers, % supply held by top 10 holders (from explorer data), token age.

---

## 4. Data Model (Prisma entities)

```
Wallet            { address, chain, ensName?, label?, edge?, style?, size?,
                    notes?, isBlacklisted, isSelf, watchPriority, firstTxAt,
                    createdAt, updatedAt }          // PK: (address, chain)
EntityLabel       { address, chain, kind: CEX|BRIDGE|ROUTER|CONTRACT|HUMAN,
                    name, source: BUNDLED|USER }
Transaction       { hash, chain, blockNumber, timestamp, fromAddress,
                    toAddress, tokenAddress?, kind: NATIVE|ERC20|INTERNAL,
                    amountRaw, amountUsd?, txType: TRANSFER|SWAP|DEPLOY }
Token             { address, chain, symbol, name, deployedAt?,
                    pairCreatedAt?, firstSeenAt }
PriceSnapshot     { tokenAddress, chain, timestamp, priceUsd, marketCap?,
                    liquidityUsd? }
FundingEdge       { childAddress, childChain, parentAddress, parentChain,
                    totalUsd, eventsCount, firstAt, lastAt,
                    kind: INITIAL|REPEATED|PROFIT_SINK|PRIMARY }
Cluster           { id, name, funderAddress, createdAt }
ClusterMember     { clusterId, walletAddress, walletChain }
AlertEvent        { id, walletAddress, walletChain, type: A1..C4,
                    state: ARMED|TRIGGERED|EXIT_RISK, payloadJson,
                    evidenceJson, createdAt, readAt? }
MovementGroup     { id, tokenAddress, chain, kind: CO_ACCUMULATION|
                    CO_DISTRIBUTION|CLUSTER_CO_ENTRY, windowStart, windowEnd,
                    combinedUsd, walletCount }
UserTrade         { id, ownWalletAddress, ownChain, tokenAddress, tokenChain,
                    side, amountUsd, entryAt, exitAt?, roiPct?,
                    followedWalletAddress?, lagMinutes?, lagMcDelta?,
                    thesis?, source: AUTO|MANUAL }
SyncState         { walletAddress, chain, lastSyncedBlock, lastSyncedAt,
                    status, lastError? }
Setting           { key, valueJson }
```

Indexes: `Transaction(fromAddress, timestamp)`, `Transaction(toAddress, timestamp)`, `Transaction(tokenAddress, timestamp)`, `AlertEvent(createdAt)`, `MovementGroup(tokenAddress, windowStart)`.

---

## 5. External Services (Source of Truth)

| Service | Use | Notes & Constraints |
|---|---|---|
| **Etherscan API V2** | Normal txs, internal txs, ERC-20 transfers, contract deploy detection — all chains via one key | Free tier: ~5 calls/sec, 100k/day, shared across chains; **max 1,000 records per request since July 2026** → all fetches MUST paginate by page/offset and go through a global token-bucket rate limiter. Cache aggressively; incremental sync by block number. |
| **DexScreener API** | Token price, market cap, liquidity at time of action; pair discovery | Free, no key. Snapshot price at ingest time and persist (PriceSnapshot); never compute USD at render time. |
| **CoinGecko API** (optional) | Historical prices for tokens without DexScreener coverage | Free tier; best-effort only. |
| **Bundled entity dataset** | CEX / bridge / router address labels | Seed from open-source address-tag lists at install; user-extensible via UI. |
| **Helius API** (Phase 7, optional) | Solana: funded-by endpoint + tx history | Only if the user later enables Solana. Keep chain adapters abstracted behind an interface. |

All external calls: server-side only, with per-provider rate limiter, exponential backoff (jittered), retry budget, and job-level failure reporting surfaced in the UI.

---

## 6. Non-Functional Requirements

- **NFR-1 Local-only:** app binds to localhost; no outbound telemetry; keys only in `.env`.
- **NFR-2 Async everything:** any operation touching external APIs runs as a BullMQ job with progress % in UI (Bull Board mounted at a protected local route). Batch import of 100 wallets must never block the UI.
- **NFR-3 Idempotent ingestion:** re-running a sync produces no duplicate transactions (upsert by natural key).
- **NFR-4 Incremental sync:** per wallet + chain, resume from last synced block; full re-sync is an explicit user action.
- **NFR-5 Data retention:** never auto-delete. Manual "prune token history" utility allowed.
- **NFR-6 Backup:** `npm run backup` → `pg_dump` to `./backups/` with timestamped filename.
- **NFR-7 Performance targets:** wallet list < 500ms; graph with 300 nodes + 1,000 edges interactive (>30fps pan/zoom); movement feed pagination at 50 rows.
- **NFR-8 UI:** dark theme default (trading aesthetic), desktop-first (1440px+), dense data tables, all times in user's local timezone with a chain-block display toggle.
- **NFR-9 Chain abstraction:** all chain-specific logic behind a `ChainAdapter` interface (`getTransactions`, `getInternalTxs`, `getTokenTransfers`, `getTokenInfo`) so Solana can be added later without rework.

---

## 7. Tech Stack (pinned, latest stable as of Sept 2026)

| Layer | Choice | Version & Rationale |
|---|---|---|
| Runtime | **Node.js 24 LTS "Krypton"** | Current Active LTS line (24.20.x). Node 26 not LTS until Oct 2026. |
| Framework | **Next.js 16.3 (App Router)** | Active LTS release; full-stack in one local app. |
| UI library | **React 19.2** | Required pairing for Next 16 (React 18 deprecated there). |
| Language | **TypeScript 5.x** (strict) | — |
| Styling / components | **Tailwind CSS 4 + shadcn/ui** | shadcn officially supports Tailwind v4 + React 19. |
| API layer | **tRPC v11 + TanStack Query v5** | End-to-end typesafe client-server; new first-class TRQ integration. |
| Data layer | **Prisma ORM 7 + PostgreSQL 18** | Prisma 7 = Rust-free, faster client; Postgres 18 latest major. |
| Job queue | **BullMQ + Redis 8 + @bull-board** | Battle-tested workers, progress UI, repeatable (cron) jobs. |
| Graph viz | **Cytoscape.js 3.x + cytoscape-fcose 2.2** | Best-in-class edge label styling + compound/cluster layouts. |
| Chain utils | **viem (latest 2.x)** | Modern TS EVM toolkit. |
| Validation | **Zod v4** | Shared client/server schemas + settings. |
| Charts | **Recharts** (or shadcn charts) | Heatmaps, edge decay curves, netflow bars. |
| Package manager | **pnpm** | — |
| Runtime env | **Docker Compose**: `app` + `postgres:18` + `redis:8` | One command local boot: `docker compose up`. |

---

## 8. Implementation Plan

Build strictly in this order. Each phase ends with a working, usable app state.

### Phase 0 — Scaffold
Next.js 16 + TS + Tailwind 4 + shadcn + tRPC + Prisma 7 schema (all entities) + Docker Compose + Etherscan V2 client with global rate limiter + `.env.example`.
**Accept:** `docker compose up` boots app + DB + Redis; health check page shows Etherscan quota usage.

### Phase 1 — Registry & Funding Tracer (the foundation)
FR-1.1–1.8, FR-2.1–2.8 (FR-2.4 primary-wallet logic included), intake pipeline as background jobs.
**Accept:** import 10 wallets via CSV → each shows a profile with stats + funding tree; a known CEX funder displays as terminal entity; shared funders auto-create clusters; deep-trace button extends a branch.

### Phase 2 — Interaction Graph
FR-3.1–3.8.
**Accept:** import set renders bubble map; edges labeled `TICKER · $USD` with breakdown on click; independence verdict panel populated; graph exports PNG.

### Phase 3 — Narrative Radar
FR-4.1–4.8 (needs price snapshots + token deploy dates).
**Accept:** movement feed streams live actions; a simulated two-wallet same-token buy within 24h produces a co-accumulation group card; netflow table and breadth indicator populated.

### Phase 4 — Alert Engine
FR-5.1–5.5, all A/T/C rules + Settings page for thresholds; optional Telegram.
**Accept:** historical backfill of alerts after first sync; a test wallet with stablecoin inflow trips A1 with evidence tooltip; state badges (IDLE/ARMED/TRIGGERED) render on list, graph, and detail.

### Phase 5 — Self-Tracking
FR-6.1–6.6.
**Accept:** register self wallet → auto-linked trades with lag data; edge decay curve renders for a followed wallet with ≥ 5 linked trades.

### Phase 6 — Token Lookup & Grading
FR-7.1–7.2; auto-grade computation (WR, realized PnL, entry-timing ratio) displayed on wallet profile.
**Accept:** paste a token → holders/netflow/red-flag panel renders in < 3s from local DB.

### Phase 7 (optional, later) — Solana via Helius behind ChainAdapter.

---

## 9. Configuration (`.env.example`)

```
DATABASE_URL=postgresql://watchtower:watchtower@localhost:5432/watchtower
REDIS_URL=redis://localhost:6379
ETHERSCAN_API_KEY=            # V2 multichain key
DEXSCREENER_ENABLED=true
COINGECKO_API_KEY=            # optional
TELEGRAM_BOT_TOKEN=           # optional, alert delivery
TELEGRAM_CHAT_ID=             # optional
APP_TIMEZONE=Asia/Jakarta
DEFAULT_CHAIN=ethereum
```

Settings (DB-backed, editable in UI, all alert thresholds): stablecoin list, A/T/C thresholds, co-entry windows, sync cadence, min USD edge filter, max funding trace depth.

---

## 10. Notes for the Implementing Agent

1. **Build phases in order; do not skip to the graph or radar before the intake pipeline is solid** — everything downstream is only as good as the ingested data.
2. **Never fetch on the UI thread.** Every external call goes through the queue. Progress must be visible.
3. **Persist USD at ingest time** (PriceSnapshot). Token amounts without USD context are useless for the user's decisions.
4. **Internal transactions are not optional** for funding traces — normal tx list alone misses contract-mediated gas funding.
5. **Respect the 1,000-records-per-request Etherscan free-tier cap** — paginate everywhere, cache per (address, chain), and make re-syncs incremental.
6. **Alerts must show their evidence** (rule + numbers + tx links). The user distrusts black-box signals.
7. **Independence is a first-class computation** (different funders + no interaction edge), not a UI afterthought — the entire radar's trustworthiness depends on it.
8. All timestamps stored UTC; rendered in `APP_TIMEZONE`.
9. Keep the `ChainAdapter` boundary clean from day one.
