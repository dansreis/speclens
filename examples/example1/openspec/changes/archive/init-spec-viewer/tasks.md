# Tasks: initial spec viewer (Example 1)

## 1. Filesystem reader

- [x] Add a Tauri command `read_change_folder(path)` returning `{ proposal, tasks, specs }`
- [x] Walk `specs/<capability>/spec.md` and return them keyed by capability slug
- [x] Surface missing-file errors with a clear `kind`

## 2. Markdown rendering

- [x] Add `react-markdown` + `remark-gfm` dependencies
- [x] `SpecViewer.tsx` — accepts the change folder data and renders three tabs (Proposal / Tasks / Specs)
- [x] Style markdown output to match the app theme

## 3. Task completion

- [x] `tasksCompletion.ts` — parses `- [x]` / `- [ ]` outside fenced code blocks
- [x] Render `done / total` on the Tasks tab header

## 4. Verification

- [x] Loading `examples/openspec/changes/add-search-bar` shows three tabs with no completed tasks
- [x] Loading a change with partial completion shows the correct count
- [x] Fenced code blocks containing `[x]` are not counted as task items
