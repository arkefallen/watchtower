---
name: Watchtower Intelligence
colors:
  surface: '#121416'
  surface-dim: '#121416'
  surface-bright: '#38393c'
  surface-container-lowest: '#0c0e10'
  surface-container-low: '#1a1c1e'
  surface-container: '#1e2022'
  surface-container-high: '#282a2c'
  surface-container-highest: '#333537'
  on-surface: '#e2e2e5'
  on-surface-variant: '#d2c5b1'
  inverse-surface: '#e2e2e5'
  inverse-on-surface: '#2f3133'
  outline: '#9b8f7d'
  outline-variant: '#4f4637'
  surface-tint: '#f0bf5f'
  primary: '#f5c363'
  on-primary: '#412d00'
  primary-container: '#d7a84b'
  on-primary-container: '#583e00'
  inverse-primary: '#7b5800'
  secondary: '#c2c7cc'
  on-secondary: '#2c3135'
  secondary-container: '#42474c'
  on-secondary-container: '#b1b6bb'
  tertiary: '#c9cace'
  on-tertiary: '#2e3134'
  tertiary-container: '#adafb3'
  on-tertiary-container: '#404246'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdea6'
  primary-fixed-dim: '#f0bf5f'
  on-primary-fixed: '#271900'
  on-primary-fixed-variant: '#5d4200'
  secondary-fixed: '#dfe3e8'
  secondary-fixed-dim: '#c2c7cc'
  on-secondary-fixed: '#171c20'
  on-secondary-fixed-variant: '#42474c'
  tertiary-fixed: '#e1e2e6'
  tertiary-fixed-dim: '#c5c6ca'
  on-tertiary-fixed: '#191c1f'
  on-tertiary-fixed-variant: '#44474a'
  background: '#121416'
  on-background: '#e2e2e5'
  surface-variant: '#333537'
  border-hairline: '#30373D'
  text-primary: '#E8ECEF'
  text-muted: '#929BA3'
  status-success: '#79B79A'
  status-error: '#D87870'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  ui-label:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
  mono-data:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  mono-label:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
spacing:
  sidebar-width: 240px
  max-width: 1440px
  gutter: 16px
  margin-base: 24px
  panel-padding: 12px
---

## Brand & Style

The design system is an "Observatory" for onchain intelligence—a cockpit-dense, evidentiary console designed for high-stakes monitoring. The aesthetic is rooted in **Minimalism** and **Technical Industrialism**, prioritizing data density and clarity over decorative flair. It is a tool for operators, not a marketing landing page.

The visual language is defined by:
- **Atmosphere:** Quiet, dark, and focused. It avoids the "neon-crypto" tropes in favor of a grounded, military-grade interface.
- **Density:** High (8/10). Information is packed tightly but organized through rigid structural grids and clear typographic hierarchy.
- **Tone:** Analytical and objective. The UI stays out of the way until a "Signal" requires attention.
- **Style:** Flat, sharp-edged, and monochromatic, punctuated only by functional amber alerts.

## Colors

The palette is strictly functional, utilizing a "Dark Observatory" base to reduce eye strain during long monitoring sessions.

- **Primary (Signal Amber):** Reserved exclusively for focus states, active controls, and critical alerts. It must never exceed 80% saturation to maintain its evidentiary feel.
- **Surface Tiers:** Use **Observatory Canvas** for the base layer. **Graphite Surface** is used for structural panels (sidebar/nav), and **Raised Slate** is used for interactive elements like selected rows or popovers.
- **Borders:** All component boundaries and table rules use the **Hairline Border** (`#30373D`).
- **Semantic Colors:** Green and Red are reserved for verified status and risk states only. They are secondary to the Signal Amber and must never be used for brand expression.
- **Constraint:** No gradients, glows, or pure black (`#000000`).

## Typography

The typography system splits roles between Geist (Proportional) and Geist Mono (Monospaced).

- **Geist:** Used for all UI chrome, headings, and labels. Headings use tight tracking and heavy weights (600-700) but remain small in scale to preserve data density.
- **Geist Mono:** Mandatory for all evidentiary data: wallet addresses, transaction hashes, block numbers, timestamps, and currency balances. This ensures vertical alignment in dense tables.
- **Constraint:** Maximum reading measure for any descriptive text is 65 characters. Avoid all-caps paragraphs.

## Layout & Spacing

This design system follows a **Fixed Grid** philosophy for its primary structure and a fluid model for the workspace.

- **Desktop Structure:** A fixed 240px left sidebar is separated from the main workspace by a 1px vertical divider.
- **Main Workspace:** Fluid width up to a 1440px cap. Content is organized via CSS Grid to create distinct "spatial zones."
- **Data Density:** Use a tight 8px baseline grid. Padding within components (like table cells and input fields) is minimized to maximize the amount of visible data on a 1440x900 viewport.
- **Breakpoints:**
  - **Desktop (1024px+):** Full sidebar and multi-column "Evidence Rail" on the right.
  - **Tablet/Mobile (<768px):** Sidebar collapses to a compact menu. Layout reflows to a single column. Horizontal scrolling is strictly prohibited.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Bold Borders** rather than shadows.

- **The Z-Axis:** Depth is communicated by color shifting rather than light source simulation.
  - Level 0 (Background): #101214
  - Level 1 (Sidebar/Navigation): #171A1D
  - Level 2 (Selected items/Popovers): #1E2327
- **Borders:** All structural separation is handled by 1px rules in `#30373D`. 
- **Focus:** Interactive focus is denoted by a 2px Signal Amber (`#D7A84B`) ring, providing immediate visual feedback for keyboard navigation.
- **Constraint:** No shadows, no blurs, and no translucency. The interface must feel opaque and solid.

## Shapes

The shape language is strictly **Sharp (0px)**. This reinforces the technical, cockpit-like aesthetic and ensures that 1px borders align perfectly with the pixel grid, maintaining maximum crispness.

All buttons, inputs, cards, and tags must use 90-degree corners. The only exception is the Signal Amber status dot used in indicators, which may be circular to distinguish it from structural UI elements.

## Components

- **Buttons:** Compact (height: 40px). 
  - *Primary:* Signal Amber background with Graphite Text. 
  - *Secondary:* Graphite outline (1px) with Primary Text. 
  - *Interaction:* On click/active, the button translates upward by 1px to simulate a mechanical press.
- **Tables:** The core of the system. 1px borders between rows. Sticky headers are mandatory. Text labels are left-aligned; all numeric values (Geist Mono) are right-aligned.
- **Inputs:** Square corners, 1px border. Labels are placed above the field in Geist weight 600. Helper text is Geist Mono weight 400 placed below.
- **Status Indicators:** Never communicate status with color alone. Combine a Signal Amber/Green/Red dot with a text label in all-caps Geist Mono (e.g., `● OK`, `● RATE LIMITED`).
- **Evidence Rail:** A specialized narrow column on the right side of the layout used for streaming logs or specific metadata related to the selected primary object.
- **Data Cells:** For hashes and addresses, use a "Click to Copy" interaction that provides a brief 1s Signal Amber "COPIED" state within the cell.
