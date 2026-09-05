# P1-D01 Interaction Notes

Phase 1 designs establish interaction patterns for the Wallet Registry, Intake Pipeline, Wallet Detail, Activity Heatmaps, Funding Tree, and Cluster drawer.

---

## 1. Density & Layout Architecture

- **Desktop Viewport:** Designed strictly for 1440px desktop screens (minimum 1024px, optimal 1440px+).
- **Navigation:** Fixed 240px left sidebar with 1px Hairline Border (`#30373D`) divider. Active route (`Wallets`) is marked by a 3px solid Signal Amber (`#D7A84B`) bar and Raised Slate background (`#1E2327`).
- **Main Workspace:** Fluid CSS Grid with structured spatial zones:
  - Top header + breadcrumbs + primary action buttons.
  - Sticky filters/search bar.
  - Dense virtualized data table (8/10 density, 36px row height).
  - Docked floating bulk action bar at bottom-center when ≥ 1 row is selected.
  - Multi-column grids on detail and intake pages.

---

## 2. Wallet Registry (`/wallets`)

- **Table Virtualization:** Virtual scroll for lists containing up to 1,000 wallets. Header remains sticky (`top: 0`, `z-index: 20`, Graphite Surface background).
- **Address Display & Copy:**
  - Addresses are rendered in Geist Mono with middle truncation: `0xd8da...6045`.
  - Clicking the copy icon copies the full 42-char checksum address to clipboard and briefly shifts the icon to a Signal Amber `✓ COPIED` tooltip for 1,200ms.
  - External link icon opens the chain explorer (Basescan, BscScan, or Robinhood Explorer) in a new tab with `rel="noopener noreferrer"`.
- **Computed Label:**
  - Rendered as a compact pill: `{EDGE}-{STYLE} [{SIZE}]` (e.g. `SMART-RIDER [W]`).
  - Missing parts are omitted cleanly along with separators (e.g., edge-only renders `SMART`, edge + size renders `SMART [W]`).
- **Selection & Bulk Action Bar:**
  - Checking rows activates the floating action bar docked at bottom-center (`position: fixed`, `bottom: 24px`, `z-index: 50`).
  - Actions supported:
    1. **Re-sync Selected (Incremental):** Enqueues `wallet.sync.incremental` jobs for selected addresses.
    2. **Set Priority Watch:** Toggles `watchPriority: HIGH` (hourly sync cadence).
    3. **Export Selection:** Downloads CSV containing selected wallet rows and statistics.
    4. **Delete (Danger):** Opens confirmation modal with destructive warning before cascading wallet deletion.
    5. **Clear Selection (Esc):** Unchecks all rows and dismisses bar.
- **Timezone & Block Toggle:**
  - Top-right toggle switches all timestamp cells between:
    1. `Local`: Rendered in user's configured `APP_TIMEZONE` (e.g. `Asia/Jakarta`, UTC+7) with relative suffix (`12m ago`).
    2. `UTC`: Rendered as `YYYY-MM-DD HH:mm:ss UTC`.
    3. `Block`: Rendered in Geist Mono as `Block #24,891,024`.

---

## 3. Wallet Intake & CSV Batch Processing (`/wallets/new`)

- **Single Add Form:**
  - Real-time ENS resolution: Typing `vitalik.eth` debounces a 300ms call to `wallet.resolveEns`. Upon resolution, displays green badge: `✓ Resolved to 0xd8da...6045 via L1 Universal Resolver`. The resolved address becomes the primary key.
  - Address validation: Validates EIP-55 checksum and 42-char length via viem. Non-hex or bad-length inputs show immediate field-level error.
- **Batch CSV Import Form:**
  - Textarea expects `address,chain,label?` per line. Blank lines and `#` comments are ignored. Missing chain defaults to `DEFAULT_CHAIN` (Base).
  - Pre-flight syntax validation: Parses input on change and displays a Risk Red alert box enumerating line numbers with defects (e.g. `Line 3: Invalid hex address length`).
  - Clear breakdown stats: `Ready to import: 95 valid | 2 duplicates | 1 invalid`.
  - Submitting does not block the UI (NFR-2); it launches `wallet.import.batch` in BullMQ.
- **Live BullMQ Intake Pipeline Monitor:**
  - Docked in the lower-right workspace.
  - Displays parent job progress percentage (e.g. `68%`) with monotonic increment.
  - Lists 14 frozen pipeline stages with status indicators: `[✓ DONE]`, `[● RUNNING]`, `[QUEUED]`.
  - Stage names match the frozen backend contract: `resolve:ens`, `ingest:normal`, `ingest:internal`, `ingest:erc20`, `price:enrich`, `profile:stats`, `balance:snapshot`, `funding:parking`, `trace:funding`, `classify:primary`, `cluster:detect`, `movement:derive`, `relation:sync`, `alert:backfill`.
  - Operator can freely navigate away to other pages while jobs run.

---

## 4. Wallet Detail & Heatmap Modes (`/wallets/[chain]/[address]`)

- **Tag Editor Toolbar:**
  - Inline dropdowns for `edge` (`SMART`, `BOT`, `DUMB`, `EARLY`), `style` (`SNIPER`, `SWING`, `RIDER`, `ACCUMULATOR`, `DCA`), `size` (`SHRIMP`, `FISH`, `DOLPHIN`, `WHALE`).
  - Text fields for custom `label` and `notes`.
  - Checkboxes for `watchPriority`, `isBlacklisted`, `isSelf`.
  - Saves automatically with visual debounce indicator.
- **Dual-Mode Activity Heatmap:**
  - 168 cells: 7 rows (Sunday to Saturday) × 24 columns (Hours 00 to 23).
  - Mode toggle:
    1. **Habitual Timing (Full History):** Buckets all ingested transactions across the wallet's entire lifetime into hour-of-day × day-of-week, normalizing habitual trading patterns.
    2. **Rolling 7 Local Days (Recent):** Buckets only transactions occurring within the last 7 local calendar days (`[now − 7 days, now]`), reflecting recent shifts in activity.
  - Both modes compute in user's local timezone (`APP_TIMEZONE`).
  - Stepped amber palette: Level 0 (`#171A1D`), Level 1 (`#4A3A1A`), Level 2 (`#85621F`), Level 3 (`#D7A84B`).
  - Hovering a cell displays a tooltip with day, hour, transaction count, and percentage of activity.
- **Stablecoin Parking Timeline:**
  - Shows current parked balance per chain and peak parked USD with timestamp.
  - Chronological feed of stablecoin transfers with direction badges (`INFLOW` in green, `OUTFLOW` in red), token name, USD value, transaction link, and counterparty entity tag (e.g. `Binance 14 (CEX Hot Wallet)`).

---

## 5. Recursive Funding Tree (`/wallets/[chain]/[address]/funding`)

- **Tree Hierarchy & Traversal:**
  - Visual tree rooted at the target wallet, branching upward into upstream funders.
  - Connecting lines: 1px Hairline rules (`#30373D`) with directional flow labels showing USD transferred, token, and transfer mechanism (native vs internal trace).
- **Node Classification & Styling:**
  - **Terminal Entity (CEX / Bridge / Router):**
    - Styled as a terminal leaf with Verified Green outline pill `[TERMINAL ENTITY: CEX]`.
    - Stop Reason: `TERMINAL_ENTITY`.
    - No outbound recursion branches; zero explorer calls spent on exchange history.
  - **Primary Wallet Warning Node:**
    - High-priority Signal Amber solid badge: `[⚠️ PRIMARY WALLET]`.
    - Hovering reveals the explicit evidence tooltip (FR-2.4, SRS §10.6):
      - Condition A: Number of funding events (≥ 2 required, observed: 4).
      - Condition B: Realized outflow return percentage (≥ 20.0% required, observed: 31.4%).
      - Candidate labels: `REPEATED_FUNDER_CANDIDATE`, `PROFIT_SINK_CANDIDATE`.
  - **Depth-Limited Node:**
    - Stop Reason: `[DEPTH LIMIT (Depth 3/3 reached)]`.
    - Renders action button: `[+ Deep Trace (Extend to 6 Hops)]`.
    - Clicking changes the button into an inline progress bar (`Job #funding-deep-4421 [● 45%]`). When complete, new branches append smoothly without page reload.
  - **Internal-Transaction-Only Funder:**
    - Labeled with badge: `[INTERNAL TX ONLY]`.
    - Explicitly proves that the funder was discovered through an internal contract trace (SRS §10.4).
- **Shared-Funder Auto-Clustering:**
  - Top alert banner highlights shared funder links across tracked wallets.
  - Right drawer (`Evidence & Cluster Drawer`) displays the auto-created cluster card with member wallets, combined stable balance, and cluster color chip.
  - User can quickly override an address's entity type using the "Custom Label Override" tool in the drawer.

---

## 6. Accessibility & Keyboard Support

- **Keyboard Navigation:**
  - Full tab stop order through table filters, rows, and buttons.
  - Table rows support `ArrowUp` / `ArrowDown` navigation; `Space` toggles row selection.
  - `Esc` dismisses modals, drawers, tooltips, and the floating bulk action bar.
- **Focus Rings:** High-contrast 2px Signal Amber (`#D7A84B`) outline with 2px offset on all focused elements.
- **Contrast & Legibility:**
  - Primary text (`#E8ECEF`) on Observatory Canvas (`#101214`) achieves > 11:1 contrast ratio (exceeding WCAG AAA 7:1 requirement).
  - Status indicators always pair a colored dot with an all-caps text label (e.g. `● ARMED`, `● OK`, `● RATE LIMITED`), never relying on color alone.
- **Reduced Motion:** When `prefers-reduced-motion: reduce` is enabled, all transitions and animations are replaced by immediate state changes.
