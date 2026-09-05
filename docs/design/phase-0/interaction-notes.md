# P0-D01 interaction notes

- Keyboard order follows sidebar → page title/actions → system status → quota
  sections → evidence links. Focus is always visible with the amber ring.
- Provider state is never conveyed by color alone: every indicator includes a
  text label and keeps its provider name visible.
- The timestamp control has three explicit choices: local `APP_TIMEZONE`, UTC,
  and block number. The selected value is announced to assistive technology.
- `UNKNOWN` is a first-class value for an unpublished provider limit. It is not
  rendered as zero, an empty progress bar, or a guessed percentage.
- Loading preserves the final row and column dimensions. Degraded and quota
  exhausted states replace the affected provider’s content in place.
- Refresh is an explicit local data refresh action. The page never performs an
  external provider request from the browser.
- Bull Board is a secondary operational link and must be clearly labeled as a
  local queue inspection surface.
- At 1440×900 the title, overall state, and first provider rows are visible.
  At smaller widths the provider grid becomes one column without horizontal
  scrolling.
- Contrast target: normal text ≥ 4.5:1, large text ≥ 3:1, and focus indicator
  remains distinguishable against both Canvas and Raised Slate.
