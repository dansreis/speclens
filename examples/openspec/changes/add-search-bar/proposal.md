# Add a global search bar

## Why

Users currently have to scroll through long lists to find what they're looking for. A persistent search bar in the header would let them jump directly to a spec, proposal, or change by name.

## What Changes

Additive (no existing behavior is modified).

- Add a **search bar** component in the app header, always visible across all views.
- Searches match on the title and slug of any change, proposal, or capability spec.
- Selecting a result navigates directly to that document and closes the search.

## Impact

- **Affected specs:** new `search` capability.
- **Affected code:** new `Search.tsx` component, header layout updated to include it, store gets `searchOpen` flag.
- **External dependencies:** none.
- **Out of scope:**
  - Full-text search across document bodies (titles/slugs only for now).
  - Search history or saved searches.
  - Fuzzy matching — exact-substring is fine for the first pass.
