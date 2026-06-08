# Design: Global search bar

## Goals

- **Instant.** First keystroke to first result in under 16 ms — one frame.
- **Keyboard-first.** Cmd/Ctrl + K opens; ↑/↓ navigate; Enter selects; Esc dismisses.
- **One source of truth.** The same index drives header search, palette search, and any future "jump to" affordances.

## Architecture

```
┌──────────────────────────────┐
│ Header → SearchTrigger       │
│   (button + ⌘K hint)         │
└──────────────┬───────────────┘
               │ click / ⌘K
               ▼
        SearchPalette (modal)
        ├─ TextField (autofocus)
        ├─ ResultList (virtualized after 100 rows)
        └─ uses useSearchIndex()
               ▲
               │
       ┌───────┴────────┐
       │ useSearchIndex │   memoized over repos
       └────────────────┘
```

## Index shape

```ts
interface SearchEntry {
  kind: "change" | "spec";
  repoId: string;
  slug: string;          // change slug or capability name
  title: string;
  haystack: string;      // lowercased "<title> <slug>"
}
```

The index is built once per repo set with `useMemo`. We don't store rendered HTML — selection happens on metadata only, navigation hydrates the document.

## Ranking

WHEN the query is empty, THEN the list SHALL show the 10 most recently created changes.

WHEN the query is non-empty, results are ordered by:

1. Title `startsWith(query)` — exact prefix wins.
2. Title `includes(query)` — substring next.
3. Slug `includes(query)` — slugs are noisier, ranked below titles.

Ties broken by `createdAt` descending.

## Non-goals (this slice)

- Full-text search over document bodies. See follow-up.
- Fuzzy matching (typos, transpositions). The Fuse.js path stays on the shelf until users actually complain.
- Recents persistence. Cmd-K from an empty palette already shows recents; saving them across launches is later.

## Open risks

- **Result density.** Across 5 example repos the list comfortably fits without virtualization. With real GitHub repos (50+ changes each), we'll hit the 100-row threshold quickly — `react-virtuoso` is the planned escape hatch.
- **Cmd+K collisions.** Browsers eat Cmd+K for address bar focus on some platforms. Tauri's native window doesn't, but `pnpm dev` in the browser does — document it.
