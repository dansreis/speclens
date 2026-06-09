# 0003. ADR ids use three-digit zero-padded sequence

- Status: superseded
- Date: 2026-02-20

## Context

ADR filenames need a stable id format so cross-references are unambiguous and the folder sorts in creation order. Three digits seems generous — at 999 ADRs per repository we'll have other problems to solve.

## Decision

ADR ids use the format `NNN-kebab-title.md` where `NNN` is the next available three-digit zero-padded sequence number.

## Consequences

- **Positive**: filesystem-level sort matches insertion order.
- **Positive**: ids are short enough to remember verbally during reviews ("see ADR-042").
- **Negative**: a runaway repository could overflow the three-digit window. Felt unlikely.
