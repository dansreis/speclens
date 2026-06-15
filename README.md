<div align="center">
  <img src="./full_logo.png" alt="SpecLens" width="420" />
</div>

# SpecLens

Desktop reader for OpenSpec change folders (`proposal.md` / `tasks.md` / `specs/<capability>/spec.md`). Browse changes across repositories, comment on text selections, and inspect document stats.

> **Status:** UI-first development against mock data. GitHub integration is on the roadmap - see [`TODO.md`](./TODO.md).

## Tech stack

- Tauri 2 (Rust shell + native window)
- React 19 + TypeScript + Vite
- MUI 9 + Emotion
- Zustand (state with `persist`)
- react-markdown + remark-gfm + rehype-raw + rehype-slug

## Getting started

```sh
pnpm install
pnpm tauri dev   # native desktop window
pnpm dev         # browser at http://localhost:1420
```

## Scripts

| Command            | What it does                                |
| ------------------ | ------------------------------------------- |
| `pnpm dev`         | Vite dev server (browser)                   |
| `pnpm tauri dev`   | Tauri dev (native window)                   |
| `pnpm build`       | `tsc && vite build`                         |
| `pnpm typecheck`   | `tsc --noEmit`                              |
| `pnpm check`       | Biome lint + format                         |
| `pnpm format`      | Biome auto-format                           |

## Project layout

```
src/
├── App.tsx               # top-level layout
├── sidebar/              # collapsible left sidebar
├── repos/                # repository switcher
├── specs/                # change viewer, minimap, markdown view, stats modal
├── comments/             # right-side comments panel + selection-to-comment
├── lib/                  # loader, stats, highlight, time helpers
└── store/                # Zustand stores

examples/                 # mock repos used until real GitHub integration lands
├── example1/config.json  # { name, type } per repo
├── example1/openspec/changes/...
└── ...

src-tauri/                # Rust shell + Tauri config
```

## Mock data

Each `examples/exampleN/` is a mock repository with a `config.json` (name + type: `private` | `organization` | `local`) and an `openspec/` tree. The repository switcher (top of the sidebar) lets you flip between them; `⌘1`..`⌘5` (or `Ctrl+1`..`Ctrl+5`) work as shortcuts.

## EARS keyword highlighting

Spec markdown is rendered with inline coloring for [EARS](https://alistairmavin.com/ears/) keywords, RFC 2119 modal verbs, and Gherkin scenario steps. Toggle it in **Settings** (gear icon, bottom of the sidebar). The fixture repo `speclens/ears-showcase` (`examples/ears-markdown-showcase/`) exercises every keyword and includes negative cases.

Colors are MUI palette tokens, not hex codes - they track light/dark mode and any future theme changes automatically. Keywords are grouped by their semantic role, not by uniqueness, so a few share a token (e.g. SHOULD and THEN both use `info`).

| Keyword(s)  | Role                       | MUI token        |
| ----------- | -------------------------- | ---------------- |
| SHALL, MUST | Mandatory - the spine of a requirement | `primary.main`   |
| SHOULD      | Recommended - weaker than SHALL        | `info.main`      |
| MAY         | Permitted - explicitly optional         | `secondary.main` |
| WHEN        | Discrete event trigger     | `success.main`   |
| WHILE       | Ongoing state              | `warning.main`   |
| WHERE       | Feature-flag conditional   | `secondary.main` |
| IF          | Unwanted-behavior branch   | `error.main`     |
| THEN        | Consequence (paired with IF or scenario) | `info.main`      |
| GIVEN, AND  | Scenario scaffolding - muted on purpose  | `text.secondary` |

All matches are uppercase + word-bounded, and skipped inside `code`, `pre`, and `kbd` so code samples and keyboard hints stay neutral.

Implementation: rehype plugin `rehypeEarsKeywords` in [`src/lib/earsKeywords.ts`](./src/lib/earsKeywords.ts); styling lives next to the markdown reset in [`src/specs/MarkdownView.tsx`](./src/specs/MarkdownView.tsx). Each keyword emits its own class (`ears-shall`, `ears-when`, …), so splitting a shared token into a distinct color later is a styling-only change.

## Roadmap

See [`TODO.md`](./TODO.md) for planned settings (max width, comments on/off, theme), foundations (i18n, tests, persistence), and features (GitHub PAT auth, real repo loading, comment threads, etc.).

## See also

- [`CLAUDE.md`](./CLAUDE.md) - architectural notes for working on the project with Claude Code.
