# Full Logs Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full local diagnostics and structured logging feature that captures frontend/native app activity, exposes recent logs in Settings, and exports a support bundle for debugging watch, tray, tree, scan, indexing, and search issues.

**Architecture:** Add a focused frontend telemetry module with a bounded recent-event buffer, stable event schema, subscriptions, and Tauri forwarding. Extend Rust with structured frontend event intake, diagnostic snapshots, and diagnostic bundle export. Add a Diagnostics tab to Settings and instrument the failure-prone flows with correlation IDs and structured events.

**Tech Stack:** React 19, TypeScript, Vitest, Tauri v2, Rust, serde/serde_json, tauri-plugin-log.

---

### Task 1: Frontend Telemetry Core

**Files:**
- Modify: `src/lib/telemetry/logger.ts`
- Test: `tests/unit/telemetry-logger.test.ts`

- [x] Write failing tests for event normalization, redaction, bounded recent-event storage, subscriptions, and safe invoke failure handling.
- [x] Run `npm run test:unit -- tests/unit/telemetry-logger.test.ts` and verify RED.
- [x] Implement `logEvent`, `getRecentLogEvents`, `subscribeToLogEvents`, `clearRecentLogEvents`, `createLogEvent`, and compatibility `logFrontendMessage`.
- [x] Run the focused telemetry tests and verify GREEN.

### Task 2: Native Diagnostics Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Test: existing Rust unit test section in `src-tauri/src/lib.rs`

- [x] Add Rust structs for structured frontend log events and diagnostic snapshots.
- [x] Store recent frontend events in `AppState`.
- [x] Add commands: `log_frontend_event`, `get_diagnostic_snapshot`, `export_diagnostic_bundle`.
- [x] Keep `log_frontend_message` as compatibility wrapper.
- [x] Add Rust tests for path normalization/snapshot helper behavior where feasible.

### Task 3: Frontend Diagnostics API

**Files:**
- Create: `src/lib/telemetry/diagnostics.ts`
- Test: `tests/unit/diagnostics.test.ts`

- [x] Write failing tests for snapshot/export wrappers and fallback behavior outside Tauri.
- [x] Implement typed wrappers around native commands plus frontend fallback snapshot.
- [x] Verify focused tests pass.

### Task 4: Settings Diagnostics UI

**Files:**
- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/lib/i18n/dictionaries/en.json`
- Modify: `src/lib/i18n/dictionaries/vi.json`
- Test: `tests/unit/settings-modal.test.tsx`
- Test: `tests/ui-i18n-theme.test.mjs`

- [x] Add Diagnostics tab with summary cards, recent event list, level/area filters, refresh, copy summary, export bundle, and clear local buffer.
- [x] Add EN/VI translations and regression keys.
- [x] Add tests proving the tab renders, filters events, and calls export/copy actions.

### Task 5: Instrument Critical Flows

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/tray-activity/page.tsx`
- Modify: `src/lib/file-system/indexing-coordinator.ts`
- Modify: `src/lib/file-system/scanner.ts`
- Modify: `src/lib/search/engine.ts`
- Modify: `src/lib/file-browser/tree-view.ts`

- [x] Log watch events with correlation IDs from native payload/path through metadata resolution and indexing enqueue.
- [x] Log scan/indexing lifecycle events and failures.
- [x] Log tray show/hide/detected/open actions without importing heavy indexing stack.
- [x] Log tree build summaries including roots/files/unmatched counts.
- [x] Log search worker failures through structured events.

### Task 6: Verification

**Commands:**
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:regression`
- `npm run build`
- `git diff --check`

- [x] Run all verification commands.
- [x] Audit that all explicit full logs feature requirements are covered by code/tests.
