# 0005. ADR cross-reference checker is strict by default

- Status: accepted
- Date: 2026-06-09

## Context

The change `2026-06-09-add-adr-cross-reference-checker` introduces a linter that validates `ADR-NNNN` references in `design.md`. The design surfaces two open questions worth promoting to durable decisions:

1. **What does the checker do when it finds a superseded reference?** Either fail (refuse `apply`) or warn (log but proceed). The design leans warn, but reasonable people disagreed in review.
2. **Does the checker need a way to opt out per-line?** Documentation about ADRs themselves will inevitably mention ids in prose contexts where checking is noise.

Without nailing these down, every subsequent change that touches the checker has to re-litigate. Recording them as ADRs prevents drift.

## Decision

The ADR cross-reference checker SHALL adopt the following defaults:

1. **Missing or draft references block apply.** The author must either resolve the reference, mark the line with the opt-out marker, or override with `--force-adr`.
2. **Superseded references emit a warning and proceed.** Supersession is stylistic — a stale reference is not a correctness failure, and forcing rewrites would create churn in archived changes. The warning includes the in-force replacement id so the author can rewrite if they want to.
3. **The opt-out marker is `<!-- adr-check: ignore -->` at end-of-line.** A block-level `<!-- adr-check: history-only -->` is also accepted to silence all checks within a fenced section. No new syntax is added beyond these two markers.

## Consequences

- **Positive**: the contract between author and checker is explicit. Reviewers know which verdicts are blocking and which are advisory.
- **Positive**: the opt-out grammar is HTML comments, so it works inside any markdown context including code fences and tables without affecting rendering.
- **Negative**: revisiting the warn/block boundary later requires a superseding ADR. We're betting that the warn-on-superseded default is correct enough that the cost of a future ADR is acceptable.
- **Neutral**: this ADR is referenced from `design.md` of the originating change, which both demonstrates the checker's expected input and exercises the parser's "ignore marker" scenario in a self-referential way.
