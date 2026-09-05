# Health and Bull Board redesign — 2026-09-06

Implemented the existing approved Phase 0 design from Stitch project
`17665303442847236685`, retrieved through Stitch MCP. No new design plan or
remote Stitch modifications were made.

References exported into `.stitch/designs/`:

- `health-reference-1`: healthy, `5fd1378f30d04969b84aceb8d452c35f`.
- `health-reference-2`: degraded, `33d7635373694c8aa77e38072abff297`.
- `health-reference-3`: quota exhausted, `09530a985222415aa7d8f5165956b779`.
- `.stitch/DESIGN.md`: retrieved Watchtower Intelligence design system,
  asset `ef5e0976c569407993cc376fc3c2698b`.

Health and Bull Board share graphite/amber tokens, square panels, dense tables,
local Geist fonts, and a metadata rail. Mobile tables reflow into labeled rows.
Health uses the existing `health.status` and `health.quota` tRPC contracts and
refreshes every 30 seconds, with a manual refresh control. Unknown limits stay
unknown; exhausted budgets and unavailable snapshots have explicit recovery
copy. LOCAL uses `APP_TIMEZONE`; UTC and BLK are explicit display choices.
Because the health API returns no chain block, BLK reports `Block unavailable`.
Mock latency, secondary-key actions and live-provider claims were not added.

Bull Board remains read-only, with its existing loopback guard and HTML escaping.
The existing standalone `/api/health` probe and backend contracts are unchanged.
Rate-limit events represent daily recorded events, not a live outage signal.

Verification:

- `corepack pnpm verify`: passed, 192 tests passed. Three environment-gated
  integration tests skipped; two existing warnings remain in wallet import UI.
- `corepack pnpm build`: passed.
- Scoped ESLint: passed without warnings.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 corepack pnpm exec playwright test
  tests/e2e/phase0.spec.ts tests/e2e/health-design.spec.ts --workers=1`: 7 passed.
- New browser cases first failed against the previous UI, then passed.
- Independent quality review: no scoped findings. Both pages fit
  320/390/768/1024/1440px widths, focus is amber, fonts load locally, seven live
  queues render, and a non-loopback Bull Board request returns 403.
- Chromium review screenshots are in `test-results/health-desktop-final.png`,
  `test-results/bull-board-desktop-final.png`, and mobile equivalents.

The shell's unrelated existing changes were preserved. No commit or deployment
was performed. This review did not expand into a security audit of existing
loopback trust assumptions or a backend health-service rewrite.
