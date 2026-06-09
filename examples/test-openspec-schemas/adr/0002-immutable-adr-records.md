# 0002. ADRs are immutable once accepted

- Status: accepted
- Date: 2026-02-15

## Context

Architecture Decision Records that can be edited after acceptance lose their value as a historical record. Future readers can no longer trust that an ADR reflects the state of the world when it was accepted. Worse, an ADR amended silently leaves no audit trail of *why* the decision shifted.

We considered two looser variants:

1. **Editable with revision history** — allow edits, rely on `git log` for history. Rejected because most readers don't read git history alongside the ADR.
2. **Editable status field only** — allow `Status: accepted` → `Status: superseded` in-place. Rejected because once a status changes, the rest of the document becomes misleading without a new explanation.

## Decision

Once an ADR's `Status` is set to `accepted`, its file MUST NOT be edited under any circumstances — not the body, not the status, not the date. To change a previously accepted decision, a new ADR is recorded whose `Status` is `accepted, supersedes ADR-NNNN` and whose `Supersedes:` field names the prior id. Readers derive the currently-in-force set by walking the supersession links across the folder.

## Consequences

- **Positive**: the ADR folder is an append-only history. Every decision and every reversal is preserved with its original context.
- **Positive**: tooling can build a supersession graph mechanically from the `Supersedes:` field without parsing prose.
- **Negative**: typos and small clarifications cannot be fixed post-acceptance. Authors must proofread before merge. We accept this tradeoff as the cost of immutability.
- **Neutral**: schemas that include an `adr` artifact must enforce this rule in their instructions to agents.
