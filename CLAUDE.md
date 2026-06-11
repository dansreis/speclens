# CLAUDE.md

Context for working on **SpecLens** with Claude Code. Read this before making changes.

## What it is

Desktop reader (Tauri 2 + React 19) for OpenSpec — the markdown convention with `proposal.md` / `tasks.md` / `specs/<capability>/spec.md` inside `<repo>/openspec/changes/<change-slug>/`. Archived changes live under `changes/archive/`.

Currently UI-only against seeded local-git fixtures in `examples/`. Real local-git integration (point SpecLens at any folder on disk) is the next major slice. **GitHub integration is explicitly off the roadmap** — see the no-GitHub direction memory.

## Stack decisions

- **MUI + Emotion.** Confirmed UI stack. **Don't add Tailwind.**
- **Zustand with `persist`.** `useAppStore` holds UI state (theme, sidebar collapse, selected repo/change/tab, scroll target). `useCommentsStore` holds comments (in-memory only — see TODO).
- **Vite glob for examples.** `examples/*/openspec/changes/**/*.md` + `examples/*/config.json` + `examples/*/history.json` are bundled at build time via `import.meta.glob` with `?raw` (markdown) or default JSON import. When real local-folder loading lands, replace `exampleLoader.ts` while keeping the `Repo[]` shape consumers depend on.
- **No i18n, no tests, no comment persistence** — deferred. See `TODO.md`.

## Gates

Before declaring work done, run all three:

```sh
pnpm check       # Biome lint + format
pnpm typecheck   # tsc --noEmit
pnpm build       # tsc && vite build  (catches issues the others miss)
```

When Biome flags formatting: `pnpm exec biome check --write .` fixes most cases.

## File map

```
src/
├── App.tsx                       # top layout: sidebar | (header + content + comments)
├── sidebar/
│   ├── AppSidebar.tsx            # frame: header / content / footer; 260 ↔ 64 collapse
│   └── SidebarFooter.tsx         # Settings (placeholder dialog) + Theme toggle
├── repos/
│   └── RepositorySwitcher.tsx    # dropdown reading from selectedRepoId; ⌘1..N shortcuts
├── specs/
│   ├── ChangeViewer.tsx          # title row (with stats/comments buttons) + attribution + tabs + body
│   ├── ChangesSidebar.tsx        # expanded list / collapsed avatar-initials mode
│   ├── AttributionLine.tsx       # avatar(s) + "Created by X · edited by Y, 2d ago"
│   ├── MarkdownView.tsx          # ReactMarkdown + selection + highlight rendering
│   ├── Minimap.tsx               # spine + slide-out TOC panel (HackMD-style)
│   └── DocumentStatsModal.tsx    # words / chars / paragraphs / sentences / headings / read time
├── comments/
│   ├── CommentsPanel.tsx         # right panel; unresolved/resolved tabs; quote-click jump
│   ├── SelectionPopover.tsx      # floating "add comment" on text selection
│   └── mockComments.ts           # seed comments (only one has a highlight wired)
├── lib/
│   ├── comments.ts               # AppComment + Highlight types
│   ├── exampleLoader.ts          # repos: Repo[] from globs over examples/
│   ├── documentSource.ts         # getCurrentSource(change, tab)
│   ├── documentStats.ts          # computeDocumentStats(source)
│   ├── extractHeadings.ts        # uses github-slugger to match rehype-slug
│   ├── highlight.ts              # DOM-mutation <mark> wrapping; tracks occurrence index
│   ├── tasksCompletion.ts        # counts `- [x]` outside fenced code blocks
│   └── relativeTime.ts           # Intl.RelativeTimeFormat + absolute formatter
└── store/
    ├── useAppStore.ts            # persisted: themeMode, sidebarCollapsed, selectedRepoId
    └── useCommentsStore.ts       # not persisted; seeds from mockComments
```

## Authorship pipeline

The `examples/` fixtures are real git repos so the UI has authorship data to render. Three pieces:

- `scripts/seed-example-git.mjs` — `git init` each `examples/*/`, commits with a fixed cast (Daniel Reis, Anna Costa, Pedro Silva, Sofia Mendes, Marcus Tang, Joana Pinto) on dates pulled from a `TIMESTAMPS` map that mirrors `mockTimestamps` in `exampleLoader.ts`. Idempotent; `--force` to wipe.
- `scripts/extract-example-history.mjs` — runs `git log --follow` per file under each change folder and writes `examples/<id>/history.json` shaped as `{ changes: { "<archive/>slug": { rolled, files } } }`.
- `pnpm seed` runs both. The seeded `.git/` dirs are gitignored; `history.json` is checked in so a fresh clone renders without scripting.

Keep `TIMESTAMPS` in the seed script in sync with `mockTimestamps` in `exampleLoader.ts` — they're the same calendar.

## Non-obvious things

- **Highlight blink scroll** (MarkdownView): `setScrollTarget(null)` is **inside** the `setTimeout` callback. Don't hoist it — if the state clears synchronously, React re-renders and `applyHighlights` strips the `<mark>` before its CSS animation paints.
- **ChangeViewer scroll-reset effect:** the `useEffect` resetting `scrollTop` on `change` changes calls `useAppStore.getState().scrollTarget` and bails if a scroll target is pending. Otherwise it cancels the comment-jump smooth scroll.
- **Repo switching:** `setSelectedRepoId` atomically resets `selectedChangeKey: null` + `activeTab: "proposal"`. App's existing effect then picks the first change of the new repo.
- **Document ID format:** `<slug>/<tab>` (e.g. `add-search-bar/proposal`). **Not** scoped per-repo yet — if the same slug exists across multiple example repos, a comment's highlight applies in all of them. When GitHub lands, extend `Highlight` with a `repoId` field.
- **rehype-raw with no sanitizer.** Safe for committed fixtures, unsafe for arbitrary GitHub content. Add `rehype-sanitize` with an allowlist before reading real repos.
- **Example loader regex** (`^\/examples\/([^/]+)\/openspec\/changes\/...`) deliberately excludes the legacy `examples/openspec/` folder. Safe to delete that folder.
- **ChangesSidebar collapsed mode** renders 32×32 avatars with initials (`getInitials(change.name)`); active uses `primary.main`, archived uses 60% opacity.
- **Minimap viewport indicator** is sized by visible *bars* (count of in-viewport headings), not by `scrollTop/scrollHeight` ratio. See the bar-position logic before "fixing" this — earlier attempts to use scroll-proportion were rejected.

## Mock data

- `examples/example1..5/config.json` — 5 repos (2 private, 2 organization, 1 local). Each has the same `openspec/changes/` tree.
- `src/comments/mockComments.ts` — 5 comments (3 unresolved / 2 resolved). One has a highlight bound to `add-search-bar/proposal` (Daniel Reis's "fuzzy matching" comment) — useful demo for comment-jump.

## Conventions

- Tab indentation (Biome enforced).
- Per-icon imports for `@mui/icons-material` (e.g. `import LockIcon from "@mui/icons-material/Lock"`) so tree-shaking works.
- `keyframes` from `@emotion/react` — `@mui/system` isn't a direct dependency.

## When in doubt

Read `TODO.md` — every hardcoded value flagged as "should be configurable" plus the broader roadmap.
