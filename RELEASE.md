# Releasing SpecLens

SpecLens follows [semantic versioning](https://semver.org). The version lives in four files that must stay in sync - `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` - so never bump it by hand; the release script does it for you (and the release workflow fails if the files disagree).

## Cutting a release

1. **Run the release script** from a clean `main`:

   ```sh
   pnpm create-release          # interactive, or:
   pnpm create-release patch    # patch | minor | major
   ```

   It bumps the version in all four files and prepends a section to `CHANGELOG.md` listing every commit since the last tag.

2. **Review** - check `git diff`, tidy the changelog wording if a commit subject isn't release-note material.

3. **Open a release PR:**

   ```sh
   git checkout -b release/vX.Y.Z
   git add -A && git commit -m "chore: release vX.Y.Z"
   git push origin release/vX.Y.Z
   ```

   CI (Biome, typecheck, build, cargo fmt/clippy) must pass like on any other PR.

4. **Merge to main.** The `Release` workflow notices the version change in `package.json` and takes it from there:
   - verifies the version files are in sync
   - builds the app (`pnpm tauri build`) on all platforms in parallel:
     macOS (`aarch64` → `.dmg`), Linux `x86_64` + `arm64` (on Ubuntu 22.04 →
     `.AppImage`, `.deb`, `.rpm` each) and Windows `x86_64` (→ `.msi`, NSIS
     `.exe`) + `arm64` (→ NSIS `.exe` only; WiX/msi doesn't support arm64)
   - creates the `vX.Y.Z` tag and a GitHub release, with every bundle attached
     and the changelog section as the release notes

Nothing happens on merges that don't change the version - regular PRs never trigger a release.

## Choosing the bump

| Type  | When                                              |
| ----- | ------------------------------------------------- |
| patch | Bug fixes, dependency updates, docs               |
| minor | New features, backwards compatible                |
| major | Breaking changes (data format, settings schema)   |

## Known limitations

- The macOS build is signed and notarized (requires the six `APPLE_*` repo secrets; the workflow warns and builds unsigned when they're absent). The Windows installers are not signed - SmartScreen will warn. Homebrew distribution is tracked in [docs/ROADMAP.md](./docs/ROADMAP.md).
- macOS is Apple Silicon only (`aarch64`); an Intel (`x86_64-apple-darwin`) build is a roadmap item.
- Linux/Windows arm64 build on GitHub's arm64 standard runners (`ubuntu-22.04-arm`, `windows-11-arm`), available in private repos since January 2026 (2 vCPUs there, so those legs are slower).
