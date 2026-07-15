# Roadmap

Everything that's still missing, roughly grouped. Not in priority order unless stated. Finished work is removed from this file - git history is the record.

## Distribution

- [ ] **Ship through official `homebrew/cask`** - installable today via the personal tap ([dansreis/homebrew-tap](https://github.com/dansreis/homebrew-tap), auto-bumped by the release workflow). The official cask is blocked only on the notability bar (~75 stars / 30 forks / 30 watchers - `brew audit --new --cask` enforces it); the other prerequisites (public repo, signed + notarized builds) are met. Then: fork `homebrew/cask`, add `Casks/s/speclens.rb` (version + sha256 + dmg URL), pass `brew audit --new --cask speclens`, open the PR; each later release gets bumped via `brew bump-cask-pr`

## Foundations

- [ ] **Embedded llama.cpp on Windows ARM** - ggml refuses MSVC on ARM and the VS ClangCL toolset clashes with the `cmake` crate's hardcoded `-Thost=x64`; the windows-arm64 release leg currently ships without the `local-llm` feature (Ollama-based AI still works). Candidate fix: Ninja generator + clang-cl with a properly sourced VS ARM64 environment

- [ ] **Refactor pass** - extract reusable components where views grew organically
- [ ] **Cross-process source list sync** - two open windows don't see each other's added repos until restart
- [ ] **i18n scaffolding** - English-only is fine until a second locale is actually needed
- [ ] **Regenerate Tauri bundle icons** from the new logo (needs a square ≥ 1024×1024 transparent PNG)

## Settings

The plumbing is done (`AppSettings` in `useAppStore`, persisted as one kv blob - adding a setting is: extend type + defaults, validate in `sanitizeSettings`, read at consumer, add a dialog control). Missing settings:

- [ ] **Enable / disable comments** - hides the toggle, selection popover, and highlights when off
- [ ] **Author identity for new comments** - currently hardcoded `"You"` / `"Y"` in `useCommentsStore`
- [ ] **Default landing tab** - currently always `proposal`
- [ ] **Default changes status filter** - currently hardcoded `"all"` in `ChangesView`
- [ ] **Minimap behavior** - always / on hover / off
- [ ] **Markdown font family** - currently inherits the MUI default
- [ ] **Comments pinned by default** - make it a preference
- [ ] **Markdown zoom bounds + step** - hardcoded `0.7`–`1.6`, step `0.1`

## Features

- [ ] **Spec validation (deterministic core, local-AI assist)** - deterministic first, local-LLM assist second, never silent; full design and tier policy in [docs/design/checks-and-claims.md](./design/checks-and-claims.md).
  - [x] **Checks (Tier 0 lint engine)** - shipped: structural / consistency / language checks (`SL0xx` ids) in `src/lib/specChecks.ts` with a config registry, surfaced as a results panel, badges, in-document underlines with hover diagnostics, and an Overview section. `settings.specChecks`, on by default.
  - [ ] **Claims (Tier 0 parsing)** - EARS parsing into structured claims, readiness gaps, approval state in SQLite
  - [ ] **Assist + Export (Tier 1)** - "Interpret with AI" via the local model with grammar-constrained output; JSON claim export
  - further out: formalize requirement claims and hand them to an SMT solver (Z3) for contradiction detection, as spec-check does
- [ ] **Local AI: capability summaries + project Q&A** - enabled by default but fully on-device and inert until the user explicitly downloads a model (preserves the no-network promise). Phased:
  1. **Overview summaries** - a high-level AI-generated summary of the repo's capabilities on the Overview page, each linking to its spec. Generated per repo, cached in SQLite keyed by the existing repo `signature` (regenerates only when specs change). Internal link scheme routes to the Specs view.
  2. **Inference engine** - embedded in the Rust process (llama.cpp bindings or candle/mistral.rs, Metal on Apple Silicon) running a small instruct model (3-4B, GGUF Q4, ~2.5 GB download managed from Settings). Consider Apple's on-device Foundation Models framework as the zero-download fast path on macOS later.
  3. **Q&A over the openspec** - RAG: chunk docs, local embedding model (~tens of MB), vectors in SQLite (`sqlite-vec`), answers cite and link their source documents.
- [ ] **Relocate a missing repo** - "Locate folder…" picker instead of remove-and-re-add when a source path breaks
- [ ] **Repo display name override** - read a `name:` field from `openspec/config.yaml` instead of using the folder name
- [ ] **Comment threads / replies** - currently a flat list
- [ ] **Click highlight → scroll to comment** - reverse of the existing comment → highlight jump
- [ ] **Cross-text-node selection** - selecting across an inline `<code>` boundary silently fails to anchor
- [ ] **Cross-doc comment indicator** - viewing doc X, hint that doc Y has comments
- [ ] **Resize handles** on the TOC and comments panels
- [ ] **Read-aloud mode** - text-to-speech with a moving cursor following the audio
