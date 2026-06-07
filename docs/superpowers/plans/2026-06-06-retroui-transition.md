# RetroUI Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the app UI approach to RetroUI in safe, reviewable stages.

**Architecture:** RetroUI is introduced through the shadcn registry and `src/components/retroui`, with Tailwind v4 theme tokens providing the shared visual contract. Existing `--ui-*` tokens stay as a compatibility bridge until all major surfaces have moved.

**Tech Stack:** React 19, Vite, Tauri 2, Tailwind CSS v4, shadcn registry, RetroUI, Base UI, Fontsource, Vitest, Playwright.

---

## File Structure

- `components.json`: shadcn registry configuration, including RetroUI registry alias.
- `src/components/retroui/Button.tsx`: installed RetroUI Button component.
- `src/lib/utils.ts`: shared `cn` helper required by registry components.
- `src/app/globals.css`: RetroUI font, color, border, radius, hover, and compatibility tokens.
- `tests/unit/ui-components.test.tsx`: focused shared component assertions.
- Future surface files:
  - `src/app/page.tsx`: app shell, sidebar, command controls.
  - `src/components/search/search-input.tsx`: search field and suggestions.
  - `src/components/sidebar/filter-section.tsx`: filter groups.
  - `src/components/ui/pagination.tsx`: paging controls.
  - `src/components/ui/progress-bar.tsx`: scan progress.
  - `src/components/settings/settings-modal.tsx`: settings tabs and forms.
  - `src/components/file-viewer/*.tsx`: list, grid, tree, preview, quick look.
  - `src/components/folder-intelligence/*.tsx`: inbox and workspace intelligence panels.
  - `src/components/tray-activity/tray-activity-pill.tsx`: tray status surface.

## Task 1: Foundation Install And Tokens

**Files:**
- Create: `components.json`
- Create: `src/components/retroui/Button.tsx`
- Create: `src/lib/utils.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/ui-components.test.tsx`

- [x] **Step 1: Initialize shadcn for Vite/Base UI**

Run: `npx shadcn@latest init --template vite --base base --preset nova --yes`

Expected: `components.json`, `src/lib/utils.ts`, and registry support are created.

- [x] **Step 2: Add RetroUI Button**

Run: `npx shadcn@latest add @retroui/button --yes`

Expected: `src/components/retroui/Button.tsx` is created and Base UI dependencies are installed.

- [x] **Step 3: Install RetroUI local fonts**

Run: `npm install @fontsource/archivo-black @fontsource-variable/space-grotesk`

Expected: both packages appear in `package.json` and `package-lock.json`.

- [x] **Step 4: Replace generated shadcn font with RetroUI tokens**

Expected:
- `src/app/globals.css` imports Archivo Black and Space Grotesk.
- `@theme inline` defines `--font-head`.
- `--primary-hover` and `--secondary-hover` are defined for RetroUI Button.
- Existing `--ui-*` variables still exist for legacy surfaces.

- [x] **Step 5: Add focused RetroUI Button test**

Run: `npm run test:unit -- tests/unit/ui-components.test.tsx`

Expected: RetroUI button renders with `font-head`, hard border, `bg-primary`, and `hover:bg-primary-hover`.

## Task 2: Command Controls

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ui/pagination.tsx`
- Modify: `src/components/ui/progress-bar.tsx`
- Modify: `src/components/onboarding/starter-scan-modal.tsx`
- Modify: `src/components/file-viewer/file-preview-panel.tsx`
- Test: `tests/unit/ui-components.test.tsx`
- Test: relevant existing unit tests for touched components

- [x] **Step 1: Replace primary action buttons with RetroUI Button**

Use:

```tsx
import { Button } from '@/components/retroui/Button';
```

Replace only command controls first: scan, settings open, pagination arrows/pages, pause/resume, onboarding browse/start, quick file actions.

- [x] **Step 2: Keep icon controls compact**

Use `size="icon"` for icon-only controls and preserve `title`/accessible labels.

- [x] **Step 3: Verify behavior**

Run: `npm run test:unit -- tests/unit/ui-components.test.tsx tests/unit/settings-modal.test.tsx tests/unit/tray-activity-pill.test.tsx`

Expected: no behavior regressions.

## Task 3: Shell And Sidebar Surfaces

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/sidebar/filter-section.tsx`
- Modify: `src/components/layout/resizable-layout.tsx`
- Test: `tests/unit/light-mode-surfaces.test.tsx`
- Test: `tests/ui-i18n-theme.test.mjs`

- [x] **Step 1: Convert shell panels to hard-border surfaces**

Use `bg-card`, `text-card-foreground`, `border-2`, `border-border`, compact radius, and restrained shadows.

- [x] **Step 2: Convert filter selected states**

Replace soft gray/indigo classes with `bg-secondary`, `bg-muted`, `text-foreground`, and `border-border`.

- [x] **Step 3: Verify light/dark compatibility**

Run: `npm run test:unit -- tests/unit/light-mode-surfaces.test.tsx`

Run: `npm run test:regression`

Expected: tokenized surface assertions pass in both theme-sensitive tests.

## Task 4: File Browser And Preview Surfaces

**Files:**
- Modify: `src/components/file-viewer/file-list-item.tsx`
- Modify: `src/components/file-viewer/file-grid-item.tsx`
- Modify: `src/components/file-viewer/tree-view.tsx`
- Modify: `src/components/file-viewer/file-preview-panel.tsx`
- Modify: `src/components/file-viewer/quick-look-modal.tsx`
- Test: `tests/unit/tree-view-component.test.tsx`
- Test: `tests/unit/quick-look-modal.test.tsx`

- [x] **Step 1: Migrate selected and hover states**

Use clear hard borders and non-layout-shifting shadows.

- [x] **Step 2: Preserve dense metadata layout**

Do not increase row height or path wrapping beyond current behavior unless a test or screenshot shows clipping.

- [x] **Step 3: Verify file browsing**

Run: `npm run test:unit -- tests/unit/tree-view-component.test.tsx tests/unit/quick-look-modal.test.tsx`

Expected: selection, expansion, preview actions, and quick-look behavior remain intact.

## Task 5: Intelligence, Settings, And Tray Surfaces

**Files:**
- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/components/folder-intelligence/work-inbox-panel.tsx`
- Modify: `src/components/folder-intelligence/folder-intelligence-panel.tsx`
- Modify: `src/components/folder-intelligence/workspace-drill-in-modal.tsx`
- Modify: `src/components/tray-activity/tray-activity-pill.tsx`
- Test: `tests/unit/settings-modal.test.tsx`
- Test: `tests/unit/work-inbox-panel.test.tsx`
- Test: `tests/unit/workspace-drill-in-modal.test.tsx`
- Test: `tests/unit/tray-activity-pill.test.tsx`

- [x] **Step 1: Migrate modal frames and tabs**

Apply RetroUI tokens to modal shells, tabs, toggles, and destructive actions.

- [x] **Step 2: Migrate intelligence panels**

Keep information hierarchy scannable while moving cards/pills to hard-bordered RetroUI surfaces.

- [x] **Step 3: Verify workflows**

Run the listed unit tests.

Expected: settings actions, inbox actions, drill-in navigation, and tray activity status still pass.

## Task 6: Full Verification And Cleanup

**Files:**
- Modify only files still depending on legacy-only styling.

- [x] **Step 1: Search remaining old palette usage**

Run: `rg "indigo|rounded-2xl|rounded-3xl|shadow-2xl|bg-gray|dark:bg-gray" src/app src/components`

Expected: remaining matches are intentional, documented, or queued for follow-up.

- [x] **Step 2: Run quality gates**

Run:

```bash
npm run typecheck
npm run test:unit
npm run test:regression
npm run build
```

Expected: all pass.

- [x] **Step 3: Visual smoke**

Run the app and inspect main, spotlight, tray activity, settings, quick look, and onboarding in light and dark mode.

Expected: no overlapping text, missing fonts, blank surfaces, unreadable contrast, or broken core actions.
