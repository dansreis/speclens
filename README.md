<div align="center">
  <img src="./docs/assets/logo.png" alt="SpecLens" width="360" />

  <p><strong>A desktop reader for <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> projects.</strong><br />
  Browse changes, trace how requirements evolved, and comment on specs - all from local folders.</p>
</div>

---

SpecLens reads the OpenSpec convention (`proposal.md` / `tasks.md` / `specs/<capability>/spec.md` under `openspec/changes/<change-slug>/`) straight from folders on your machine. Point it at any repository that uses OpenSpec and it gives you a reading experience the raw markdown can't:

- **Changes browser** - active and archived changes with tabs for proposal, tasks, design, and spec deltas, plus task-completion progress.
- **Timeline** - changes laid out chronologically, derived from git history.
- **Graph & Flow views** - how capabilities, changes, and specs relate to each other.
- **Specs & Schemas views** - the current state of every capability, and the schema that generated it.
- **Authorship** - when a project is a git repository, SpecLens runs `git log` per document to show who created and last edited each change. Without git it degrades gracefully.
- **Comments** - select any text to attach a comment; highlights persist locally (SQLite) and can be exported as markdown, ready to paste into an LLM conversation.
- **EARS keyword highlighting** - inline coloring for [EARS](https://alistairmavin.com/ears/) keywords, RFC 2119 modal verbs, and Gherkin steps (toggle in Settings).
- **Reader comforts** - minimap with table of contents, document stats and reading time, search palette, Mermaid diagram rendering, zoom, light/dark theme.

Everything is local. No accounts, no GitHub integration, no network calls - SpecLens only reads the folders you add.

## Install

Grab the `.dmg` from [Releases](https://github.com/dansreis/speclens/releases) and drag SpecLens to `/Applications`. Builds are signed and notarized, so it opens without any Gatekeeper warnings.

Then click **Add repository** in the sidebar and pick any folder containing an `openspec/` directory.

## Development

Requires [pnpm](https://pnpm.io) and the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) (Rust toolchain).

```sh
pnpm install
pnpm tauri dev   # native desktop window
pnpm dev         # browser only, at http://localhost:1420
```

| Command          | What it does               |
| ---------------- | -------------------------- |
| `pnpm build`     | `tsc && vite build`        |
| `pnpm typecheck` | `tsc --noEmit`             |
| `pnpm check`     | Biome lint + format check  |
| `pnpm format`    | Biome auto-format          |

### Stack

Tauri 2 (Rust) · React 19 + TypeScript + Vite · MUI + Emotion · Zustand with SQLite write-through persistence · react-markdown.

### Layout

```
src/
├── App.tsx        # top-level layout: sidebar | header + content + comments
├── views/         # overview, changes, specs, schemas, folder, graph, flow, timeline
├── specs/         # change viewer, markdown rendering, minimap, stats
├── comments/      # comments panel + selection-to-comment
├── repos/         # repository switcher + add-repository flow
├── sidebar/       # navigation, settings, theme toggle
├── search/        # search palette
├── store/         # Zustand stores + SQLite bootstrap
└── lib/           # loaders, git-derived authorship, stats, highlighting
src-tauri/         # Rust shell: repo walking, git log, signatures
```

`CLAUDE.md` has deeper architectural notes; `docs/ROADMAP.md` tracks what's missing; `RELEASE.md` describes how releases are cut.

## License

[Apache 2.0](./LICENSE) - note that the license does not grant rights to the SpecLens name and logo.
