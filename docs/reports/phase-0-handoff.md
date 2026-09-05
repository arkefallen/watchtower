# Watchtower Phase 0 handoff to the Phase 1 agent

Handoff date: 2026-09-05  
Source report: [phase-0-result.md](phase-0-result.md)  
Scope restriction: do not implement Phase 1 in this handoff document or in the
current agent cycle.

## Read first

1. `watchtower-srs.md` — requirements win over the plan.
2. `watchtower-implementation-plan.md` — task order, contracts, and gates.
3. `docs/reports/phase-0-result.md` — verified state and limitations.
4. `docs/design/DESIGN.md` — approved visual language.
5. `docs/decisions/0001-robinhood-data-provider.md` and
   `docs/decisions/0002-adapter-construction.md` — provider and construction
   decisions.
6. `AGENTS.md` — repository safety and delegation rules.

## What Phase 1 may rely on

- `ChainAdapter` in `src/lib/chains/types.ts` is the sole chain semantic
  boundary. Use `getAdapter(chain, factories)` with explicit factories; do not
  add implicit credential or network ownership to the registry.
- `MockChainAdapter` and scenario loader are available for all ingestion tests.
  Tests must not call live APIs.
- External provider clients already have Zod parsing, rate-limiter hooks, cache
  hooks, typed errors, and explicit unavailable-value behavior. New network
  work must remain in BullMQ workers.
- Prisma schema and migration `0001_phase0_initial` are deployed. Later schema
  changes must be additive only; do not rename/drop/narrow fields or delete
  data.
- Queues, job payload contracts, progress helpers, `JobRun` projection, and
  worker entrypoint are in place. Use deterministic job IDs and monotonic
  progress.
- The application is localhost-only. Preserve loopback restrictions for
  operational endpoints and bind ports to `127.0.0.1`.
- Store timestamps as UTC and render with `APP_TIMEZONE`.

## Phase 1 execution gate

The first Phase 1 task is `P1-D01`, not UI implementation. Follow the
Stitch-first workflow:

1. Restate the Phase 1 goal and ordered task list.
2. Design wallet registry, profile, cluster, funding, import-progress, heatmap,
   and evidence states in Stitch using the Phase 0 design system.
3. Record screen map, interaction notes, exported assets, and approval in
   `docs/design/phase-1/`.
4. Stop for explicit owner approval before writing Phase 1 React UI code.
5. Only after that gate, implement `P1-T01` onward in plan order.

Do not silently skip the Phase 1 design gate, reorder tasks, or begin with a
convenient UI route. The Phase 1 acceptance target is importing 10 wallets via
CSV and rendering profiles, a known CEX terminal funder, shared-funder
clusters, and a deep-trace extension using deterministic fixtures.

## Important constraints for Phase 1

- Same-chain funding and interactions only; cross-chain bridge continuation is
  deferred backlog work.
- Address normalization is lowercase for persistence and EIP-55 validation is
  required at the input boundary.
- Ingestion must be incremental, idempotent, paginated, and backgrounded.
- Internal transactions are mandatory for funding traces.
- Persist USD attribution at ingest; preserve `UNKNOWN` rather than inventing
  zero prices.
- Do not add signing, wallet custody, transaction broadcasting, or private-key
  handling.
- Keep task commits small and labeled `phase 1 / task <ID>: summary` only if
  the owner authorizes commits under the active repository policy.

## Verification handoff

Run from the repository root:

```text
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm e2e
docker compose up -d
```

For integration tests, start the isolated services from
`docker-compose.test.yml` and use their documented ports without replacing or
deleting the main development database. Recheck `/api/health` after any
provider, queue, migration, or Docker change.

## Explicit stop point

This handoff does not authorize Phase 1 work by itself. The next agent must
obtain and record explicit owner approval before proceeding past the Phase 1
design gate.
