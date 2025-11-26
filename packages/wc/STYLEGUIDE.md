# UI Style Guide – Contrast and Dark Theme Adjustments

## Contrast Principles

- Minimum contrast ratio 4.5:1 for body text; 3:1 for large text and UI controls.
- Use Shoelace design tokens (`--sl-color-*`) to ensure consistency across themes.
- Prefer `neutral` scale for structural backgrounds and borders; use `primary/success/danger` only for semantic emphasis.

## Dark Theme Tokens

- Containers: `--sl-color-neutral-900` background, `--sl-color-neutral-700` borders.
- Cards and panels: `--card-bg: var(--sl-color-neutral-800)`, `--card-border: 1px solid var(--sl-color-neutral-700)`.
- Text: headings `--sl-color-neutral-100`, body `--sl-color-neutral-200`–`300`.
- Chips/badges: use dark surface with light text (`neutral-800` bg, `neutral-200` text).

## Components Updated

- Sample Table (`e-sample-table`)
  - Table/background: light `neutral-50`; dark `neutral-900`.
  - Thead border: light `neutral-300`; dark `neutral-700`.
  - Cells: background `neutral-0` (light) / `neutral-900` (dark).
  - Hover: `primary-50` (light) / `rgba(255,255,255,0.04)` (dark).

- Stash Tab Container Header
  - Background: light `neutral-50`; dark `neutral-900`.
  - Bottom border: light `neutral-200`; dark `neutral-700`.
  - Subtle shadow added in dark for separation.

- Stash List Rows (map, essence, divination, delve)
  - Row divider: light `neutral-300`; dark `neutral-700`.

- Price Sources Table
  - Table container: `neutral-800` bg and `neutral-700` border in dark.
  - Row hover: stays dark (`neutral-800`) to avoid washout.
  - `sl-badge` inside rows: override `::part(base)` to `neutral-800` bg / `neutral-200` text.

- Tab Badges
  - Default chip background: light `neutral-100`; dark `neutral-800`.
  - Avoid white badge color fallback; use `neutral-500` as default accent.

## Spacing and Separation

- Add `box-shadow` for sticky headers to prevent overlap illusions.
- Maintain 0.75–1rem intra-component gaps for readability.

## Verification Checklist

- Manual scan with dark theme to ensure no white backgrounds behind text.
- Automated: run `vue-tsc` and `tsc` builds; use browser devtools contrast checker aiming for 4.5:1 for body text.
- Cross-browser: test in Chromium-based, Firefox; desktop app via Tauri.
