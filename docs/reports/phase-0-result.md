# Watchtower Phase 0 result

Status: acceptance criteria passed; handoff-ready pending the owner's Phase 1
approval.

Report date: 2026-09-05  
Scope: Phase 0 only (`P0-D01`, `P0-T01` through `P0-T18`)  
Authoritative sources: `watchtower-srs.md`, `watchtower-implementation-plan.md`

## Outcome

Phase 0 establishes the local Next.js application scaffold, PostgreSQL and
Redis runtime, Prisma schema and migration, rate-limited provider clients,
BullMQ worker infrastructure, chain-adapter boundary, deterministic fixtures,
health surface, backups, and approved dark-theme shell.

Phase 1 was not started. No wallet registry, ingestion pipeline, funding
tracer, graph, radar, alert, or token-lookup feature was implemented.

## Acceptance evidence

| SRS §8 criterion | Result | Evidence |
|---|---|---|
| `docker compose up` boots app, DB, and Redis | PASS | `docker compose up -d`; app, PostgreSQL 18, Redis 8, and worker running; migrate exited successfully |
| Health page shows usage/quota for enabled providers | PASS | `http://127.0.0.1:3000/health`; `/api/health` returned DB/Redis `ok`, migration `0001_phase0_initial`, Etherscan, Alchemy Robinhood, Blockscout Robinhood, and DexScreener quota entries |
| Robinhood adapter passes shared read-only contract | PASS | chain ID `4663`; normal, internal, ERC-20, balances, token metadata, block lookup, timestamps, pagination, empty state, offline fixture, and explorer URL tests |

Latest command evidence:

```text
pnpm verify       PASS — 60 unit tests; typecheck passed; lint 0 errors
pnpm e2e          PASS — 4/4 Playwright tests
docker compose up -d  PASS — app/postgres/redis healthy, worker running
```

The default Node runtime is `v24.11.1`; the pinned engine range starts at
`24.20.0`, so pnpm reports an engine warning. This does not invalidate the
current test results; use the pinned runtime before release verification.

## Task completion

| Task | Status | Primary files/artifacts |
|---|---|---|
| P0-D01 | DONE | `docs/design/DESIGN.md`, `docs/design/phase-0/*`, approved Stitch IDs |
| P0-T01 | DONE | `package.json`, Next/TS/Tailwind config, app scaffold |
| P0-T02 | DONE | `Dockerfile`, `docker-compose.yml`, `.dockerignore` |
| P0-T03 | DONE | `src/lib/env.ts`, `.env.example`, env tests |
| P0-T04 | DONE | `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/0001_phase0_initial`, DB client |
| P0-T05 | DONE | settings schema/store/seed and tests |
| P0-T06 | DONE | entity-label dataset/service/seed and tests; intentionally minimal v1 dataset |
| P0-T07 | DONE | Redis token bucket, daily budget, usage recorder, tests |
| P0-T08 | DONE | Etherscan V2 client, Zod envelopes, retry/cache/error handling |
| P0-T09 | DONE | block-window pagination algorithm and tests |
| P0-T10 | DONE | `src/lib/chains/types.ts`, registry, Etherscan adapter, ADR 0002 |
| P0-T11 | DONE | `mock-adapter.ts`, seven scenarios, scenario helpers, opt-in recorder, fixture tests |
| P0-T12 | DONE | DexScreener official tokens endpoint, CoinGecko client, market-data tests |
| P0-T13 | DONE | queue contracts, queues, worker, schedules, projection, loopback Bull Board route |
| P0-T14 | DONE | tRPC context/root/health router/client provider |
| P0-T15 | DONE | shell, health page, shared status/quota/time/USD components, Phase 0 E2E |
| P0-T16 | PARTIAL | `scripts/backup.ts`, `scripts/restore.ts`, safety and fake-process tests; fresh DB restore row-count round-trip remains to be run |
| P0-T17 | DONE | test helpers, `vitest.config.ts`, `pnpm verify`, test compose file |
| P0-T18 | DONE | Robinhood provider client/adapter, probe, ADR 0001, sanitized fixture, shared contract/pagination tests |

P0-T16 is the only recorded task-level gap. Backup creation, gzip output,
metadata, failure handling, confirmation guard, and migration pre-backup are
implemented and tested; the remaining evidence is an isolated fresh-database
restore with row-count comparison.

## Decisions and approved inputs

- Default chain: Base; supported v1 chains: Base, BSC, Robinhood Chain.
- P0-T10 uses explicit adapter dependency injection. See
  `docs/decisions/0002-adapter-construction.md`.
- Robinhood uses Alchemy read-only data/RPC plus Blockscout PRO internal
  transactions. See `docs/decisions/0001-robinhood-data-provider.md`.
- DexScreener uses `GET /tokens/v1/{chainId}/{tokenAddresses}` in batches of at
  most 30 addresses; unavailable prices remain `null`/`UNKNOWN`.
- Stablecoin addresses supplied by the owner are recorded in the Phase 0 seed:
  BSC USDT, Base USDC, and Robinhood USDG.
- Health UI is `/health`; JSON health endpoint is `/api/health`; Docker checks
  `/api/health`.
- Approved Stitch screens are recorded in
  `docs/design/phase-0/approval.md`.
- No private keys, seed phrases, signing, broadcasting, or mainnet asset
  movement is present.

## Traceability

| Requirement | Phase 0 task(s) |
|---|---|
| NFR-1 local structured logging/no remote sink | P0-T14 |
| NFR-2 queued external work and deterministic verification | P0-T11, P0-T13, P0-T17 |
| NFR-3 local validation boundary | P0-T03, P0-T14 |
| NFR-5 additive/no automatic deletion posture | P0-T04, P0-T16 |
| NFR-6 backup before migration | P0-T02, P0-T16 |
| NFR-8 approved UI/design system and timezone rendering | P0-D01, P0-T15 |
| NFR-9 clean ChainAdapter boundary | P0-T10, P0-T11, P0-T18 |
| FR-1.3 / FR-2.1 Robinhood read-only chain coverage | P0-T18 |
| FR-5.4 repeatable job registration point | P0-T13 |

## Known verification limitations

- Integration tests skip when the isolated test PostgreSQL/Redis services are
  not configured for the invocation. A prior isolated run passed all three
  integration tests; rerun them before release.
- Lint reports 40 warnings from generated files, config, and repository skill
  assets, but zero errors.
- The host has Node `24.11.1` while the project engine pin requires
  `>=24.20.0 <25`.
- The live fixture recorder is intentionally opt-in and should only capture
  reviewed, non-sensitive responses.

## Gate

Do not begin Phase 1 until the project owner explicitly approves it. The next
agent must read this report, the handoff file, the SRS, and the implementation
plan before changing code.
