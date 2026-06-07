# Tree View Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third main `tree` view mode that preserves watched-folder hierarchy while keeping the current semantic search, selection, and preview experience intact.

**Architecture:** Build the hierarchy as a derived view model from the existing visible file set and watched-folder roots rather than introducing a new persisted folder model. Integrate the tree into the current toolbar and main content area while reusing existing selection and preview state, and disable pagination only when tree mode is active.

**Tech Stack:** React 19, TypeScript, Vitest, IndexedDB, Tauri

---

### Task 1: Lock the tree-building rules with unit tests

**Files:**
- Create: `src/lib/file-browser/tree-view.ts`
- Create: `tests/unit/tree-view.test.ts`
- Modify: `src/lib/file-system/db.ts`

- [ ] **Step 1: Write failing tests** for a tree builder that:
  - groups files under the nearest watched root
  - builds nested folders from relative segments
  - excludes files outside watched roots
  - preserves ancestors for matching descendants
  - sorts sibling files/folders predictably within each branch
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/tree-view.test.ts`**
Expected: FAIL because `src/lib/file-browser/tree-view.ts` does not exist yet.
- [ ] **Step 3: Add minimal shared types and the tree builder in `src/lib/file-browser/tree-view.ts`**

```ts
export interface TreeFolderNode {
  kind: 'folder';
  id: string;
  name: string;
  path: string;
  children: TreeNode[];
  isRoot: boolean;
}

export interface TreeFileNode {
  kind: 'file';
  id: string;
  path: string;
  file: BrowserFileRecord;
}

export type TreeNode = TreeFolderNode | TreeFileNode;
```

- [ ] **Step 4: Re-run `npm run test:unit -- tests/unit/tree-view.test.ts` until green**

### Task 2: Add the tree-mode UI surface

**Files:**
- Create: `src/components/file-viewer/tree-view.tsx`
- Create: `tests/unit/tree-view-component.test.tsx`
- Modify: `src/lib/i18n/dictionaries/en.json`
- Modify: `src/lib/i18n/dictionaries/vi.json`

- [ ] **Step 1: Write failing UI tests** for:
  - rendering watched-root folders and nested files
  - toggling folder expand/collapse
  - clicking a file row invokes selection
  - empty tree-mode state appears when there are no visible watched-root matches
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/tree-view-component.test.tsx`**
Expected: FAIL because the `TreeView` component does not exist yet.
- [ ] **Step 3: Implement a focused `TreeView` component** with:
  - recursive folder/file rows
  - watched roots expanded by default
  - file click callback
  - lightweight token-based styling that fits the current shell
- [ ] **Step 4: Add missing i18n labels** such as:
  - `tree_view`
  - `tree_view_empty_title`
  - `tree_view_empty_description`
  - `tree_view_root_label`
- [ ] **Step 5: Re-run `npm run test:unit -- tests/unit/tree-view-component.test.tsx` until green**

### Task 3: Integrate tree mode into the main page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ui/pagination.tsx`
- Modify: `tests/unit/ui-components.test.tsx`

- [ ] **Step 1: Extend `viewMode`** from `'list' | 'grid'` to `'list' | 'grid' | 'tree'`
- [ ] **Step 2: Add the third toolbar toggle** and keep existing list/grid toggles visually intact
- [ ] **Step 3: Derive the tree view model from the current filtered/sorted files and watched folders**
- [ ] **Step 4: Render `TreeView` when `viewMode === 'tree'`** while:
  - reusing `selectedFile`
  - reusing preview-panel behavior
  - bypassing pagination
- [ ] **Step 5: Keep pagination behavior unchanged for list/grid**
- [ ] **Step 6: Add or update targeted tests** to verify tree mode disables pagination affordances and the toolbar exposes the new mode
- [ ] **Step 7: Run `npm run test:unit -- tests/unit/ui-components.test.tsx tests/unit/tree-view.test.ts tests/unit/tree-view-component.test.tsx`**

### Task 4: Search and expansion behavior in tree mode

**Files:**
- Modify: `src/lib/file-browser/tree-view.ts`
- Modify: `src/app/page.tsx`
- Modify: `tests/unit/tree-view.test.ts`

- [ ] **Step 1: Write one more failing test** covering “keep matching descendants visible through ancestor folders”
- [ ] **Step 2: Run `npm run test:unit -- tests/unit/tree-view.test.ts` and verify the new assertion fails for the expected reason**
- [ ] **Step 3: Implement the minimal search-aware visibility/expansion behavior** so:
  - tree mode keeps structure during search
  - ancestor branches remain
  - the first matching branch can auto-expand
- [ ] **Step 4: Re-run `npm run test:unit -- tests/unit/tree-view.test.ts tests/unit/tree-view-component.test.tsx` until green**

### Task 5: Final verification

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/file-viewer/tree-view.tsx`
- Modify: `tests/unit/tree-view.test.ts`
- Modify: `tests/unit/tree-view-component.test.tsx`

- [ ] **Step 1: Run the focused browser tests**

Run: `npm run test:unit -- tests/unit/tree-view.test.ts tests/unit/tree-view-component.test.tsx tests/unit/ui-components.test.tsx`

Expected: PASS

- [ ] **Step 2: Run type-checking**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 3: Run regression coverage for visible UI behavior**

Run: `npm run test:regression`

Expected: PASS

- [ ] **Step 4: Summarize any manual verification still needed**

Call out that a real Tauri/browser pass should confirm:
- tree toggle feel
- watched-root labeling
- search branch expansion
- list/grid pagination remains unaffected after switching modes
