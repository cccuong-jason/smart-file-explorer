# RetroUI Transition Design

## Goal

Move Smart File Explorer from a bespoke soft gray/indigo Tailwind interface to a RetroUI-led component system while preserving the desktop file-management workflows, dark mode, i18n strings, Tauri windows, and existing test contracts.

## Source Baseline

RetroUI is a NeoBrutalism styled React and Tailwind component library installed through the shadcn registry. The current app is a Vite React/Tauri app with Tailwind CSS v4, not Next.js, so the install needs a Vite-compatible adaptation:

- Use `components.json` with a RetroUI registry entry.
- Install RetroUI registry components with `npx shadcn@latest add @retroui/<component>`.
- Use local Fontsource packages for RetroUI typography instead of `next/font`.
- Keep the app's existing `--ui-*` tokens during migration so already-modified surfaces continue to render in light and dark mode.

## UI Shift

RetroUI changes the product feel from quiet, soft SaaS panels to a sharper desktop utility with hard borders, high-contrast surfaces, playful accent colors, tactile button motion, and display typography. Because this is a file explorer used for scanning, search, preview, and settings, the transition should be expressive without sacrificing scan density or repeated-use ergonomics.

The UI should adopt RetroUI most strongly in command controls, empty states, mode selectors, modals, and highlighted intelligence panels. High-density file rows, trees, logs, paths, and previews should keep compact spacing and readable typography, using RetroUI borders and tokens rather than oversized decorative composition.

## Architecture

Use a two-layer migration:

1. Foundation layer: shadcn registry config, RetroUI components under `src/components/retroui`, shared `cn` helper, Tailwind v4 theme tokens, local fonts, and compatibility aliases.
2. Surface layer: migrate visible components one workflow at a time, replacing ad hoc button/card styles with RetroUI components and shared local wrappers only when repetition appears.

Do not introduce a second full design system. RetroUI is the direction; old bespoke classes are legacy until each surface is migrated.

## Transition Order

1. Foundation and tokens
   - Install registry support and RetroUI Button.
   - Define `font-head`, `primary-hover`, `secondary-hover`, `background`, `foreground`, `card`, `border`, and existing `--ui-*` compatibility tokens.
   - Verify typecheck and focused UI tests.

2. Command controls
   - Replace primary buttons in scan, settings, file actions, pagination, onboarding, and modal footers with RetroUI Button.
   - Keep icon-only controls compact and accessible.
   - Avoid changing data flow or event handlers.

3. App shell and sidebar
   - Convert sidebar, filter groups, drag/drop scan panel, mode selector, sort controls, and footer pagination to hard-border RetroUI surfaces.
   - Preserve existing resizable layout behavior.

4. File browsing surfaces
   - Migrate file list item, grid item, tree item, preview panel, and quick-look modal.
   - Prioritize selected, hover, favorite, score, and OCR states because these are interaction-heavy.

5. Intelligence and monitoring panels
   - Migrate Work Inbox, workspace drill-in, folder intelligence, telemetry/log surfaces, and tray activity.
   - Keep dense status and diagnostic content scannable.

6. Regression pass
   - Run unit tests, typecheck, regression tests, UI tests where available, and a visual smoke pass for light/dark themes.
   - Remove old token aliases only after all components stop depending on them.

## Risks

- RetroUI components expect theme classes such as `font-head` and hover color tokens. Missing tokens can compile but render wrong.
- The app currently contains many hand-authored Tailwind classes in large files, especially `src/app/page.tsx`; broad find/replace would be risky.
- Some old tests assert exact token strings, so migration should update assertions only when the component has intentionally moved to RetroUI tokens.
- Dark mode can regress easily because RetroUI's high contrast relies on border and foreground tokens being paired correctly.

## Testing Strategy

- Add focused component tests for each migrated shared control.
- Keep existing behavior tests for scan controls, settings, file selection, tree expansion, inbox actions, and theme/i18n.
- Use typecheck after introducing registry components.
- Use UI/regression tests after visible shell or modal changes.

