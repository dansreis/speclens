# TODO

Things to revisit later. Not in priority order.

## Global configuration

User-configurable settings, surfaced via the Settings dialog (`src/sidebar/SidebarFooter.tsx`) and persisted. The infrastructure now lives in `useAppStore`: an `AppSettings` object with `DEFAULT_SETTINGS`, `setSetting(key, value)`, `resetSettings()`, and `sanitizeSettings()`, persisted as a single `"settings"` kv blob (see `store/bootstrap.ts`). **Adding a new setting = extend `AppSettings` + `DEFAULT_SETTINGS`, add validation in `sanitizeSettings`, read it at the consumer, add a control to the dialog.** No new subscription/hydration wiring needed.

- [x] **Reading speed** for the Reading Time stat - `settings.readingWpm`, consumed by `documentStats.ts` (via arg) + `OverviewView.tsx`
- [x] **Highlight color** - `settings.highlightColor`, consumed by `MarkdownView.tsx` (mark bg/hover + flash keyframes)
- [x] **Comments panel width** - `settings.commentsPanelWidth`, consumed by `CommentsPanel.tsx`
- [ ] **Enable / disable comments** - hides the comments toggle, the selection popover, and existing highlights when off
- [ ] **Author identity for new comments** - `author` + `initials` currently hardcoded as `"You"` / `"Y"` in `src/store/useCommentsStore.ts`
- [ ] **Default landing tab** - currently always `proposal` on app load / change switch
- [ ] **Minimap behavior** - show always / on hover only / off; visible-bars detection threshold
- [ ] **Font family** for markdown content (currently inherits MUI default)
- [ ] **Comments always pinned** - currently comments pinned by default
- [ ] **Markdown zoom bounds + step** - currently hardcoded `0.7` ↔ `1.6` with `0.1` step in `src/store/useAppStore.ts`; default `1.0`. Surface as min / max / step settings.
- [ ] **Default Changes status filter** - currently hardcoded `"all"` in `src/views/ChangesView.tsx`. Let users pick the default between `all` / `active` / `archived`.

> Note: "Max markdown width" (was hardcoded `1000` in `ChangeViewer.tsx`) is no longer applicable - content now renders full-width. Revisit only if a reading-width cap is wanted back.

## Foundations / plumbing

Deferred during the rebuild; revisit when actually needed.

- [] **Refactor Code** - code should be clean and using reusable components when possible
- [ ] **i18n scaffolding** (next-intl) - was offered as a slice but skipped; English-only is fine until a second locale is needed
- [ ] **Vitest setup** - `tasksCompletion.ts`, `extractHeadings.ts`, `documentStats.ts` etc. would benefit from unit tests
- [x] **Persist user-added comments** - done via SQLite (`@tauri-apps/plugin-sql`). `src/lib/db.ts` owns the schema (`comments`, `repo_sources`, `repo_cache`, `kv_state`); `useCommentsStore` reads/writes through it and `store/bootstrap.ts` hydrates on start.
- [ ] **Tauri bundle icons** - need a square ≥ 1024×1024 transparent PNG to regenerate `src-tauri/icons/`
- [ ] **Code splitting** - production bundle is > 500KB (vite warning); split MUI icons / markdown deps with `manualChunks`

## Features

Bigger work, build out in their own slices.

- [ ] **Relocate a missing repo** - currently the only options for a folder-not-found source are "remove" or "fix the path manually". A "Locate folder…" action in the menu (folder picker pre-pointed at the parent of the broken path) would let users re-bind without removing.
- [ ] **Repo display name override** - read a `name:` field from `openspec/config.yaml` in `payloadToRepo` so projects can show as "AdMedia Platform" instead of `admedia-platform`.
- [ ] **Cross-process source list sync** - if two SpecLens windows open at once, adding a repo in one won't show in the other until restart (Zustand persist only syncs on mount). Consider a Tauri event bus or a `storage` event listener.
- [ ] **Click highlight → scroll to comment in panel** - reverse of the existing comment→highlight jump
- [ ] **Cross-text-node selection for comments** - currently anchors only work within a single text node; selecting across an inline `<code>` block silently fails
- [ ] **Comment threads / replies** - currently flat list
- [ ] **Mark/unmark resolved from the UI** - `toggleResolved` exists in the store but no button wired
- [ ] **Resize handles** on the TOC panel and Comments panel
- [ ] **Cross-doc comment indicator** - when viewing doc X, show a hint that doc Y has comments
- [x] **Comments export** - done. `commentsToMarkdown` + the export button in `CommentsPanel.tsx` copy the visible comments (scoped to the current doc/repo) to the clipboard as markdown for feeding LLMs.
- [ ] **English speaking** -  add text to audio if possible. Ideally, there would be something on the screen moving a cursor while the audio goes.
