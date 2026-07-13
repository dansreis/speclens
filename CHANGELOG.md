# Changelog

All notable changes to this project will be documented in this file.

## [1.1.1](https://github.com/dansreis/speclens/compare/v1.1.0...v1.1.1) - 2026-07-13

- Fixed a crash when quitting the app after using AI summaries (Metal resources are now released before exit)

## [1.1.0](https://github.com/dansreis/speclens/compare/v1.0.3...v1.1.0) - 2026-07-13

Local AI - on-device summaries, fully private. Nothing runs or downloads until you enable it and fetch a model; nothing ever leaves your machine.

### Highlights

- **AI summaries everywhere** - a golden ✨ button on the project Overview and on every document (proposals, tasks, design docs, specs, ADRs, playbooks) streams a summary into a resizable right-side panel. Capability names link straight to their specs.
- **Reviewer-oriented document summaries** - what the document is, its key points, and a "worth a reviewer's attention" list of risks and open questions.
- **Background generation** - keep reading while it works; a notification tells you when the summary is ready. Summaries cache per document and regenerate only when content changes.
- **Five curated models** - Gemma 4 E2B (default) and E4B, Qwen3.5 4B, Phi-4 Mini, SmolLM3 3B - downloaded on demand with checksum verification, all managed from Settings.
- **Bring your own model** - import any llama.cpp-compatible GGUF file, or drop it into the models folder.
- **Ollama support** - models from a local Ollama server appear automatically and generate through it.
- **Settings redesign** - a scannable model list with per-row download/delete, storage totals, and a simpler two-tab layout.

### Known limitations

- AI inference is Metal-accelerated on Apple Silicon and CPU-based elsewhere; small models can be slow on older machines
- Windows installers remain unsigned - SmartScreen will warn on first run

## [1.0.3](https://github.com/dansreis/speclens/compare/v1.0.2...v1.0.3) - 2026-07-10

- Fixed a crash when opening a document containing a Mermaid diagram before the diagram renderer had loaded ("Something went wrong rendering this view")
- Git is no longer required on your machine: authorship and timestamps now come from an embedded git library, with identical rename-following and .mailmap behavior

## [1.0.2](https://github.com/dansreis/speclens/compare/v1.0.1...v1.0.2) - 2026-07-10

- Faster startup - the eager bundle shrank from 1.9 MB to 744 KB; Mermaid now loads on demand, only when a document renders a diagram
- The project went public: [website](https://dansreis.github.io/speclens/), Homebrew install, CONTRIBUTING.md, and unit tests running in CI

## [1.0.1](https://github.com/dansreis/speclens/compare/v1.0.0...v1.0.1) - 2026-07-10

- Add-repository picker now validates the selection - folders without an `openspec/` directory are rejected with a clear warning instead of being persisted as broken sources
- Install through Homebrew: `brew install --cask dansreis/tap/speclens` (Apple Silicon), with the cask updated automatically on every release
- README: feature screenshot gallery, demo video, and a pointer to the [openspec-examples](https://github.com/dansreis/openspec-examples) try-it-now dataset

## [1.0.0](https://github.com/dansreis/speclens/releases/tag/v1.0.0) - 2026-07-10

First release of SpecLens - a desktop reader for OpenSpec projects.

### Highlights

- **Browse OpenSpec repositories** - add any local folder containing an `openspec/` directory; proposals, tasks, and specs render as rich markdown with GFM, Mermaid diagrams, and EARS keyword highlighting
- **Seven views** - Overview, Changes, Specs, Flow, Graph, Timeline, and Schemas
- **Git-derived attribution** - created/edited bylines and timestamps come straight from repo history, with a per-repo cache for fast cold starts
- **Comments** - select any passage to attach a comment; unresolved/resolved workflow, quote-click jumps back to the highlighted text, persisted locally in SQLite; export as structured markdown ready to paste into an LLM conversation
- **Navigate quickly** - global search (⌘K), back/forward history (⌘[ / ⌘]), document zoom, and a minimap with a slide-out table of contents
- **Signed and notarized macOS builds** - installs and opens with no Gatekeeper warnings
- **Onboarding tutorial** on first launch, replayable from Settings
- **About dialog** - version, links, and these release notes, from the info button in the sidebar
- **Customization** - dark/light theme (the native window chrome follows it), drag-resizable sidebar, reading speed, highlight color, and comments panel width
- **Multi-platform builds** - macOS (Apple Silicon `.dmg`), Linux x64/arm64 (`.AppImage`, `.deb`, `.rpm`), Windows x64 (`.msi`, NSIS) and arm64 (NSIS)

### Known limitations

- Windows installers are not signed yet - SmartScreen will warn on first run
- macOS builds are Apple Silicon only
