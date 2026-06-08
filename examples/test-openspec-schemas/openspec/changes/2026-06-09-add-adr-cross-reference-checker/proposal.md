# Add ADR cross-reference checker

## Why

The `spec-driven-with-adr` workflow encourages design.md to reference durable ADRs that live under `<repo>/adr/`. In practice, those references drift: a design cites `ADR-0042` that was later superseded by `ADR-0079`, or refers to an ADR that doesn't exist at all. Reviewers catch some of these by hand; many slip through.

A small command — `openspec adr check <change>` — could read every change's `design.md`, extract `ADR-NNNN` mentions, and verify against the in-force ADR set. Catching this at commit time is much cheaper than catching it at archive time.

## What Changes

Additive (no existing behavior is modified).

- Add a new CLI subcommand `openspec adr check <change>` that:
  - Parses `design.md` for `ADR-NNNN` mentions (case-insensitive, word-bounded).
  - Cross-references each mention against the supersession graph built from `<repo>/adr/*.md`.
  - Reports any references that are missing, superseded, or pointing to a draft ADR.
- Extend the `apply` precheck to run the same check and refuse to mark apply complete when references are broken.

## Capabilities

- **New Capabilities**:
  - `adr-header-parser`: a standalone reader for the metadata block at the top of every ADR file. The cross-reference checker depends on it, but it lives on its own so other tools (graph renderer, docs site, editor extension) can reuse it.
  - `adr-cross-reference`: the linter behavior — parser → supersession graph → verdict → CLI + apply precheck integration.

- **Modified Capabilities**: _none_

## Impact

- **Affected code**: new `adrCheck.ts` command, ADR parser utility, apply-precheck wiring.
- **External dependencies**: none.
- **Out of scope**:
  - ~~Auto-rewrite of superseded ADR references~~ — too risky; flag only.
  - ~~Visualization of the supersession graph~~ — separate change.
