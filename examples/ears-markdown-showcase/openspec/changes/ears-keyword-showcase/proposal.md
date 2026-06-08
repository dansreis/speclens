# EARS keyword showcase

## Why

SpecLens colors EARS, Gherkin, and RFC 2119 keywords inline as you read. This change exists purely as a fixture: every supported keyword appears at least once in the spec so designers can eyeball the color palette against the active theme — light, dark, and any future custom themes.

If a keyword's color is unreadable, washes out against the background pill, or clashes with adjacent keywords on the same line, it shows up here first.

## What Changes

- Add a self-contained showcase repo under `examples/ears-markdown-showcase/`.
- The spec exercises **every** highlighted keyword: SHALL, MUST, SHOULD, MAY, WHEN, WHILE, WHERE, IF, THEN, GIVEN, AND.
- The spec also includes **negative cases** — code fences, `<kbd>` tags, and lowercase prose — to confirm those are *not* highlighted.

## Impact

- **Affected specs:** new `ears` capability (showcase only — not real product behavior).
- **Affected code:** none. This is fixture data.
- **Out of scope:**
  - Real EARS grammar validation.
  - Theming the keyword colors per-user.
