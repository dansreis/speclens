# TODO

Things to revisit later. Not in priority order.

## Global configuration

User-configurable settings, surfaced via a Settings panel/modal and persisted (likely in the existing Zustand `persist`-backed `useAppStore`).

- [ ] **Max markdown width** — currently hardcoded `1000` in `src/specs/ChangeViewer.tsx`
- [ ] **Enable / disable comments** — hides the comments toggle, the selection popover, and existing highlights when off
- [ ] **Author identity for new comments** — `author` + `initials` currently hardcoded as `"You"` / `"Y"` in `src/store/useCommentsStore.ts`
- [ ] **Reading speed** for the Reading Time stat — currently 200 wpm in `src/lib/documentStats.ts`
- [ ] **Highlight color** — currently hardcoded yellow `rgba(253, 224, 71, 0.45)` in `src/specs/MarkdownView.tsx`
- [ ] **Default landing tab** — currently always `proposal` on app load / change switch
- [ ] **Minimap behavior** — show always / on hover only / off; visible-bars detection threshold
- [ ] **Font family** for markdown content (currently inherits MUI default)
- [ ] **Comments panel width** — currently hardcoded `340` in `src/comments/CommentsPanel.tsx`
- [ ] **Comments always pinned** — currently comments pinned by default
- [ ] **Markdown zoom bounds + step** — currently hardcoded `0.7` ↔ `1.6` with `0.1` step in `src/store/useAppStore.ts`; default `1.0`. Surface as min / max / step settings.
- [ ] **Default Changes status filter** — currently hardcoded `"all"` in `src/views/ChangesView.tsx`. Let users pick the default between `all` / `active` / `archived`. 

## Foundations / plumbing

Deferred during the rebuild; revisit when actually needed.

- [] **Refactor Code** - code should be clean and using reusable components when possible
- [ ] **i18n scaffolding** (next-intl) — was offered as a slice but skipped; English-only is fine until a second locale is needed
- [ ] **Vitest setup** — `tasksCompletion.ts`, `extractHeadings.ts`, `documentStats.ts` etc. would benefit from unit tests
- [ ] **Persist user-added comments** — currently in-memory only; lost on reload. `useCommentsStore` already uses Zustand so add `persist` middleware (mind Date serialization)
- [ ] **Tauri bundle icons** — need a square ≥ 1024×1024 transparent PNG to regenerate `src-tauri/icons/`
- [ ] **Code splitting** — production bundle is > 500KB (vite warning); split MUI icons / markdown deps with `manualChunks`

## Features

Bigger work, build out in their own slices.

- [ ] **GitHub integration** — replace mock repos in `src/repos/RepositorySwitcher.tsx` and pull real change folders. Brings in `lib/github.ts`, PAT keychain via Rust, repository CRUD
- [ ] **Onboarding / PAT entry** — first-run screen for token capture
- [ ] **Switching repos actually changes content** — currently visual only; needs real repo data wired to `changes`
- [ ] **Click highlight → scroll to comment in panel** — reverse of the existing comment→highlight jump
- [ ] **Cross-text-node selection for comments** — currently anchors only work within a single text node; selecting across an inline `<code>` block silently fails
- [ ] **Comment threads / replies** — currently flat list
- [ ] **Mark/unmark resolved from the UI** — `toggleResolved` exists in the store but no button wired
- [ ] **Resize handles** on the TOC panel and Comments panel
- [ ] **Cross-doc comment indicator** — when viewing doc X, show a hint that doc Y has comments
- [ ] **Comments export** - I should be able to export the comments from a specific spec in order to feed LLMs
- [ ] **English speaking** -  add text to audio if possible. Ideally, there would be something on the screen moving a cursor while the audio goes.
