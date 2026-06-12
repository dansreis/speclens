# CLAUDE.md

Context for working on **SpecLens** with Claude Code. Read this before making changes.

## What it is

Desktop reader (Tauri 2 + React 19) for OpenSpec — the markdown convention with `proposal.md` / `tasks.md` / `specs/<capability>/spec.md` inside `<repo>/openspec/changes/<change-slug>/`. Archived changes live under `changes/archive/`.

Reads OpenSpec projects from local folders at runtime via a Tauri command. Users add folders themselves via "Add repository" in the sidebar; the list is persisted. The app starts empty and users point it at whatever they want. **GitHub integration is explicitly off the roadmap** — see the no-GitHub direction memory.

## Stack decisions

- **MUI + Emotion.** Confirmed UI stack. **Don't add Tailwind.**
- **Zustand with `persist`.** `useAppStore` holds UI state (theme, sidebar collapse, selected repo/change/tab, scroll target) **plus `repoSources: { path, missing }[]`** (the user-added folder list — paths persist, `missing` resets to `false` on cold start). The loaded `repos: Repo[]` is **not** persisted — `reloadAllSources()` re-walks each path on mount. `useCommentsStore` holds comments (in-memory only — see TODO).
- **Tauri `load_repo(path)` command** in `src-tauri/src/lib.rs` loads one project: walks its `openspec/` subtree, reads markdown + yaml, and (when a `.git/` exists at the project root or its immediate parent — see `find_git_root`) runs `git log --follow` per file to derive `DocAuthorship`. The walk is intentionally capped at one level up so that loading a folder from inside an unrelated git checkout (e.g. somewhere under `~`) doesn't pull authorship from that repo. JS calls the command once per source and catches per-source errors to mark `missing: true`. **Git is optional** — when absent, `Change.authorship`, `createdAt`, and `archivedAt` are `null` and the UI degrades gracefully.
- **Per-repo cold-start cache.** Each `load_repo` response includes a `signature` (git: `HEAD-sha + scoped porcelain status` hash; non-git: hash of `openspec/` file mtimes). The fast Tauri command `repo_signature(path)` returns the signature alone (no file reads). On cold start, `reloadAllSources` fetches the signature first; if it matches the cached entry in `localStorage` (`speclens.repo-cache.<path>`), the saved `Repo` is used as-is — no walking, no git log. Mismatch → full reload + cache overwrite. See `src/lib/repoCache.ts`. Dates in cached entries get revived (JSON round-trip loses the `Date` type).
- **`@tauri-apps/plugin-dialog`** powers the "Add repository" folder picker (capability `dialog:default`).
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
│   ├── RepositorySwitcher.tsx    # dropdown over repoSources; ⌘1..N (loaded only); per-row delete; missing-folder warning
│   ├── addRepo.ts                # pickAndAddRepoSource() — folder picker → addRepoSource()
│   └── RepoConfigModal.tsx       # per-repo config view (legacy; kept for now)
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
│   ├── exampleLoader.ts          # async loadRepoFromPath(path) → Repo (calls Tauri load_repo)
│   ├── documentSource.ts         # getCurrentSource(change, tab)
│   ├── documentStats.ts          # computeDocumentStats(source)
│   ├── extractHeadings.ts        # uses github-slugger to match rehype-slug
│   ├── highlight.ts              # DOM-mutation <mark> wrapping; tracks occurrence index
│   ├── tasksCompletion.ts        # counts `- [x]` outside fenced code blocks
│   └── relativeTime.ts           # Intl.RelativeTimeFormat + absolute formatter
├── store/
│   ├── useAppStore.ts            # repoSources (persisted) + repos + add/remove/reload actions + UI state
│   └── useCommentsStore.ts       # not persisted; seeds from mockComments
└── (src-tauri/src/lib.rs)        # load_repo command: walk openspec/, git log --follow per file, return RepoPayload
```

## Authorship pipeline

Authorship is derived at app start by the Rust `load_repo` command. For each project, when a `.git/` is found at the project root or its immediate parent (no further walk-up — see `find_git_root`), it runs `git log --follow --format=%H%x09%aN%x09%aE%x09%aI` per tracked file and emits per-file `DocAuthorship` plus a per-change rollup (`<archive/>?<slug>` → oldest/newest commit). The JS loader hydrates this into `Change.authorship`, `createdAt`, and `archivedAt`. **No `history.json` file is involved** — the git log *is* the source of truth.

When `.git/` is absent, the command still returns a `RepoPayload` with file content; `authorship`, `createdAt`, and `archivedAt` come through as `null` and the AttributionLine renders blank.

## Non-obvious things

- **Highlight blink scroll** (MarkdownView): `setScrollTarget(null)` is **inside** the `setTimeout` callback. Don't hoist it — if the state clears synchronously, React re-renders and `applyHighlights` strips the `<mark>` before its CSS animation paints.
- **ChangeViewer scroll-reset effect:** the `useEffect` resetting `scrollTop` on `change` changes calls `useAppStore.getState().scrollTarget` and bails if a scroll target is pending. Otherwise it cancels the comment-jump smooth scroll.
- **Repo switching:** `setSelectedRepoId` atomically resets `selectedChangeKey: null` + `activeTab: "proposal"`. App's existing effect then picks the first change of the new repo.
- **Document ID format:** `<slug>/<tab>` (e.g. `add-search-bar/proposal`). **Not** scoped per-repo yet — if the same slug exists across multiple example repos, a comment's highlight applies in all of them. Extend `Highlight` with a `repoId` field when this becomes an issue.
- **rehype-raw with no sanitizer.** Safe for the controlled fixture repo, unsafe for arbitrary user content. Add `rehype-sanitize` with an allowlist before reading untrusted repos.
- **Repo `name` / `type` / `id` are derived from folder name** — `name = id = path's final segment`, `type = "local"`. To customize display names, add a field to `openspec/config.yaml` and read it in `payloadToRepo`.
- **Missing-folder handling.** When `loadRepoFromPath` throws (folder gone, no `openspec/`, etc.), `reloadAllSources` marks that source `missing: true` instead of dropping it. The RepositorySwitcher renders it with `FolderOffIcon` + warning border, disables selection, and shows the close button always (instead of hover-only) so the user can remove it.
- **adr/ goes through rootFiles.** The schema's `adr` artifact has `generates: "../../../adr/*.md"`; `classifyGenerates` strips the `..` segments and matches against the repo-root file map. The loader populates rootFiles with `openspec/`-stripped keys (e.g. `adr/0001-...md`) so this pattern resolves.
- **ChangesSidebar collapsed mode** renders 32×32 avatars with initials (`getInitials(change.name)`); active uses `primary.main`, archived uses 60% opacity.
- **Minimap viewport indicator** is sized by visible *bars* (count of in-viewport headings), not by `scrollTop/scrollHeight` ratio. See the bar-position logic before "fixing" this — earlier attempts to use scroll-proportion were rejected.

## Mock data

- `src/comments/mockComments.ts` — 5 comments (3 unresolved / 2 resolved). One has a highlight bound to `add-search-bar/proposal` (Daniel Reis's "fuzzy matching" comment) — useful demo for comment-jump.

## Conventions

- Tab indentation (Biome enforced).
- Per-icon imports for `@mui/icons-material` (e.g. `import LockIcon from "@mui/icons-material/Lock"`) so tree-shaking works.
- `keyframes` from `@emotion/react` — `@mui/system` isn't a direct dependency.

## When in doubt

Read `TODO.md` — every hardcoded value flagged as "should be configurable" plus the broader roadmap.
