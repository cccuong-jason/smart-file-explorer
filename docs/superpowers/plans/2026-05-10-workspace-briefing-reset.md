# Workspace Briefing Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current heuristic-feeling inbox and folder intelligence surfaces with trustworthy workspace briefing cards and dashboards that lead with evidence, current-truth detection, and watched-root level workspace understanding.

**Architecture:** Split the current `FolderInsight` blob into a clearer workspace briefing pipeline: deterministic facts and signals first, then evidence-backed recommendations, then optional AI summary generation. Keep watched folders as the workspace unit, reuse the existing page-level selection/preview flow, and evolve the current inbox/panel/modal surfaces instead of inventing a parallel navigation model.

**Tech Stack:** React 19, TypeScript, Vitest, IndexedDB/localStorage, Tauri, existing i18n dictionaries

---

### Task 1: Separate workspace briefing facts from presentation copy

**Files:**
- Create: `src/lib/folder-intelligence/briefing.ts`
- Modify: `src/lib/folder-intelligence/workspaces.ts`
- Modify: `tests/unit/folder-intelligence.test.ts`

- [ ] **Step 1: Write failing tests for a workspace briefing shape that distinguishes facts, signals, and recommendations**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/folder-intelligence.test.ts` and verify the new assertions fail for missing fields or outdated structure**
- [ ] **Step 3: Introduce a briefing-oriented model in `src/lib/folder-intelligence/briefing.ts` with explicit sections for facts, current-truth signals, version pressure, searchability health, and recommendation evidence**
- [ ] **Step 4: Refactor `buildFolderInsights` in `src/lib/folder-intelligence/workspaces.ts` to either return the new model directly or become a compatibility wrapper over the new briefing builder**
- [ ] **Step 5: Keep watched-root identity (`id`, `path`, `title`) stable so existing UI selection and persistence do not break during the migration**
- [ ] **Step 6: Re-run `npm run test:unit -- tests/unit/folder-intelligence.test.ts` until green**

### Task 2: Make current-truth detection the primary intelligence signal

**Files:**
- Modify: `src/lib/folder-intelligence/workspaces.ts`
- Modify: `tests/unit/folder-intelligence.test.ts`
- Modify: `tests/unit/work-inbox.test.ts`

- [ ] **Step 1: Add failing tests for likely-current detection, competing-version grouping, and low-confidence ambiguity cases**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/folder-intelligence.test.ts tests/unit/work-inbox.test.ts` and confirm the new cases fail for the expected reason**
- [ ] **Step 3: Rework scoring so the top signal is `current truth`, not generic workspace score, using recency, filename/version cues, stars, recent opens, semantic centrality, and full-searchability status**
- [ ] **Step 4: Emit a confidence level plus 2-4 explicit evidence badges for the chosen current file**
- [ ] **Step 5: Preserve ambiguity by returning a lower-confidence state when competing variants are too close instead of overclaiming one winner**
- [ ] **Step 6: Re-run `npm run test:unit -- tests/unit/folder-intelligence.test.ts tests/unit/work-inbox.test.ts` until green**

### Task 3: Add “changed since last visit” and workspace-level evidence memory

**Files:**
- Modify: `src/lib/work-inbox/activity.ts`
- Modify: `src/app/page.tsx`
- Modify: `tests/unit/work-inbox-activity.test.ts`

- [ ] **Step 1: Add failing tests for last-visit tracking at the workspace level and for deriving new/changed file counts from that baseline**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/work-inbox-activity.test.ts` and verify the new assertions fail**
- [ ] **Step 3: Extend the activity snapshot to store enough workspace visit state to compute “changed since last visit” without introducing server state**
- [ ] **Step 4: Update the page-level effects in `src/app/page.tsx` so opening a workspace card, drill-in, or file records the right workspace visit moments without spamming updates**
- [ ] **Step 5: Keep existing pin/dismiss/recent-open behavior working during the migration**
- [ ] **Step 6: Re-run `npm run test:unit -- tests/unit/work-inbox-activity.test.ts` until green**

### Task 4: Replace work inbox cards with facts-first workspace briefing cards

**Files:**
- Modify: `src/lib/work-inbox/items.ts`
- Modify: `src/components/folder-intelligence/work-inbox-panel.tsx`
- Modify: `src/lib/i18n/dictionaries/en.json`
- Modify: `src/lib/i18n/dictionaries/vi.json`
- Modify: `tests/unit/work-inbox.test.ts`
- Modify: `tests/unit/work-inbox-panel.test.tsx`

- [ ] **Step 1: Write failing tests for per-workspace cards that lead with current truth, change signal, risk signal, and one next action**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/work-inbox.test.ts tests/unit/work-inbox-panel.test.tsx` and confirm the card assumptions fail under the old inbox model**
- [ ] **Step 3: Rework `buildWorkInboxItems` into a workspace-briefing-card builder that produces one primary card per watched-root workspace instead of a mixed list of item types**
- [ ] **Step 4: Update `work-inbox-panel.tsx` to render facts first, with visible evidence badges and confidence-aware copy like `Likely current` or `Ambiguous`**
- [ ] **Step 5: Preserve pinning and dismissal, but apply them at the workspace-card level rather than the old heuristic item level where needed**
- [ ] **Step 6: Update i18n strings to support facts-first labeling, confidence wording, and recommendation evidence without hardcoded English copy**
- [ ] **Step 7: Re-run `npm run test:unit -- tests/unit/work-inbox.test.ts tests/unit/work-inbox-panel.test.tsx` until green**

### Task 5: Reframe folder intelligence into a deeper workspace dashboard

**Files:**
- Modify: `src/components/folder-intelligence/folder-intelligence-panel.tsx`
- Modify: `src/components/folder-intelligence/workspace-drill-in-modal.tsx`
- Modify: `src/app/page.tsx`
- Modify: `tests/unit/folder-intelligence-panel.test.tsx`
- Modify: `tests/unit/workspace-drill-in-modal.test.tsx`

- [ ] **Step 1: Add failing component tests for a dashboard that prioritizes current truth, version pressure, changed-since-last-visit, and searchability health**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/folder-intelligence-panel.test.tsx tests/unit/workspace-drill-in-modal.test.tsx` and verify the old UI no longer satisfies the expectations**
- [ ] **Step 3: Rework `folder-intelligence-panel.tsx` into a supporting workspace dashboard summary surface instead of a second recommendation feed**
- [ ] **Step 4: Rebuild `workspace-drill-in-modal.tsx` so it reads like a workspace brief: current file, evidence, alternates, recent changes, searchability/OCR health, and recommended reading path**
- [ ] **Step 5: Update `src/app/page.tsx` wiring so card selection, dashboard opening, and file preview continue to share the same workspace/file selection flow**
- [ ] **Step 6: Keep list/grid/tree/file-preview behavior intact while changing only the briefing surfaces**
- [ ] **Step 7: Re-run `npm run test:unit -- tests/unit/folder-intelligence-panel.test.tsx tests/unit/workspace-drill-in-modal.test.tsx` until green**

### Task 6: Restrict AI to evidence-grounded briefing summaries

**Files:**
- Modify: `src/lib/folder-intelligence/ai.ts`
- Modify: `src/app/page.tsx`
- Modify: `tests/unit/folder-intelligence-ai.test.ts`

- [ ] **Step 1: Add failing tests that require AI requests and fingerprinting to derive from structured facts/signals rather than freeform heuristic summary fields**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/folder-intelligence-ai.test.ts` and verify the new coverage fails**
- [ ] **Step 3: Update the AI request payload to send workspace facts, current-truth evidence, version pressure, and change/searchability signals as the grounding contract**
- [ ] **Step 4: Ensure AI output can only decorate summary/highlight/recommendation copy and cannot overwrite the deterministic evidence model**
- [ ] **Step 5: Keep page-level caching and refresh behavior intact while migrating the payload shape**
- [ ] **Step 6: Re-run `npm run test:unit -- tests/unit/folder-intelligence-ai.test.ts` until green**

### Task 7: Verify the full workspace briefing experience end-to-end

**Files:**
- Modify: `tests/unit/folder-intelligence.test.ts`
- Modify: `tests/unit/work-inbox.test.ts`
- Modify: `tests/unit/workspace-drill-in-modal.test.tsx`
- Modify: `tests/unit/ui-components.test.tsx`

- [ ] **Step 1: Add final regression cases for ambiguity wording, metadata-only document handling, empty-workspace fallback, and watched-root ranking order**
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/folder-intelligence.test.ts tests/unit/work-inbox.test.ts tests/unit/folder-intelligence-panel.test.tsx tests/unit/workspace-drill-in-modal.test.tsx tests/unit/folder-intelligence-ai.test.ts tests/unit/work-inbox-activity.test.ts`**
- [ ] **Step 3: Run `npm run typecheck`**
- [ ] **Step 4: Run `npm run test:regression`**
- [ ] **Step 5: Manually verify the home screen flow in the desktop app: ranked workspace cards, drill-in dashboard, current-truth evidence, changed-since-last-visit, and no overclaiming when confidence is weak**
- [ ] **Step 6: Summarize the product shift in user-facing language before shipping: `understand what matters in this workspace` rather than `search your files faster`**
