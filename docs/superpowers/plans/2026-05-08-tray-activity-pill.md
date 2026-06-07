# Tray Activity Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a small floating progress pill only when a watched-folder file is newly detected and being indexed while the main app is hidden to tray.

**Architecture:** Reuse the existing Tauri hidden-window pattern to add a compact always-on-top `tray-activity` webview, then drive it from the current background watch and indexing pipeline instead of creating a second indexing system. Keep the visibility model event-driven and transient: show on new watched-file activity, update during indexing, show a short completion state, then auto-hide.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Vitest

---

### Task 1: Lock tray activity state behavior with tests

**Files:**
- Create: `src/lib/tray-activity/state.ts`
- Create: `tests/unit/tray-activity-state.test.ts`

- [ ] **Step 1: Write failing tests** for the tray pill state reducer/helpers covering:
  - no activity for passive watcher idle state
  - show activity when a brand-new watched file starts background indexing
  - ignore updates for existing files that are not new watched additions
  - emit a completion state and expiry timestamp when indexing finishes
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/tray-activity-state.test.ts` and verify the new assertions fail for the expected reason**
- [ ] **Step 3: Implement the minimal tray activity state helpers in `src/lib/tray-activity/state.ts`**
- [ ] **Step 4: Re-run `npm run test:unit -- tests/unit/tray-activity-state.test.ts` until green**

### Task 2: Add the tray activity pill surface

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Create: `src/app/tray-activity/page.tsx`
- Create: `src/components/tray-activity/tray-activity-pill.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/lib/i18n/dictionaries/en.json`
- Modify: `src/lib/i18n/dictionaries/vi.json`

- [ ] **Step 1: Add a hidden `tray-activity` Tauri window** that is transparent, always-on-top, non-taskbar, and positioned like a lightweight utility surface
- [ ] **Step 2: Build the tray pill UI** with compact indexing and completion states, progress bar, current file label, and click-to-open affordance
- [ ] **Step 3: Keep light and dark mode tokenized** so the pill matches the existing theme system instead of hard-coded dark values
- [ ] **Step 4: Run targeted UI/unit coverage for the new component if needed, then `npm run typecheck`**

### Task 3: Bridge background watch/index events into the tray activity window

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/lib/file-system/indexing-coordinator.ts`
- Modify: `src/lib/file-system/watch-events.ts`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Mark only brand-new watched-folder additions as tray-activity candidates** at the point where watch events are resolved
- [ ] **Step 2: Extend coordinator events or frontend orchestration** so background indexing progress for those candidates can update the tray pill without affecting foreground scan behavior
- [ ] **Step 3: Add Tauri commands/events to show, update, and hide the `tray-activity` window**, including reopening the main window when the pill is clicked
- [ ] **Step 4: Re-run focused tests for tray activity state and existing watch/indexing behavior**

### Task 4: Final verification

**Files:**
- Modify: `tests/unit/tray-activity-state.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Verify the pill only appears for new watched-file additions while the main window is hidden**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/tray-activity-state.test.ts tests/unit/watch-events.test.ts tests/unit/indexing-coordinator.test.ts`**
- [ ] **Step 3: Run `npm run typecheck`**
- [ ] **Step 4: If desktop window tests are practical here, run them; otherwise document that manual tray-window verification is still needed**
