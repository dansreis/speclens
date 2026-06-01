# Tasks: global search bar

## 1. Component

- [ ] `src/search/SearchBar.tsx` — controlled input with a result dropdown
- [ ] Debounce input by 150ms so the result list doesn't flicker on every keystroke
- [ ] Empty-state copy when no results match

## 2. Indexing

- [ ] Build an in-memory index of `{ kind, title, slug, path }` on app load
- [ ] Refresh the index when the active repo changes
- [ ] Case-insensitive substring match on title and slug

## 3. Integration

- [ ] Slot `<SearchBar />` into the header
- [ ] Wire selection to the existing navigation hook
- [ ] Add `searchOpen` boolean to the app store

## 4. Verification

- [ ] Typing "theme" surfaces the theming capability
- [ ] Selecting a result closes the dropdown and navigates
- [ ] Esc closes the dropdown without navigating
