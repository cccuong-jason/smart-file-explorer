# Context-Aware Document Intelligence Design

## Summary
Build a context-aware retrieval layer on top of the existing local search stack so the app can surface the most likely "right" document for work-oriented queries, explain why it was ranked highly, and show nearby context without adding cloud dependence.

## Hero Experience
- A user scans a work folder and searches with natural phrasing such as `latest client proposal` or `budget for acme`.
- Search results prioritize the document most likely to be correct, not just the file with the closest filename.
- The top result shows visible confidence and reasons such as semantic relevance, project context, recent update, or likely latest-version signals.
- The preview panel reinforces trust with a concise "why this matched" section and keeps related files nearby for quick follow-up actions.

## Retrieval Intelligence
- Keep the current local-first architecture and semantic search worker.
- Extend ranking so it combines lexical relevance, semantic similarity, path/project overlap, recent updates, likely latest-version clues, tag/star signals, and light content term overlap.
- Represent ranking reasons as stable reason codes so the UI can render localized explanations without coupling presentation text to ranking logic.
- Generate a short snippet from matching content so users can verify relevance faster from the result list.

## UI Changes
- Result rows show confidence-oriented labeling rather than only a raw percent match.
- The preview panel displays a compact explanation card and a "likely latest version" badge when the ranking model has enough evidence.
- Existing list, grid, Spotlight, related-files, and quick preview patterns remain intact.

## Guardrails
- No cloud APIs in this phase.
- No free-form AI chat in this phase.
- No billing or feature gating in this phase.
- The implementation should remain compatible with the current bilingual UI and local IndexedDB-backed search flow.

## Validation
- Add unit coverage for ranking heuristics, reason codes, confidence labels, and latest-version boosting.
- Re-run targeted unit tests plus typecheck after wiring the UI.
