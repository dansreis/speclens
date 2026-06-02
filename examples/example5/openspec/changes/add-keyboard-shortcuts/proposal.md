# Add keyboard shortcuts for navigation (Example 5)

## Why

Power users want to move between views without reaching for the mouse. Adding a small set of standard shortcuts (open search, jump between tabs, escape modals) makes SpecLens feel like a real desktop tool rather than a browser app in a window.

## What Changes

Additive (no existing behavior is modified).

- Introduce a global key-handler hook listening on `window`.
- Bind `Cmd/Ctrl+K` to open the search bar (depends on the `search` capability).
- Bind `Cmd/Ctrl+1..9` to switch between repo tabs.
- Bind `Esc` to close any open modal or dropdown.

## Impact

- **Affected specs:** new `shortcuts` capability.
- **Affected code:** new `useGlobalShortcuts.ts` hook, wired in the app shell.
- **External dependencies:** none.
- **Out of scope:**
  - User-customisable bindings (defer until there's demand).
  - A shortcuts cheatsheet overlay (nice-to-have, separate change).
