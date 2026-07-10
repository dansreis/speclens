# Contributing to SpecLens

Thanks for your interest! Issues and pull requests are welcome.

## Dev setup

You need [pnpm](https://pnpm.io), the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) (Rust toolchain), and `cmake` (the local-LLM engine compiles llama.cpp from source; `brew install cmake` on macOS). No cmake? Build the Rust side with `--no-default-features` - everything except AI inference works.

```sh
pnpm install
pnpm tauri dev   # native desktop window
pnpm dev         # browser only, at http://localhost:1420
```

Need data to point the app at? Clone [openspec-examples](https://github.com/dansreis/openspec-examples).

## Before you push

All of these must pass - CI enforces them on every PR (`frontend` + `rust` checks are required on `main`):

```sh
pnpm check       # Biome lint + format
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest unit tests
pnpm build       # tsc && vite build

cd src-tauri
cargo fmt --check
cargo clippy --all-targets
```

`pnpm exec biome check --write .` fixes most lint/format complaints automatically.

## Conventions

- **Tab indentation** (Biome enforces it).
- **Per-icon imports** for `@mui/icons-material` (`import LockIcon from "@mui/icons-material/Lock"`) so tree-shaking works.
- **MUI + Emotion** is the UI stack - don't add Tailwind or another styling system. `keyframes` comes from `@emotion/react` (`@mui/system` is not a direct dependency).
- **Hyphens, not em dashes**, in all prose and UI text.
- Unit tests live next to the code they cover (`src/lib/foo.test.ts`). Pure helpers should have them; UI components currently don't.
- Commit subjects are short, imperative, sentence-case ("Add About dialog", not "added about dialog").

## Architecture notes

`CLAUDE.md` at the repo root is the deep-dive: store layout, persistence model, the Tauri `load_repo` pipeline, and a list of non-obvious behaviors worth reading before touching the related code. `docs/ROADMAP.md` tracks what's planned - picking an item from there is a great way to contribute (maybe open an issue first to align on approach).

## Releases

Maintainer-only; the process is documented in [RELEASE.md](./RELEASE.md).

## License

By contributing, you agree that your contributions are licensed under the [Apache 2.0 license](./LICENSE).
