# P4-D01 Interaction Notes: Phase 4 Alert Engine & Settings

Stitch project: `projects/17665303442847236685`  
Design system asset: `assets/ef5e0976c569407993cc376fc3c2698b` (Watchtower Intelligence)  
Screens:
- `/alerts` (Stitch Screen ID: `c4914942d6f64a10b516c2aa9d84d61f`)
- `/settings` (Stitch Screen ID: `1965883e606a40f79eae812c05b02490`)

---

## 1. Information Architecture & Workspace Layout

### Alert Center (`/alerts`)
The Alert Center uses a cockpit-dense layout (8/10 density) built for fast triage and evidentiary audit:

1. **Left Navigation Rail (240px Fixed):**
   - Active highlight on `Alerts` with Signal Amber indicator.
   - Dynamic unread counter badge `[3]` displayed next to the label. Decrements immediately on acknowledge; zeroes out on "Mark all read".

2. **Top Intelligence Banner:**
   - Page title `ALERT_CENTER` with subtitle `Real-time state transitions, rule evaluations, and evidence auditing`.
   - **4 KPI Metric Cards:**
     - *Total Active Alerts:* Total count in window.
     - *Armed Wallets:* Wallets currently in `ARMED` state with Signal Amber dot.
     - *Triggered Wallets:* Wallets currently in `TRIGGERED` state with Coral Red dot.
     - *Exit Risk Warnings:* Wallets with active C1–C4 annotations.
   - Action controls: `Mark All Read` and `Evaluate Now` manual trigger.

3. **Multi-Dimensional Filter Bar:**
   - State filter tabs: `ALL`, `ARMED`, `TRIGGERED`, `EXIT_RISK`.
   - Rule category dropdown: `All Rules`, `A1–A6 Arming`, `T1–T5 Triggers`, `C1–C4 Exit Risk`.
   - Wallet filter input with autocomplete.
   - Token search input.
   - `Unread Only` toggle switch.

4. **Alerts Data Table & Evidence Rail:**
   - Sticky table header, 1px `#30373D` hairline rules.
   - Columns: `Timestamp` (UTC/local toggle), `Alert Type & Badge`, `Wallet Chip` (with cluster dot + tags), `State Badge`, `Token`, `Trigger USD Amount`, `Evidence Trail`, `Actions`.
   - **Evidence Tooltip / Popover Interaction:**
     - Hover or click on the Evidence icon opens the **Evidence Tooltip / Rail**:
       - Exact rule description (e.g. `A1 — Stablecoin arming`).
       - Configured thresholds vs binding arm (e.g. `max($1,000, 3x median $200 = $600) → Binding: Floor $1,000`).
       - Observed values with timestamps.
       - Evaluation window boundaries.
       - Cluster context (for A5 and T5).
       - Direct block explorer tx link `[↗]`.

---

### Settings Console (`/settings`)
The Settings page provides a safe, DB-backed control panel for tuning all state machine parameters:

1. **Top Header & State Bar:**
   - Title `Watchtower / Settings` with `Save Changes` primary button (Signal Amber `#D7A84B` push button).
   - Live DB status indicator: `● SETTINGS LOADED FROM LOCAL DB`.

2. **Section 1 — Alert Thresholds & Rules (A1–C4):**
   - **A1 (Stablecoin Arming):** Min floor USD (default `$1,000`), Median multiple (default `3.0x`).
   - **A2 (Gas Arming, Decision D-4):** Min floor USD (default `$100`), Median multiple (default `3.0x`). Helper callout: *"Cold-start rule: floor-only ($100) binds until wallet has ≥ 7 qualifying single-day inflow days."*
   - **A3 (CEX Withdrawal):** Min USD threshold (default `$1,000`).
   - **A4 (Dormancy Wake):** Inactivity threshold (default `30` days), min funding amount (default `$500`).
   - **A5 (Cluster Arming):** Evaluation window (default `48` hours), min member wallets (default `2`).
   - **T1 (Armed Entry):** Max token age (default `7` days), min position amount (default `$500`).
   - **T2 (Independent Co-Entry):** Window (default `24` hours), min wallets (default `2`).
   - **Graded Definition (Decision D-5):** Select dropdown: `ANY_TAG_OR_COMPUTED` (default: any manual tag or sufficient auto-grade) vs `EDGE_TAG_ONLY` (manual edge tag only).
   - **C3 Scope Control (Decision D-7):** Toggle `c3SelfOnly` (default false): when false, monitors all tracked wallets with prominent styling on `isSelf` trades; when true, restricts C3 moon discipline to self wallets only.
   - **De-Arm Parameters:** Baseline threshold percentage (default `120%`), consecutive days requirement (default `7` days).

3. **Section 2 — Cadence & System Limits:**
   - Radar & Alert evaluation cadence (default `5` minutes).
   - Quota reserve limit (default `10%`).

4. **Section 3 — Optional Telegram Delivery (FR-5.3):**
   - `Enable Telegram Notifications` toggle (default off).
   - `Bot Token` (password-masked input) & `Chat ID` input.
   - `Send Test Message` action button with live inline result indicator.

5. **Section 4 — Maintenance & Data Retention (NFR-5, NFR-6, Decision D-10):**
   - Backup staleness card: `● BACKUP HEALTHY — Last backup: 2 days ago` (switches to warning treatment when older than 7 days).
   - `Run Manual Backup` button (`pg_dump` into `./backups/`).
   - `Prune Token History` utility with confirmation modal requiring typing `PRUNE` to confirm.

---

## 2. Degraded & Edge States Specification

1. **Cold-Start Wallet Baselines (Decision D-4):**
   - When a wallet has fewer than 7 qualifying daily flow days, its median is reported as `UNAVAILABLE`.
   - A1 and A2 fall back to their absolute floor thresholds (`$1,000` and `$100` respectively).
   - The Evidence Tooltip explicitly notes: `Median unavailable (< 7 days history) — Evaluated against floor only`.

2. **Malformed or Missing Evidence Blob:**
   - If an `AlertEvent` is missing `ruleText`, `thresholds`, or `txLinks`, the UI renders:
     `⚠️ MALFORMED EVIDENCE: Missing required fields` in Coral Red with error details, rather than rendering an empty tooltip or crashing.

3. **Telegram API Failure:**
   - If Telegram delivery fails, the error message returned by Telegram API is stored in `AlertEvent.deliveryError` and displayed in the UI as `⚠️ Delivery failed: <reason>` without failing the alert evaluation itself.

4. **Null USD Value Guard:**
   - For unpriced tokens or native movements where USD cannot be computed, null USD never satisfies a `>=` comparison. The rule evaluates to false and does not trigger.

---

## 3. Accessibility & WCAG 2.2 Compliance

- **Non-Color State Communication:** All states combine text labels and icons (`ARMED [●]`, `TRIGGERED [▲]`, `EXIT_RISK [■]`, `IDLE [○]`).
- **Contrast Ratios:** Primary text `#E8ECEF` on canvas `#101214` gives 13.8:1 contrast (well above 4.5:1 requirement).
- **Keyboard Navigation:** Full tab order across filters, table rows, evidence expanders, and form inputs. Focus ring uses 2px Signal Amber `#D7A84B`.
