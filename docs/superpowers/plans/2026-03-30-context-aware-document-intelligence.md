# Context-Aware Document Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make search feel like it can find the right work document, not just a matching filename, by adding context-aware ranking and visible explanations.

**Architecture:** Extend the existing local search core to emit richer ranking metadata, preserve that metadata through the worker and engine, and render it in the current file results and preview surfaces. Keep the implementation local-first, heuristic-driven, and incremental so it strengthens the current desktop workflow without introducing remote services.

**Tech Stack:** React 19, TypeScript, Vitest, IndexedDB, Fuse.js, Transformers.js, Tauri

---

### Task 1: Lock ranking behavior with tests

**Files:**
- Modify: `tests/unit/search-core.test.ts`
- Modify: `src/lib/search/core.ts`

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/search-core.test.ts` and verify the new assertions fail for the expected reason**
- [ ] **Step 3: Implement minimal ranking metadata and heuristics in `src/lib/search/core.ts`**
- [ ] **Step 4: Re-run `npm run test:unit -- tests/unit/search-core.test.ts` until green**

### Task 2: Preserve ranking metadata through the search pipeline

**Files:**
- Modify: `src/lib/search/search.worker.ts`
- Modify: `src/lib/search/engine.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/spotlight/page.tsx`

- [ ] **Step 1: Thread richer search result objects through the worker and UI mapping without breaking existing search flows**
- [ ] **Step 2: Keep search resets and non-search file refresh behavior unchanged**
- [ ] **Step 3: Run targeted type-aware checks with `npm run typecheck`**

### Task 3: Surface confidence and match explanations in the UI

**Files:**
- Modify: `src/components/file-viewer/file-list-item.tsx`
- Modify: `src/components/file-viewer/file-grid-item.tsx`
- Modify: `src/components/file-viewer/file-preview-panel.tsx`
- Modify: `src/lib/i18n/dictionaries/en.json`
- Modify: `src/lib/i18n/dictionaries/vi.json`

- [ ] **Step 1: Show confidence-oriented result labeling in list and grid cards**
- [ ] **Step 2: Add a concise "why this matched" panel and latest-version badge to the preview surface**
- [ ] **Step 3: Keep the current visual language and spacing patterns intact**
- [ ] **Step 4: Run `npm run test:unit -- tests/unit/search-core.test.ts` and `npm run typecheck`**

### Task 4: Final verification

**Files:**
- Modify: `tests/unit/search-core.test.ts`
- Modify: `src/lib/search/core.ts`
- Modify: `src/components/file-viewer/file-preview-panel.tsx`

- [ ] **Step 1: Re-check for over-scoring, empty reasons, and missing fallback behavior**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/search-core.test.ts`**
- [ ] **Step 3: Run `npm run typecheck`**
- [ ] **Step 4: Summarize the visible product change in user-facing terms**
