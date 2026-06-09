# 0004. ADR ids use four-digit zero-padded sequence

- Status: accepted, supersedes ADR-0003
- Date: 2026-05-15
<!-- Supersedes: ADR-0003 -->

## Context

[ADR-0003](./0003-adr-id-format-three-digits.md) settled on three-digit ids, assuming we'd never reach 999 ADRs in a single repository. Three months in, the `intent-driven` and `spec-driven-with-adr` schemas have both started generating ADRs from automated workflows. Two adopter repositories are already in the 200s. Extrapolating, a busy product team would plausibly cross 1000 within a year.

Renaming files retroactively conflicts with [ADR-0002](./0002-immutable-adr-records.md) (ADRs are immutable). The cheapest fix is to widen the format before anyone hits the boundary.

## Decision

ADR ids use the format `NNNN-kebab-title.md` where `NNNN` is the next available four-digit zero-padded sequence number. Existing ADRs created under the three-digit convention retain their filenames; references to them continue to resolve. New ADRs use the four-digit form starting at the next available sequence (`0004` if no three-digit ADRs exist; otherwise the next integer after the highest three-digit id, zero-padded to four).

## Consequences

- **Positive**: the format scales comfortably for the realistic lifetime of any repository (up to 9999 ADRs).
- **Positive**: legacy three-digit references still resolve because the digit count is greater-or-equal — tooling that parses `ADR-\d{3,4}` accepts both forms.
- **Negative**: ADR cross-reference checkers (such as the one proposed in `2026-06-09-add-adr-cross-reference-checker`) need to handle both 3- and 4-digit ids during the transition. Captured as an open question in that change's design.
- **Neutral**: the canonical display form is the file's actual id — three-digit ADRs display as `ADR-042`, four-digit as `ADR-0042`. No backfill required.
