# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-07-08

First packaged release of SpecLens - a desktop reader for OpenSpec projects.

### Highlights

- **Browse OpenSpec repositories** - add any local folder containing an `openspec/` directory; proposals, tasks, and specs render as rich markdown with GFM, Mermaid diagrams, and EARS keyword highlighting
- **Seven views** - Overview, Changes, Specs, Flow, Graph, Timeline, and Schemas
- **Git-derived attribution** - created/edited bylines and timestamps come straight from repo history, with a per-repo cache for fast cold starts
- **Comments** - select any passage to attach a comment; unresolved/resolved workflow, quote-click jumps back to the highlighted text, persisted locally in SQLite
- **Navigate quickly** - global search (⌘K), back/forward history (⌘[ / ⌘]), document zoom, and a minimap with a slide-out table of contents
- **Onboarding tutorial** on first launch, replayable from Settings
- **Customization** - dark/light theme, drag-resizable sidebar, reading speed, highlight color, and comments panel width
- **Multi-platform builds** - macOS (Apple Silicon `.dmg`), Linux x64/arm64 (`.AppImage`, `.deb`, `.rpm`), Windows x64 (`.msi`, NSIS) and arm64 (NSIS)

### Known limitations

- Bundles are not code-signed yet; on macOS run `xattr -cr /Applications/SpecLens.app` after installing (see README)

