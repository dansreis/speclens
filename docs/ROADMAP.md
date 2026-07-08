# Roadmap

Everything that's still missing, roughly grouped. Not in priority order unless stated. Finished work is removed from this file — git history is the record.

## Open-source readiness

- [ ] **Choose a license** — nothing is published under a license yet; README says "all rights reserved" until this lands
- [ ] **Screenshots / demo GIF in the README** — the feature list needs to be visible, not just described
- [ ] **CONTRIBUTING.md** — dev setup exists in the README, but conventions (Biome, per-icon imports, gates) live only in CLAUDE.md
- [ ] **Sanitize untrusted markdown** — `rehype-raw` runs with no sanitizer; fine for your own repos, unsafe for arbitrary ones. Add `rehype-sanitize` with an allowlist before encouraging strangers to open random projects

## Distribution

- [ ] **Code signing + notarization (macOS)** — removes the `xattr -cr` workaround, the biggest first-run papercut
- [ ] **Ship through Homebrew** — `brew install --cask speclens`; needs a versioned release artifact and a cask formula (own tap first, `homebrew/cask` once there's traction)
- [ ] **CI release pipeline** — GitHub Actions building the `.dmg` (and future targets) on tag push
- [ ] **Auto-updates** — Tauri updater plugin, once signing exists
- [ ] **Windows / Linux builds** — nothing platform-specific in the code; needs icons, testing, and CI targets

## Foundations

- [ ] **Tests** — Vitest for the pure helpers first (`tasksCompletion`, `extractHeadings`, `documentStats`)
- [ ] **Code splitting** — production bundle > 500 KB (Vite warning); split MUI icons / markdown / graph deps with `manualChunks`
- [ ] **Refactor pass** — extract reusable components where views grew organically
- [ ] **Cross-process source list sync** — two open windows don't see each other's added repos until restart
- [ ] **i18n scaffolding** — English-only is fine until a second locale is actually needed
- [ ] **Regenerate Tauri bundle icons** from the new logo (needs a square ≥ 1024×1024 transparent PNG)

## Settings

The plumbing is done (`AppSettings` in `useAppStore`, persisted as one kv blob — adding a setting is: extend type + defaults, validate in `sanitizeSettings`, read at consumer, add a dialog control). Missing settings:

- [ ] **Enable / disable comments** — hides the toggle, selection popover, and highlights when off
- [ ] **Author identity for new comments** — currently hardcoded `"You"` / `"Y"` in `useCommentsStore`
- [ ] **Default landing tab** — currently always `proposal`
- [ ] **Default changes status filter** — currently hardcoded `"all"` in `ChangesView`
- [ ] **Minimap behavior** — always / on hover / off
- [ ] **Markdown font family** — currently inherits the MUI default
- [ ] **Comments pinned by default** — make it a preference
- [ ] **Markdown zoom bounds + step** — hardcoded `0.7`–`1.6`, step `0.1`

## Features

- [ ] **Spec validation without LLMs** — in the spirit of [spec-check](https://github.com/ohpauleez/spec-check): deterministic, read-only analysis of the loaded OpenSpec docs to surface errors and mistakes before implementation. Candidate checks, roughly in order of effort:
  - structural: change folders missing `proposal.md` / `tasks.md`, spec deltas referencing capabilities that don't exist, malformed EARS/Gherkin blocks (`WHEN` without `THEN`, scenario without a requirement)
  - consistency: requirements duplicated across capabilities, archived changes still referenced by active ones, task lists that don't match the delta they claim to implement
  - language lint: RFC 2119 misuse (lowercase "shall", `SHOULD` + `MUST` in one clause), ambiguity flags ("fast", "appropriate", "etc.")
  - further out: formalize requirement claims and hand them to an SMT solver (Z3) for contradiction detection, as spec-check does
- [ ] **Relocate a missing repo** — "Locate folder…" picker instead of remove-and-re-add when a source path breaks
- [ ] **Repo display name override** — read a `name:` field from `openspec/config.yaml` instead of using the folder name
- [ ] **Comment threads / replies** — currently a flat list
- [ ] **Mark/unmark resolved from the UI** — `toggleResolved` exists in the store, no button wired
- [ ] **Click highlight → scroll to comment** — reverse of the existing comment → highlight jump
- [ ] **Cross-text-node selection** — selecting across an inline `<code>` boundary silently fails to anchor
- [ ] **Cross-doc comment indicator** — viewing doc X, hint that doc Y has comments
- [ ] **Resize handles** on the TOC and comments panels
- [ ] **Read-aloud mode** — text-to-speech with a moving cursor following the audio
