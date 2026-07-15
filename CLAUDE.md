# CLAUDE.md

Context for working on **SpecLens** with Claude Code. Read this before making changes.

## What it is

Desktop reader (Tauri 2 + React 19) for OpenSpec - the markdown convention with `proposal.md` / `tasks.md` / `specs/<capability>/spec.md` inside `<repo>/openspec/changes/<change-slug>/`. Archived changes live under `changes/archive/`.

Reads OpenSpec projects from local folders at runtime via a Tauri command. Users add folders themselves via "Add repository" in the sidebar; the list is persisted. The app starts empty and users point it at whatever they want. **GitHub integration is explicitly off the roadmap** - see the no-GitHub direction memory.

## Stack decisions

- **MUI + Emotion.** Confirmed UI stack. **Don't add Tailwind.**
- **Zustand + SQLite write-through (not `persist` middleware).** `useAppStore` holds UI state (theme, sidebar collapse, selected repo/change/tab, scroll target, `markdownZoom`, `highlightEars`, session-only panel state) **plus `repoSources: { path, missing }[]`** (the user-added folder list - paths persist, `missing` resets to `false` on cold start) **plus `settings: AppSettings`**. Persistence is done manually in `src/store/bootstrap.ts`: `bootstrap()` hydrates from SQLite on start, then `attachWriteThrough()` subscribes to each persisted slice and writes it back (UI keys → `kv_state`, sources → `repo_sources`). The loaded `repos: Repo[]` is **not** persisted - `reloadAllSources()` re-walks each path on mount. `useCommentsStore` persists via SQLite (`comments` table). `useAiStore` holds AI generation state + session summary caches.
- **Settings.** `AppSettings` + `DEFAULT_SETTINGS` + `HIGHLIGHT_COLORS` + `sanitizeSettings()` live in `useAppStore.ts`; the whole object persists as one `"settings"` kv blob. Mutate via `setSetting(key, value)` / `resetSettings()`. The dialog is in `src/sidebar/SidebarFooter.tsx` (General / Reading / AI tabs). **To add a setting:** extend the type + defaults, add a validated branch in `sanitizeSettings`, read `s.settings.<key>` at the consumer, add a control to the dialog - no new subscription needed.
- **Tauri `load_repo(path)` command** in `src-tauri/src/lib.rs` loads one project: walks its `openspec/` subtree, reads markdown + yaml, and (when a `.git/` exists at the project root or its immediate parent - see `find_git_root`) derives `DocAuthorship` per file via the `git2` crate (vendored libgit2 - no git binary needed). Authorship comes from **one history walk for all files** (`collect_file_histories`) - see "Authorship pipeline". The git-root walk is intentionally capped at one level up so that loading a folder from inside an unrelated git checkout (e.g. somewhere under `~`) doesn't pull authorship from that repo. JS calls the command once per source and catches per-source errors to mark `missing: true`. **Git is optional** - when absent, `Change.authorship`, `createdAt`, and `archivedAt` are `null` and the UI degrades gracefully.
- **Per-repo cold-start cache.** Each `load_repo` response includes a `signature` (git: `HEAD-sha + scoped porcelain status` hash; non-git: hash of `openspec/` file mtimes). The fast Tauri command `repo_signature(path)` returns the signature alone (no file reads). On cold start, `reloadAllSources` fetches the signature first; if it matches the cached entry in SQLite (`repo_cache` table, keyed by path), the saved `Repo` is used as-is - no walking, no git log. Mismatch → full reload + cache overwrite. See `src/lib/repoCache.ts` (thin wrapper over `src/lib/db.ts`). Dates in cached entries get revived (JSON round-trip loses the `Date` type). `useRepoSyncWatcher` polls the selected repo's signature (15s + window focus) and only *marks* it stale - reload is always user-initiated.
- **Local AI (`src-tauri/src/ai.rs`).** On-device summaries via llama.cpp (Metal) or an Ollama backend, exposed as `ai_*` commands. Nothing downloads or runs until the user fetches a model, so the no-network promise holds. Prompts are built on the JS side (`src/lib/aiSummary.ts`, `aiDocSummary.ts` - pure, unit-tested); Rust just receives the final string.
- **Spec checks (deterministic lint, labelled Beta).** `src/lib/specChecks.ts` is the engine (structural SL00x errors, consistency SL01x warnings, language SL02x checks) covering active change deltas + canonical `specs/<cap>/spec.md`; `src/lib/specChecksConfig.ts` is the registry - ids, severities, titles, message templates, and word lists all live there, the engine holds only detection logic. Both modules must stay pure (no Tauri imports) so the lint core can be extracted into a CLI later (see `docs/design/checks-and-claims.md`). Surfaced as: a Checks navigation view (two-level tree, by change or by check), a drag-resizable right panel that scopes to the open change/spec and hides on non-checkable views, in-document wavy underlines with hover diagnostics, list badges, and a ChangeViewer banner for findings with no text anchor. **All UI reads results through `src/specs/useSpecChecks.ts` (`useSpecCheckResults`)** - never call `runSpecChecks` from a component directly, the hook owns the settings wiring (`specChecks`, default on; `specChecksIncludeArchived`, default off).
- **One right panel at a time.** Comments, spec checks, and the AI summary are mutually exclusive: an arbiter effect in App.tsx closes the other two on any panel's closed→open transition (last opened wins). Panel open state stays where it always lived (App / useAppStore / useAiStore).
- **`@tauri-apps/plugin-dialog`** powers the "Add repository" folder picker (capability `dialog:default`).
- **No i18n** - deferred. Tests: Vitest covers the pure `src/lib` helpers (`*.test.ts` co-located); `cargo test` covers the git2 authorship/signature layer (temp repos built with git2, no git binary). UI is untested. See `docs/ROADMAP.md`.

## Gates

Before declaring work done, run all four:

```sh
pnpm check       # Biome lint + format
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest (pure lib helpers)
pnpm build       # tsc && vite build  (catches issues the others miss)
```

When Biome flags formatting: `pnpm exec biome check --write .` fixes most cases. Rust changes additionally get `cargo test`, `cargo clippy --all-targets`, `cargo fmt --check`.

## File map

```
src/
├── App.tsx                       # top layout: sidebar | (breadcrumbs + active view + AI/checks/comments panels)
├── SplashScreen.tsx              # branded splash held until the initial load settles
├── sidebar/
│   ├── AppSidebar.tsx            # frame: header / content / footer; expand ↔ collapse
│   ├── SidebarFooter.tsx         # Settings dialog (General/Reading/AI tabs) + About + theme toggle
│   ├── AboutDialog.tsx           # version display (the only one - see memory) + update notice
│   └── AiSettingsSection.tsx     # AI tab: model download/import/selection
├── repos/
│   ├── RepositorySwitcher.tsx    # dropdown over repoSources; ⌘1..N; per-row delete; missing/stale indicators
│   ├── addRepo.ts                # pickAndAddRepoSource() - folder picker → addRepoSource()
│   └── RepoConfigModal.tsx       # per-repo config view (legacy; kept for now)
├── views/                        # one component per sidebar destination
│   ├── OverviewView.tsx          # stats, AI overview summary, activity, spec-check findings
│   ├── ChangesView.tsx           # filterable change list (per-row check badges) → ChangeViewer
│   ├── ChecksView.tsx            # spec-check analysis: two-level tree, severity/text filters
│   ├── SpecsView.tsx             # capability specs → SpecCapabilityViewer
│   ├── SchemasView.tsx           # openspec/schemas/ YAML viewer
│   ├── FolderView.tsx            # auto-discovered Library folders (adr/, playbooks/, ...)
│   ├── FlowView.tsx / GraphView.tsx / TimelineView.tsx
│   ├── RepoDocLayout.tsx / RepoDocList.tsx / Breadcrumbs.tsx / ErrorBoundary.tsx
├── specs/
│   ├── ChangeViewer.tsx          # title row (checks badge, AI, stats, comments) + attribution + tabs + body
│   ├── SpecCapabilityViewer.tsx  # canonical spec + per-change delta tabs
│   ├── MarkdownView.tsx          # ReactMarkdown + comment highlights + check underlines + hover popovers
│   ├── Minimap.tsx               # spine + slide-out TOC panel (HackMD-style)
│   ├── AttributionLine.tsx       # avatar(s) + "Created by X · edited by Y, 2d ago"
│   ├── AiDocSummaryButton.tsx / AiSummaryPanel.tsx
│   ├── SpecChecksBadge.tsx       # title-row panel toggle + shared CheckSeverityCounts
│   ├── SpecChecksPanel.tsx       # right panel: resizable, scoped to open change/spec
│   ├── specCheckJump.ts          # shared navigate-and-highlight for check findings
│   ├── useSpecChecks.ts          # useSpecCheckResults - the only component entry to the engine
│   ├── DocumentStatsTooltip.tsx  # words / read time / headings tooltip
│   └── MermaidDiagram.tsx / MermaidLightbox.tsx   # lazy-loaded ```mermaid rendering
├── comments/
│   ├── CommentsPanel.tsx         # right panel; scopes + resolved tabs; quote-click jump; md export
│   └── SelectionPopover.tsx      # floating "add comment" on text selection
├── search/SearchPalette.tsx      # ⌘K palette
├── onboarding/TutorialDialog.tsx # first-launch tour (replayable from Settings)
├── lib/                          # pure helpers, Vitest-covered; keep Tauri imports out
│   ├── repoLoader.ts             # loadRepoFromPath(path) → Repo (calls Tauri load_repo)
│   ├── repoCache.ts / db.ts      # SQLite cold-start cache + storage layer
│   ├── schema.ts                 # OpenSpec schema parsing; artifact → document resolution
│   ├── specChecks.ts             # lint engine (see Stack decisions)
│   ├── specChecksConfig.ts       # check registry: ids, severities, messages, word lists
│   ├── highlight.ts              # DOM-mutation <mark> wrapping; occurrence index; className per target
│   ├── earsKeywords.ts           # EARS keyword rehype highlighter
│   ├── aiSummary.ts / aiDocSummary.ts / aiSummaries.ts / ai.ts   # prompt builders + AI plumbing
│   ├── extractHeadings.ts / documentSource.ts / documentStats.ts
│   ├── tasksCompletion.ts / relativeTime.ts / markdownPreview.ts / stripDatePrefix.ts
│   ├── changeFlow.ts / orphanDetection.ts / updateCheck.ts
│   └── useCurrentDocument.ts / useMinDelay.ts / useRepoSyncWatcher.ts
├── store/
│   ├── useAppStore.ts            # sources + repos + settings + UI state (see Stack decisions)
│   ├── useCommentsStore.ts       # comments, persisted via SQLite
│   ├── useAiStore.ts             # AI generation state + summary caches
│   └── bootstrap.ts              # hydrate from SQLite + write-through subscriptions
src-tauri/src/
├── lib.rs                        # load_repo / repo_signature / resolve_repo_root; single-pass authorship
├── ai.rs                         # ai_* commands: model registry, llama.cpp + Ollama backends
└── appimage.rs                   # Linux AppImage startup safeguards (Wayland preload re-exec)
```

## Authorship pipeline

Authorship is derived at load time by the Rust `load_repo` command. When a `.git/` is found at the project root or its immediate parent (no further walk-up - see `find_git_root`), `collect_file_histories` walks history **once** for all tracked files: each commit is diffed against its parents with the diff restricted to the `openspec/` subtree, touched paths are attributed to the tracked file currently at that path, and renames are followed per file (first-parent rename detection when a tracked path appears as an add - this is what keeps archive moves attributed). Mailmap-resolved author name/email (`%aN`/`%aE` semantics), `%aI`-shaped ISO dates. Emits per-file `DocAuthorship` plus a per-change rollup (`<archive/>?<slug>` → oldest/newest commit). The JS loader hydrates this into `Change.authorship`, `createdAt`, and `archivedAt`. **No `history.json` file is involved** - the git history *is* the source of truth.

**Do not reintroduce per-file history walks.** The previous implementation ran a `git log --follow` equivalent per file - O(files × commits) - and hung for 9+ minutes on a repo with 4.5k commits and 2.8k specs; the single pass loads the same repo in ~4s. `SPECLENS_BENCH_REPO=<path> cargo test --release bench_real_repo -- --ignored --nocapture` measures it.

When `.git/` is absent, the command still returns a `RepoPayload` with file content; `authorship`, `createdAt`, and `archivedAt` come through as `null` and the AttributionLine renders blank.

## Non-obvious things

- **Highlight blink scroll** (MarkdownView): `setScrollTarget(null)` is **inside** the `setTimeout` callback. Don't hoist it - if the state clears synchronously, React re-renders and `applyHighlights` strips the `<mark>` before its CSS animation paints.
- **Check underlines ride the comment-highlight mechanism.** `HighlightTarget.className` styles a mark as a severity-colored wavy underline instead of a comment fill. Comments win key (`text|occurrence`) collisions; a transient anchor target is added for scroll targets matching no existing mark so a finding jump always has something to flash.
- **Spec-check snippets are rendered text.** `SpecCheckResult.snippet` is the offending line with markdown syntax stripped (`toSnippet`), because `highlight.ts` matches the DOM's flattened text. Single `*emphasis*` is deliberately not stripped - such lines fall back to a plain jump.
- **ChangeViewer scroll-reset effect:** the `useEffect` resetting `scrollTop` on `change` changes calls `useAppStore.getState().scrollTarget` and bails if a scroll target is pending. Otherwise it cancels the comment-jump smooth scroll.
- **Repo switching:** `setSelectedRepoId` atomically resets `selectedChangeKey: null` + `activeTab: "proposal"`.
- **Document ID formats:** `<slug>/<tab>` normally, `<slug>/<tab>/<file>` when a tab resolves to multiple files, and `spec:<cap>` / `spec:<cap>:<changeKey>` in the SpecCapabilityViewer. `findingDocumentId` in specChecks.ts mirrors the change-doc rule - keep them in sync with MarkdownView.
- **rehype-sanitize runs between rehype-raw and rehype-slug** in MarkdownView. Order matters: slug ids and EARS keyword classes are added after sanitization so they survive; `language-*` code classes and GFM checkboxes are allowed by the GitHub-style default schema. Don't move plugins around without rechecking this.
- **Repo `name` / `type` are derived from folder name**; `id` is the full source path (unique across same-named folders). To customize display names, add a field to `openspec/config.yaml` and read it in `payloadToRepo`.
- **Missing-folder handling.** When `loadRepoFromPath` throws (folder gone, no `openspec/`, etc.), `reloadAllSources` marks that source `missing: true` instead of dropping it. The RepositorySwitcher renders it with a warning and disables selection so the user can remove or relocate it.
- **adr/ goes through rootFiles.** The schema's `adr` artifact has `generates: "../../../adr/*.md"`; `classifyGenerates` strips the `..` segments and matches against the repo-root file map. The loader populates rootFiles with `openspec/`-stripped keys (e.g. `adr/0001-...md`) so this pattern resolves.
- **Minimap viewport indicator** is sized by visible *bars* (count of in-viewport headings), not by `scrollTop/scrollHeight` ratio. See the bar-position logic before "fixing" this - earlier attempts to use scroll-proportion were rejected.

## Conventions

- Tab indentation (Biome enforced).
- Per-icon imports for `@mui/icons-material` (e.g. `import LockIcon from "@mui/icons-material/Lock"`) so tree-shaking works. Icons v9 renamed some modules (`ErrorOutline` → `ErrorOutlined`) - check `node_modules/@mui/icons-material/` when an import fails.
- `keyframes` from `@emotion/react` - `@mui/system` isn't a direct dependency.

## When in doubt

Read `docs/ROADMAP.md` (hardcoded values flagged as "should be configurable" plus the broader roadmap) and `docs/design/checks-and-claims.md` (the Checks/Claims/Export direction and its tier policy for local-AI assist).
