# Phase 6 Stitch UI Prompts

## Screen 1: Watchtower Token Intelligence Console (`/tokens/[chain]/[address]`)

**Stitch Screen ID:** `cda198fa23bd4abf9c241a948985dbcd`  
**Title:** Watchtower Token Intelligence: $PEPE  
**Device:** Desktop (1440px+)  
**Theme:** Observatory Dark (#101214, #171A1D, #1E2327, #30373D, Signal Amber #D7A84B)

### Prompt Text
```
Dark theme trading intelligence console for Watchtower Token Lookup and Intelligence (/tokens/[chain]/[address]).
Observatory aesthetic: deep canvas #101214, card background #171A1D, raised slate #1E2327, border #30373D, signal amber #D7A84B, emerald #22c55e, crimson #ef4444, sharp 0px corners, dense monospace data.
Top bar: Watchtower breadcrumb, token search input with chain selector (Base, BSC, Robinhood), refresh button with non-blocking BullMQ status.
Token Header: Symbol $PEPE, Name Pepe, Address 0x69825...d46, Deployed 184 days ago, Deployer 0xabc...123, Price $0.0000084, Market Cap $3.5B.
Tracked Wallet Holders: Dense table with columns Wallet / ENS, Grade Badge (A, B, C), Computed Label (SMART-RIDER [W]), Entry Market Cap ($120M), Current Status (HOLDING in emerald, DISTRIBUTED in amber, EXITED in crimson), Tracked Holdings ($450,000), Tracked Supply Share (1.4%).
Netflow History: Tracked wallets cumulative netflow chart and 24h/7d inflow-outflow breakdown.
Red Flags & Warnings Panel:
- Paid Promoter Warning: Tracked wallet 0x71C...3a9 received 500M tokens directly from deployer in tx 0x98f...2a1 (High Risk / Amber Warning).
- Explorer Supply Concentration: Top 10 holders own 42.8% of circulating supply.
- Cluster Presence: Cluster #4 (3 wallets) and Cluster #8 (2 wallets) hold active positions.
Supply Concentration KPI: Tracked wallets hold 3.8% of total supply. All data queried under 3s from local DB.
```

---

## Screen 2: Watchtower Operations & Maintenance Console (`/health` & `/settings`)

**Stitch Screen ID:** `7e24c4866b9d4d8d808010b79d7a474e`  
**Title:** Watchtower Operations & Maintenance Console  
**Device:** Desktop (1440px+)  
**Theme:** Observatory Dark (#101214, #171A1D, #1E2327, #30373D, Signal Amber #D7A84B, Crimson #EF4444)

### Prompt Text
```
Dark theme Watchtower Operations & Maintenance Console (/health and /settings maintenance tab).
Observatory aesthetic: deep canvas #101214, card background #171A1D, raised slate #1E2327, border #30373D, signal amber #D7A84B, crimson #ef4444.
Top section:
1. Backup Health Alert Banner (Non-blocking): Amber warning showing "Newest backup is 8 days old (or No backup exists). Last: 2026-08-29. Run 'npm run backup' to generate timestamped pg_dump."
2. Provider Quota & Usage Table: Etherscan, DexScreener, Robinhood Provider showing Calls Today (e.g. 14,200), Daily Limit (100,000), Remaining (85,800), and Rate Limit Hits (0).
3. Data Retention & Prune Utility (Manual Token History Prune):
   - Searchable token address input and chain selector.
   - Danger modal/box: "Prune Token History - permanently deletes transactions, movements, snapshots, positions, and flows for this token only. Other tokens unaffected."
   - Explicit confirmation required: User must type "PRUNE" to enable the button.
   - Audit report showing exact deleted row counts per table (transactions: 42, positions: 2, movements: 15, snapshots: 80).
4. Rebuild Derivations Section: Action buttons to rebuild positions, flows, and graphs from raw transactions without data loss.
All components sharp 0px corners, high density data, dark theme.
```
