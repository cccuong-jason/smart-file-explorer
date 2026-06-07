# Tree View Mode Design

**Date:** 2026-05-09

**Goal**

Add a third main file-browser mode, `tree`, that preserves watched-folder hierarchy while keeping the existing semantic-search, selection, and preview workflows intact.

## Summary

The app currently presents files in flat `list` and `grid` modes. That works well for search and scanning, but it discards the folder structure users rely on to understand where files belong. The new `tree` mode will render the same indexed file set as a collapsible hierarchy rooted at watched folders only. It is a structural browsing mode, not a second storage system or a full file-manager rewrite.

## Product Intent

- Keep semantic search and indexing exactly as they are today.
- Preserve the mental model of the original filesystem for watched folders.
- Avoid cluttering the shell with a permanent folder navigator.
- Reuse the current preview panel and file selection behavior.
- Keep `list` and `grid` unchanged so the new mode is additive, not disruptive.

## User Experience

### View Modes

The toolbar will expose three mutually exclusive modes:

- `list`
- `grid`
- `tree`

`tree` becomes a third primary mode rather than a sidebar add-on. This keeps the app’s layout model simple:

- `list` for dense scanning
- `grid` for visual browsing
- `tree` for structural browsing

### Tree Roots

The hierarchy begins at watched folders only, not absolute machine paths.

Examples:

- `Downloads`
- `Documents`
- `Project Alpha`

The tree should not expose noisy path prefixes like `C:\Users\jason\...` because they add visual weight without helping navigation.

Files that are indexed but not under a watched root do not appear in `tree` mode. They remain available in `list`, `grid`, and search results elsewhere in the app.

### Tree Interactions

- Watched roots are expanded by default.
- Folder rows expand/collapse inline.
- File rows behave like current list/grid items:
  - click selects the file
  - selection updates the right preview panel
  - existing quick look, tagging, starring, and open actions remain available through the preview panel
- Folder rows do not replace the preview panel with folder content in this first version.

### Search and Filters

All existing search and filter logic stays active in `tree` mode.

Behavior in `tree` mode:

- matching files remain at their real folder location
- non-matching branches are hidden
- ancestor folders remain visible if anything beneath them matches
- search does not flatten the hierarchy back into a list

This preserves the purpose of tree mode during search: users can still understand where matching files live.

### Sorting

Sorting remains available, but applies locally within each folder’s children rather than globally across the entire hierarchy.

Examples:

- if sorting by date descending, siblings inside a folder are sorted newest-first
- folder nodes remain grouped structurally rather than being globally interleaved with unrelated files from other branches

### Pagination

Pagination is disabled in `tree` mode.

Reason:

- hierarchy depends on contextual visibility across branches
- splitting the tree across numbered pages would make expansion state confusing and weaken structural comprehension

When switching back to `list` or `grid`, existing pagination behavior resumes unchanged.

### Expansion State

The first version should keep expansion state lightweight:

- watched roots expanded by default
- during search, the first matching path auto-expands so a visible result appears without extra clicks
- user toggles persist while staying in `tree` mode
- switching out of `tree` mode may reset this transient state unless preserving it is trivial

## Technical Design

### Data Strategy

Do not introduce a second persisted model for folders.

Instead:

- continue storing indexed files as the current flat file records
- derive a tree view model from:
  - the current visible file set
  - watched folder roots
  - current search/filter/sort state

This keeps the new feature as a presentation-layer transformation over existing data.

### Derived Tree Model

Introduce a utility that transforms visible files into a hierarchical structure.

Inputs:

- filtered/sorted file records
- watched folder records

Outputs:

- watched-root nodes
- nested folder nodes
- leaf file nodes

Each file should be assigned to the nearest matching watched root. Relative segments beneath that root form the nested tree path.

### Rendering

Add a dedicated tree-mode renderer component rather than overloading the existing list/grid item components.

Recommended structure:

- `TreeView` container
- recursive folder/file node rows
- a small presentational split between folder rows and file rows

File rows may still reuse pieces of current list metadata rendering if practical, but the tree mode should have its own layout contract.

### Selection and Preview

Keep the current selected-file state and preview panel wiring.

That means:

- tree clicks should call the same selection path already used by list/grid
- the preview panel should not care which mode produced the selection

This is important for minimizing regression risk and keeping the change localized.

## Error Handling and Edge Cases

- No watched folders:
  - tree mode should render an empty instructional state rather than a broken shell
- Indexed files outside watched roots:
  - omit them from tree mode
- Search returns no matches:
  - show the normal empty-results treatment for tree mode
- Duplicate filenames in different folders:
  - safe, because tree mode keys by path, not filename
- Deeply nested paths:
  - support collapsing and indentation without flattening labels into unreadable full paths

## Testing Strategy

### Unit Tests

Add focused tests for the tree-building utility:

- groups files beneath the correct watched root
- builds nested folders from relative path segments
- excludes files outside watched roots
- preserves ancestor folders for matching descendants
- applies sibling sort order correctly within folders

### UI Tests

Add representative UI tests for:

- third toolbar toggle appears and switches modes
- tree mode disables pagination
- clicking a file in the tree updates selection
- matching branches remain visible during search while unrelated branches disappear

### Regression Safety

Re-run:

- type-checking
- existing file-browser unit tests
- theme/regression tests for toolbar updates

## Out of Scope

The first version does not include:

- drag-and-drop folder reorganization
- folder-level preview content
- folder context menus
- filesystem mutation from the tree
- showing absolute machine-path prefixes

## Recommendation

Implement `tree` as a third main mode rooted at watched folders, with search/filter logic applied structurally instead of flattening results. This gives users back the original hierarchy they expect while preserving the app’s current strengths in semantic search and lightweight browsing.
