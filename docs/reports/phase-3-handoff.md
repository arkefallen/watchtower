# Watchtower Phase 3 Handoff to Phase 4 Agent

Handoff Date: 2026-09-06  
Source Report: [`docs/reports/phase-3-report.md`](phase-3-report.md)  
Target Phase: **Phase 4 — Alert Engine & Wallet State Machine (SRS §3 Module 5 & §8)**

---

## 1. Read First (Mandatory Context)

1. `watchtower-srs.md` — Authoritative requirements: Module 5 (Alert Engine & Wallet State Machine, FR-5.1–5.5) and §8 (Phase 4 Acceptance Criteria).
2. `watchtower-implementation-plan.md` — Task contract for Phase 4 (`P4-D01` through `P4-T12`).
3. `docs/reports/phase-3-report.md` — Verified state of the Narrative Radar and updated Interaction Graph.
4. `docs/design/DESIGN.md` — Approved Observatory visual language and design tokens.
5. `AGENTS.md` — Web3 Full-Stack Agent workflow, safety guardrails, and human approval boundary.

---

## 2. Current State & Established Infrastructure

### Database & Prisma Models
- `AlertEvent` model already exists in `prisma/schema.prisma` with:
  `id`, `walletAddress`, `walletChain`, `type` (`A1..C4`), `state` (`ARMED`, `TRIGGERED`, `EXIT_RISK`), `payloadJson`, `evidenceJson`, `createdAt`, `readAt`.
- `Wallet` has `alertState` (`IDLE`, `ARMED`, `TRIGGERED`).
- `Setting` stores DB-backed key-value configurations.

### Queue System
- `QUEUES.radar` and `QUEUES.ingestion` are active in `src/lib/queue/contracts.ts`.
- BullMQ worker is running in Docker Compose (`wallet_tracker-worker-1`).

### Graph Visualization
- Cytoscape bubble map is fully upgraded with celestial background, neon ring bubbles, dashed transfer edges, neighborhood focus highlighting, and a dedicated collapsible right sidebar.
- Graph node borders already reflect `node.alertState` (`IDLE` -> subtle ring, `ARMED` -> Signal Amber `#D7A84B` glow ring, `TRIGGERED` -> Coral Red `#D87870` alert ring).

### Running Services (Local Docker)
- App: `http://localhost:3000` (healthy)
- Postgres: `127.0.0.1:5432` (`watchtower`/`watchtower`)
- Redis: `127.0.0.1:6379`
- Bull Board: `/api/bull-board`

---

## 3. Scope for Phase 4: Alert Engine & State Machine

Phase 4 implements the automated detection rules that transition wallets through the state machine: `IDLE` ➔ `ARMED` ➔ `TRIGGERED`.

### A. ARMED Triggers (Funds Being Prepared)
- **A1 — Stablecoin arming:** Wallet receives stablecoin inflow $\ge \max(\$1,000, 3\times \text{median daily inflow})$ within 24h.
- **A2 — Gas arming:** Native asset inflow $\ge \max(\$100, 3\times \text{median daily inflow})$ within 24h (Decision D-4 floor applied).
- **A3 — CEX withdrawal:** Inflow from labeled CEX entity $\ge \$1,000$.
- **A4 — Dormancy wake:** Wallet inactive $\ge 30$ days receives funding $\ge \$500$.
- **A5 — Cluster arming:** One funder funds $\ge 2$ wallets of the same cluster within 48h (cluster-level ARMED priority).
- **A6 — Consolidation:** Wallet receives sweeps from $\ge 2$ addresses it previously funded.

### B. TRIGGERED Triggers (Moving into Assets)
- **T1 — Armed entry:** ARMED wallet buys any token with age $< 7$ days, position $\ge \$500$.
- **T2 — Independent co-entry:** $\ge 2$ mutually independent graded wallets buy same token within 24h (cross-referenced with FR-4.2).
- **T3 — Fresh-launch entry:** Graded wallet buys token $< 1\text{h}$ old.
- **T4 — Add-on-retrace:** Wallet adds position after $\ge 20\%$ drawdown from local high.
- **T5 — Cluster co-entry:** $\ge 2$ same-cluster wallets enter same token within 1h (warning-styled coordination).

### C. Exit-Risk Annotations
- **C1 — Distribution prep:** Graded wallet deposits memecoin token to CEX.
- **C2 — Co-distribution:** $\ge 2$ graded wallets exit same token within 12h.
- **C3 — Moon discipline:** Tracked wallet position $> 10\times$ unrealized and $> 3$ days old.
- **C4 — Campaign spent:** Stablecoin balance drops $> 70\%$ from peak within 48h after a TRIGGERED event.

### D. De-Arm Conditions
- Stablecoin/native balance returns to $\le 120\%$ of 30-day baseline for 7 consecutive days, or funds return to a terminal entity.

### E. Alert Center UI & Settings
- Alert Center (`/alerts`): Filterable list by type, state, token, wallet; mark-as-read; unread badge in navigation sidebar.
- Every alert must show an **Evidence Tooltip** detailing the rule, thresholds, numbers, and transaction links (FR-5.5, NFR-8).
- Settings page (`/settings`): Editable thresholds for all A/T/C rules, configurable stablecoin list, and optional Telegram bot notifications (FR-5.3).

---

## 4. Phase 4 Execution Flow

Follow the established protocol:
1. **Design Gate (`P4-D01`)**:
   - Produce Stitch screens or UI mockups for the Alert Center (`/alerts`) and Alert Settings (`/settings`).
   - Obtain user approval before writing React UI code.
2. **Rule Engine Implementation**:
   - Pure function rule validators in `src/lib/rules/`.
   - Evaluation orchestrator in `src/server/services/alert/`.
   - Unit test coverage for every rule (A1..A6, T1..T5, C1..C4).
3. **Queue & Evaluation Job**:
   - Repeatable BullMQ evaluation job (`src/server/workers/processors/radar-evaluate.ts` / `alert-evaluate.ts`) running every 5 minutes and upon wallet sync.
4. **UI Surfaces**:
   - Alert Center table with filters and evidence popovers.
   - Settings page with form validation.
   - State badge consistency across `/wallets`, `/graph`, and `/alerts`.
5. **Phase 4 Acceptance & E2E**:
   - Add `tests/unit/phase4-acceptance.test.ts` and `tests/e2e/phase4.spec.ts`.
   - Verify `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test:unit`, and `corepack pnpm e2e`.

---

## 5. Verification Commands for the Next Agent

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm e2e tests/e2e/phase2.spec.ts
docker compose ps
```

The system is in a clean, fully verified, and passing state.
