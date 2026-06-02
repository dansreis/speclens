# Tasks: keyboard shortcuts (Example 3)

## 1. Hook scaffolding

- [x] `src/shortcuts/useGlobalShortcuts.ts` — registers a single `keydown` listener on `window`
- [x] Detect platform (`navigator.platform`) to map `Cmd` on macOS and `Ctrl` elsewhere
- [x] Provide a `register(combo, handler)` API and clean up listeners on unmount

## 2. Bindings

- [x] `Cmd/Ctrl+K` → open the search bar
- [ ] `Cmd/Ctrl+1..9` → switch repo tabs by index
- [ ] `Esc` → close the topmost modal or dropdown

## 3. Conflict handling

- [ ] Skip the handler when focus is inside an `<input>` or `<textarea>` (except `Esc`)
- [ ] Add a guard against repeated key events when a key is held down

## 4. Verification

- [ ] `Cmd+K` opens search from any view
- [ ] Tab switching works when focus is on the workspace
- [ ] `Esc` doesn't navigate away from the current view, only closes overlays
