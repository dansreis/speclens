# Add a global search bar (Example 4)

## Why

Users currently have to scroll through long lists to find what they're looking for. A persistent search bar in the header would let them jump directly to a spec, proposal, or change by name.

For prior art, see the search experience in https://github.com and https://linear.app — both keyboard-first, dropdown-driven, and instant.

## What Changes

Additive (no existing behavior is modified).

- Add a **search bar** component in the app header, always visible across all views.
- Searches match on the title and slug of any change, proposal, or capability spec.
- Selecting a result navigates directly to that document and closes the search.

## Alternatives considered

| Option                | Latency | Bundle cost | Feels native |
| --------------------- | ------- | ----------- | ------------ |
| In-memory substring   | <1 ms   | none        | yes          |
| Fuse.js fuzzy match   | ~5 ms   | +12 KB      | yes          |
| Server-side full-text | network | none        | no           |

We're starting with **in-memory substring** — fastest, no new dep, fine for the data sizes we have.

## Impact

- **Affected specs:** new `search` capability.
- **Affected code:** new `Search.tsx` component, header layout updated to include it, store gets `searchOpen` flag.
- **External dependencies:** none.
- **Out of scope:**
  - ~~Full-text search across document bodies~~ — titles/slugs only for now.
  - ~~Search history or saved searches~~.
  - Fuzzy matching — exact-substring is fine for the first pass.

<details>
<summary>Open questions</summary>

- Do we want a recents list under the search bar when it's empty?
- Should `Cmd+K` toggle the bar's focus, or only open it (never close)?
- How do we handle two changes with identical titles across active and archive?

</details>
