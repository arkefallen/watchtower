# P0-D01 screen map

Stitch project: `projects/17665303442847236685`

| Screen/state | Device | Required content | Acceptance signal |
|---|---|---|---|
| Application shell + healthy Health | Desktop 1440px | Sidebar, status grid, provider quota meters, timestamp toggle, Bull Board link | Primary Phase 0 reference |
| Health loading | Desktop 1440px | Geometry-matched skeletons for statuses and provider rows | No layout jump; no spinner-only state |
| Health degraded provider | Desktop 1440px | One provider marked `DEGRADED`, other providers remain independently visible | Partial outage is explicit |
| Health quota exhausted | Desktop 1440px | Provider marked `RATE LIMITED`, reset/next action text, other providers remain visible | No invented remaining quota |

## Stitch references

Stitch generated the following desktop references in project
`projects/17665303442847236685`. Stitch exported them at 2560×2048; the
implementation viewport contract remains 1440px desktop.

| State | Stitch screen ID | Local assets | Review status |
|---|---|---|---|
| Healthy | `5fd1378f30d04969b84aceb8d452c35f` | `assets/healthy.html`, `assets/healthy.png` | Review required |
| Loading | `0b952ea42d604dadaa54f21e7f7aaace` | `assets/loading.html`, `assets/loading.png` | Review required |
| Degraded | `33d7635373694c8aa77e38072abff297` | `assets/degraded.html`, `assets/degraded.png` | Review required |
| Quota exhausted | `09530a985222415aa7d8f5165956b779` | `assets/quota-exhausted.png` | Review required; HTML export unavailable |

The generated references are not yet approved. Local HTML review found a
sample `12ms latency` value in healthy/degraded output; it must not become
runtime data. Any generated key-rotation or secondary-key action is also out
of scope and must not be implemented.

Top-level shell routes represented in navigation: `/`, `/health`, `/wallets`,
`/wallets/new`, `/clusters`, `/graph`, `/radar`, `/alerts`, `/self-tracking`,
`/tokens`, and `/settings`.
