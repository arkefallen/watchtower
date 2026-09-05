# P0-D01 Stitch prompt

Create the private Watchtower Phase 0 design for a 1440px desktop web app.
Watchtower is a local-only, single-user EVM wallet intelligence console. The
operator needs to see whether PostgreSQL, Redis, BullMQ, and external provider
budgets are healthy before trusting later wallet intelligence.

Design a dark, cockpit-dense application shell with a 240px left sidebar and a
wide main workspace. Navigation labels should include Dashboard, Wallets,
Clusters, Graph, Radar, Alerts, Self-tracking, Token lookup, Settings, and
Health. The active item is Health. Use Geist and Geist Mono, Observatory Canvas
`#101214`, Graphite Surface `#171A1D`, Raised Slate `#1E2327`, Hairline Border
`#30373D`, primary text `#E8ECEF`, muted text `#929BA3`, and one restrained
amber accent `#D7A84B`. Do not use gradients, purple/blue neon, Inter, fake
metrics, emojis, or decorative imagery.

The health screen must show: page title and refresh timestamp; DB, Redis, and
queue status rows; migration version; a Bull Board link; and one quota section
per enabled provider—Etherscan, Robinhood provider, and DexScreener. Each
provider shows calls today, rate-limit hits, remaining calls when known, and
`UNKNOWN` when no published limit exists. Include a visible local-time / UTC /
block display toggle for timestamps.

Generate these states at the same desktop geometry: healthy, loading with
skeleton rows, degraded provider, and quota exhausted. Errors must be inline,
specific, and actionable. Preserve layout geometry across states. This is an
operational interface, not a marketing dashboard.
