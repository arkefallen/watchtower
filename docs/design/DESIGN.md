# Design System: Watchtower

## 1. Visual Theme & Atmosphere

Watchtower is a cockpit-dense, desktop-first onchain intelligence console:
quiet, evidentiary, and alert without becoming theatrical. The interface should
feel like a dark observatory for wallet behavior—large uninterrupted work
surfaces, sharp data hierarchy, and restrained motion that helps the operator
notice change. Density is 8/10, variance is 5/10, and motion is 3/10. Use
asymmetry only to establish a clear primary work area and a compact evidence
rail; do not turn the dashboard into a decorative marketing page.

## 2. Color Palette & Roles

- **Observatory Canvas** (`#101214`) — application background; never pure black.
- **Graphite Surface** (`#171A1D`) — navigation and structural panels.
- **Raised Slate** (`#1E2327`) — selected rows, popovers, and elevated controls.
- **Hairline Border** (`#30373D`) — table rules and component boundaries.
- **Primary Text** (`#E8ECEF`) — labels, values, and high-priority evidence.
- **Muted Text** (`#929BA3`) — metadata, timestamps, and helper text.
- **Signal Amber** (`#D7A84B`) — the single accent for focus, active controls,
  attention states, and the Watchtower mark. Saturation stays below 80%.
- **Verified Green** (`#79B79A`) — semantic success only, never a second brand
  accent.
- **Risk Red** (`#D87870`) — triggered/error states only.

Do not use purple or blue neon, gradients, outer glows, or decorative color
noise. Semantic green and red are reserved for status meaning and must not be
used as competing primary actions.

## 3. Typography Rules

- **Display and headings:** Geist, weight 600–700, tight tracking, controlled
  sizes from 1.25rem to 2rem. Avoid oversized hero typography.
- **Body and UI labels:** Geist, weight 400–600, 0.875rem–1rem, relaxed enough
  for dense tables without sacrificing scan speed.
- **Numbers and chain metadata:** Geist Mono, especially balances, block
  numbers, addresses, hashes, quota counts, and timestamps.
- **Maximum reading measure:** 65ch for explanatory text.
- **Banned:** Inter, generic serif fonts, fake precision, all-caps paragraphs,
  and invented metrics.

## 4. Component Stylings

- **Buttons:** compact 40px desktop controls with a clear text label; primary
  uses Signal Amber with dark text, secondary is a graphite outline. Active
  state translates upward by 1px; focus uses a 2px amber ring. Minimum 44px
  touch target on narrow screens.
- **Cards:** use sparingly. Prefer border-top dividers and negative space for
  high-density data. A raised panel is reserved for evidence, quota detail, or
  an actionable warning.
- **Tables:** left-aligned labels, right-aligned numeric columns, 1px rules,
  sticky headers, row hover using Raised Slate, and visible keyboard focus.
- **Status:** use text plus a small indicator, never color alone. States are
  `OK`, `DEGRADED`, `UNKNOWN`, `RATE LIMITED`, and `OFFLINE`.
- **Inputs:** label above field, helper/error text below, no floating labels.
- **Loading:** skeleton rows and quota bars matching final geometry; no generic
  spinner-only states.
- **Empty/error states:** explain the next local action and preserve the
  surrounding layout so the page does not jump.
- **Time cells:** show local `APP_TIMEZONE` time by default with a direct
  `UTC / block` toggle; block numbers use Geist Mono.

## 5. Layout Principles

Use a 240px left sidebar, a 1px structural divider, and a fluid main workspace
with a maximum content width of 1440px. The health page uses a 2-column grid:
wide system/provider status on the left and a narrow operational evidence rail
on the right. Keep the primary heading and the latest system state visible
without scrolling at 1440×900.

Use CSS Grid over percentage math. Keep every element in its own spatial zone;
no overlapping labels, floating decorative objects, or absolute-positioned
content stacks. Below 768px, collapse to one column and replace the sidebar
with a compact menu. Never introduce horizontal scrolling.

## 6. Motion & Interaction

Motion is functional and restrained: animate only opacity and transforms with
short ease-out transitions. Stagger status rows by at most 40ms. Quota changes
may pulse the numeric value once, but must not loop indefinitely. Respect
`prefers-reduced-motion`; in that mode use immediate state changes.

## 7. Anti-Patterns (Banned)

- No emojis, purple/blue neon, gradients, or outer glows.
- No Inter, generic serif fonts, pure black, or fake metrics.
- No three-equal-card dashboard row used as filler.
- No marketing hero, decorative stock imagery, or “next-gen” copy.
- No fabricated quota limits; render `UNKNOWN` when a provider publishes none.
- No color-only status communication.
- No overlapping elements or horizontal overflow.
- No automatic external calls from a page; health data is server-provided.
