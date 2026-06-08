# Design: ADR cross-reference checker

## Context

ADRs in `spec-driven-with-adr` follow a frozen-once-accepted contract: each ADR's content is immutable, supersession is recorded via the `Supersedes:` field of a newer ADR, and the in-force set at any moment is derived by walking those links. `design.md` documents typically cite ADRs by their canonical id (e.g. `ADR-0042`).

When a later ADR supersedes an earlier one, prior designs continue to cite the older id. That's expected — old changes are frozen too. The problem is **new** designs citing **outdated** ids, which silently freeze a stale commitment into the new change.

## Goals

- Detect references to non-existent ADRs.
- Detect references to superseded ADRs (with a hint pointing at the in-force replacement).
- Detect references to draft (non-accepted) ADRs.
- Fail loudly during `apply` so broken references can't reach merge.

## Non-Goals

- Auto-rewrite. ADR references are claims; rewriting them silently is worse than letting the author resolve manually.
- Cross-repository ADR resolution. ADRs are repo-local by the `spec-driven-with-adr` definition.

## Decisions

### Reference grammar

A match is `\bADR-\d{4}\b`, case-insensitive. Four digits is the schema's filename convention; relaxing this would catch typos but also yield false positives in unrelated prose.

**Alternatives considered:**

| Option | False positives | Catches typos |
| ------ | --------------- | ------------- |
| `\bADR-\d{4}\b` (chosen) | none | no |
| `\bADR-\d+\b` | rare | yes |
| Markdown link `[ADR-NNNN](path)` only | none | no, and misses inline citations |

We start strict; if authors complain, relax to `\d+` later.

### Verdict types

Each reference gets one of:

- `ok` — file exists, currently in force.
- `missing` — no matching file under `<repo>/adr/`.
- `superseded` — file exists but a newer ADR's `Supersedes:` field points at it.
- `draft` — file's `Status:` field is not `accepted`.

### Build the supersession graph

Read every `<repo>/adr/*.md`. Parse the YAML front matter (or the minimal header block — `spec-driven-with-adr` doesn't strictly require front matter). Build:

```ts
type AdrRecord = {
  id: string;          // "ADR-0042"
  status: string;      // "accepted" | "draft" | "..."
  supersedes: string[]; // canonical ids
};
```

In-force = `{ a | a.status === "accepted" && no other accepted ADR has a.id in its supersedes }`.

### Where the check runs

Two integration points:

1. **`openspec adr check <change>`** — explicit invocation, prints a table, exit code 1 if any non-`ok` verdict.
2. **`openspec apply` precheck** — same logic, refuses to begin apply when verdicts exist. Bypassable with `--force-adr` for emergencies (logs a warning).

## Risks / Trade-offs

- **Risk**: false positives on prose that happens to look like an ADR id (e.g. `ADR-0001 is a placeholder example in this doc`).
  **Mitigation**: opt-out via inline comment `<!-- adr-check: ignore -->` on the same line.

- **Risk**: noisy output when a change cites many ADRs intentionally for historical context.
  **Mitigation**: an `<!-- adr-check: history-only -->` block-level marker.

## Migration Plan

This is additive. No migration needed. Existing changes that have already been applied stay frozen.

## Open Questions

- Should `superseded` block apply or just warn? Leaning warn — supersession is a stylistic concern, not a correctness one.
- Do we want `openspec adr graph` as a sibling command to render the supersession DAG? Out of scope for this change but the parser would already exist.
