# Design: Global keyboard shortcuts

## Layering

A single `useGlobalShortcuts()` hook mounted once at the app shell. It owns the `window`-level keydown listener so feature code never has to wire its own.

```
┌─────────────────────┐
│ App.tsx             │
│  └ useGlobalShortcuts() ──┐
└─────────────────────┘     │
                            ▼
                     dispatch(action)
                            │
   ┌────────────────────────┼────────────────────────┐
   ▼                        ▼                        ▼
useAppStore.setView   useAppStore.setRepo    setSearchOpen(true)
```

The hook does **not** call feature functions directly — it dispatches via the store. That keeps the binding table declarative and testable without DOM.

## Binding table

| Combo            | Action             | Notes                                |
| ---------------- | ------------------ | ------------------------------------ |
| ⌘K / Ctrl+K      | Open search        | Toggles, not just opens              |
| ⌘1..⌘9 / Ctrl+1..9 | Switch repo by index | No-op past `repos.length`         |
| ⌘+ / ⌘- / ⌘0     | Zoom in / out / reset markdown | Existing — keep as-is    |
| Esc              | Close topmost modal | Search → Stats → Comments pinned    |

## Skip rules

The handler short-circuits when the event target is editable:

- `tagName === "INPUT"`
- `tagName === "TEXTAREA"`
- `isContentEditable === true`

This prevents ⌘K from hijacking palette typing, and Esc from closing the comments panel mid-edit.

## Platform differences

WHERE the platform is macOS, the modifier is `Cmd`. WHERE the platform is anything else, it's `Ctrl`. We detect with `e.metaKey || e.ctrlKey` rather than UA sniffing — both fire correctly per-OS, and the lazy "or" handles users on weird keyboards.

## Why not react-hotkeys-hook?

Considered. Trade-off:

| Option           | Bundle | Re-renders | Composability |
| ---------------- | ------ | ---------- | ------------- |
| Native hook      | 0      | None       | Manual         |
| react-hotkeys-hook | +3 KB | One per binding | Excellent  |

We have <10 bindings and they're stable. The native hook wins for now; revisit if the table grows past ~20 entries.
