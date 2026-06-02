# Initial spec viewer (Example 3)

## Why

SpecLens needs a basic viewer to render an OpenSpec change folder — proposal, tasks, and per-capability specs — before any GitHub integration lands. Without this, the rest of the app has nothing to display.

## What Changes

Additive (this was the first user-visible feature).

- Read an OpenSpec change folder from disk and render its `proposal.md`, `tasks.md`, and `specs/<capability>/spec.md` files.
- Render markdown with GitHub-flavoured extensions (tables, task lists, fenced code).
- Show task completion counts derived from `- [x]` / `- [ ]` parsing.

## Impact

- **Affected specs:** new `spec-viewer` capability.
- **Affected code:** new `SpecViewer.tsx`, `tasksCompletion.ts`, markdown renderer setup.
- **External dependencies:** `react-markdown`, `remark-gfm`.
- **Out of scope:**
  - Editing specs in-app (read-only for now).
  - Real-time updates from the filesystem.
