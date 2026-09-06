# P4-D01 Stitch Prompts: Alerts, State, Evidence & Settings

Stitch project: `projects/17665303442847236685`  
Design system asset: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)

Phase 4 designs were generated using Google Stitch under the approved "Observatory" design system:
- **Visual Atmosphere:** Dark, cockpit-dense onchain intelligence console. Density 8/10, Variance 5/10, Motion 3/10.
- **Palette:** Observatory Canvas (`#101214`), Graphite Surface (`#171A1D`), Raised Slate (`#1E2327`), Hairline Border (`#30373D`), Primary Text (`#E8ECEF`), Muted Text (`#929BA3`), Signal Amber (`#D7A84B`), Verified Green (`#79B79A`), Risk Red (`#D87870`).
- **Shapes:** Strict 0px border-radius (sharp corners) across all panels, tables, buttons, inputs, and chips.
- **Typography:** Geist (headings and UI labels), Geist Mono (addresses, hashes, numbers, USD values, timestamps).
- **Reusable Chrome:** Standard 240px Left Navigation Sidebar with active Amber highlight on `Alerts` (`/alerts`) and `Settings` (`/settings`).

---

## Screen 1: `/alerts` — Alert Center & Evidence Rail

- **Stitch Screen ID:** `c4914942d6f64a10b516c2aa9d84d61f`
- **Title:** Watchtower Alert Center
- **Route:** `/alerts`
- **Local Assets:** `docs/design/phase-4/assets/alerts.png`, `docs/design/phase-4/assets/alerts.html`

### Prompt Content:
```text
Watchtower Alert Center dashboard (/alerts).
Background: #101214.
Layout: 240px sidebar, top bar, main content area.
Sidebar: SideNavBar with 'Alerts' active (with amber unread badge '3').
Content:
- Header: 'ALERT_CENTER' in Geist 600, Signal Amber accents.
- KPI bar: Active Alerts (18), Armed Wallets (7), Triggered (4), Exit Risk (7), Unread (3).
- Filter Toolbar: Buttons for 'ALL', 'ARMED', 'TRIGGERED', 'EXIT_RISK'. Restrained graphite outline styling.
- Multi-dimensional filters: Rule category dropdown (A1-A6, T1-T5, C1-C4), Wallet filter, Token filter, Unread only toggle.
- Alerts Table (Density 8/10):
  - Columns: TIMESTAMP (Mono), ENTITY (Geist), RISK_LEVEL (Status indicator), TRIGGER_TYPE (Label), EVIDENCE (Link), ACTIONS.
  - Row Hover: #1E2327.
- Evidence Popover (Overlay): Focused on an alert event. Shows:
  - 'EVIDENCE_RAIL' heading.
  - Rule text and specific threshold conditions met: 'VAL >= $1,000' [MET], '3x MEDIAN' [MET].
  - TX Link: '0xabc...123' in Geist Mono.
  - Action buttons: 'ACKNOWLEDGE', 'DISMISS'.
Typography: Geist for labels, Geist Mono for addresses and timestamps.
Visuals: No gradients, no glows. Hairline borders (#30373D).
```

---

## Screen 2: `/settings` — Settings Console & Alert Thresholds

- **Stitch Screen ID:** `1965883e606a40f79eae812c05b02490`
- **Title:** Watchtower Settings Console
- **Route:** `/settings`
- **Local Assets:** `docs/design/phase-4/assets/settings.png`, `docs/design/phase-4/assets/settings.html`

### Prompt Content:
```text
Watchtower Settings page (/settings).
Layout: 240px sidebar (Settings active), Top Bar with 'Watchtower / Settings', 'Save Configuration' button, and status '● SETTINGS LOADED FROM LOCAL DB'.
Section 1: Alert Thresholds & Rules. Dense cards for:
- A1 (Stablecoin Arming: floor $1000, 3x median)
- A2 (Gas Arming: floor $100, 3x median, note: 'Cold-start: historical median calculated on first 50 tx')
- A3 (CEX Withdrawal: $1000)
- A4 (Dormancy: 30d, $500)
- A5 (Cluster arming: 48h, min 2 wallets)
- T1 (Armed Entry: 7d age, $500)
- T2 (Independent co-entry: 24h, min 2 wallets, dropdown: ANY_TAG_OR_COMPUTED vs EDGE_TAG_ONLY)
- C3 (Moon Discipline: 10x, 3d, c3SelfOnly toggle)
- De-arm parameters: 120% baseline, 7 consecutive days.
Section 2: Cadence & System. Radar cadence (5m), Quota reserve (10%).
Section 3: Optional Telegram Notifications. Toggle 'Enable Telegram Notifications', Bot Token input, Chat ID input, 'Send Test Message' button.
Section 4: Maintenance & Backup. Banner: 'Last backup: 2 days ago — Healthy', 'Run Manual Backup' button, 'Prune Token History' utility with 'Irreversible operation' confirmation copy.
Style: Observatory design system (#101214 canvas, #171A1D panels, #30373D borders, Signal Amber #D7A84B accents). High density (8/10), Geist and Geist Mono. No emojis, no gradients, no glows.
```
