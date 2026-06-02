# Tasks: global search bar (Example 1)

## 1. Component

- [ ] `src/search/SearchBar.tsx` — controlled input with a result dropdown
  - [ ] Highlight the active result on hover
  - [ ] Up/Down arrow keys move the selection
- [ ] Debounce input by 150ms so the result list doesn't flicker on every keystroke
- [ ] Empty-state copy when no results match

## 2. Indexing

- [ ] Build an in-memory index of `{ kind, title, slug, path }` on app load
- [ ] Refresh the index when the active repo changes
- [ ] ~~Pre-compute Levenshtein distance for every entry~~ — switched to substring matching, see proposal
- [ ] Case-insensitive substring match on title and slug

## 3. Integration

- [ ] Slot `<SearchBar />` into the header
- [ ] Wire selection to the existing navigation hook
- [ ] Add `searchOpen` boolean to the app store

## 4. Verification

- [ ] Typing "theme" surfaces the theming capability
- [ ] Selecting a result closes the dropdown and navigates
- [ ] Esc closes the dropdown without navigating
