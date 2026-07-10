# Roadmap

Everything that's still missing, roughly grouped. Not in priority order unless stated. Finished work is removed from this file - git history is the record.

## Distribution

- [ ] **Ship through official `homebrew/cask`** (decided over a personal tap) - blocked until, in order:
  1. repo is public (cask URLs must be anonymously downloadable)
  2. app is signed + notarized (cask maintainers reject apps Gatekeeper blocks)
  3. notability bar (~75 stars / 30 forks / 30 watchers) - `brew audit --new --cask` enforces it
  then: fork `homebrew/cask`, add `Casks/s/speclens.rb` (version + sha256 + dmg URL), pass `brew audit --new --cask speclens`, open the PR; each later release gets bumped via `brew bump-cask-pr`
- [ ] **Mac App Store** (decided) - needs, beyond the Apple Developer membership:
  1. **App Sandbox** (mandatory for MAS) with security-scoped bookmarks - the persisted `repoSources` paths are unreadable across launches under sandbox unless each user-picked folder is saved as a security-scoped bookmark and re-resolved on start (custom Rust/objc; Tauri doesn't provide this)
  2. MAS build + upload (`tauri build` with MAS provisioning profile/entitlements, upload via Transporter/`altool`), App Store Connect listing, review
- [ ] **Auto-updates** - Tauri updater plugin, once signing exists (App Store copies update through Apple; updater applies to the direct/Homebrew build only)

## Foundations

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

- [ ] **Spec validation without LLMs** - in the spirit of [spec-check](https://github.com/ohpauleez/spec-check): deterministic, read-only analysis of the loaded OpenSpec docs to surface errors and mistakes before implementation. Candidate checks, roughly in order of effort:
  - structural: change folders missing `proposal.md` / `tasks.md`, spec deltas referencing capabilities that don't exist, malformed EARS/Gherkin blocks (`WHEN` without `THEN`, scenario without a requirement)
  - consistency: requirements duplicated across capabilities, archived changes still referenced by active ones, task lists that don't match the delta they claim to implement
  - language lint: RFC 2119 misuse (lowercase "shall", `SHOULD` + `MUST` in one clause), ambiguity flags ("fast", "appropriate", "etc.")
  - further out: formalize requirement claims and hand them to an SMT solver (Z3) for contradiction detection, as spec-check does
- [ ] **Relocate a missing repo** - "Locate folder…" picker instead of remove-and-re-add when a source path breaks
- [ ] **Repo display name override** - read a `name:` field from `openspec/config.yaml` instead of using the folder name
- [ ] **Comment threads / replies** - currently a flat list
- [ ] **Click highlight → scroll to comment** - reverse of the existing comment → highlight jump
- [ ] **Cross-text-node selection** - selecting across an inline `<code>` boundary silently fails to anchor
- [ ] **Cross-doc comment indicator** - viewing doc X, hint that doc Y has comments
- [ ] **Resize handles** on the TOC and comments panels
- [ ] **Read-aloud mode** - text-to-speech with a moving cursor following the audio
