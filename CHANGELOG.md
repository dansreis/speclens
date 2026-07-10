# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-07-10

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
