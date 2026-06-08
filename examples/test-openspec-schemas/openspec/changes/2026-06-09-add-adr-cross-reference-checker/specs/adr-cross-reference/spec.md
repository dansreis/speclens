# adr-cross-reference

## ADDED Requirements

### Requirement: ADR reference parser

The system SHALL extract all `ADR-NNNN` references from a markdown document, where `NNNN` is exactly four digits. Matches MUST be case-insensitive and word-bounded.

#### Scenario: Inline citation

- GIVEN a `design.md` containing the sentence `As established in ADR-0042, we use Postgres for catalog state.`
- WHEN the parser is invoked on the file
- THEN the result SHALL contain the canonical id `ADR-0042`
- AND the result SHALL include the line number and column of the match

#### Scenario: Multiple references on one line

- GIVEN a paragraph mentioning `ADR-0042` and `ADR-0079` in the same sentence
- WHEN the parser is invoked
- THEN both ids SHALL be returned with distinct match positions

#### Scenario: Partial match is ignored

- GIVEN a paragraph containing the string `ADR-12345`
- WHEN the parser is invoked
- THEN no reference SHALL be returned because the digit count does not equal four

#### Scenario: Ignore marker

- GIVEN a line ending with `<!-- adr-check: ignore -->`
- WHEN the parser is invoked
- THEN no references on that line SHALL appear in the result

### Requirement: Supersession graph

The system SHALL build a supersession graph from `<repo>/adr/*.md` files. A node represents an ADR; an edge `B → A` means ADR B supersedes ADR A. An ADR is **in force** WHEN its `Status` field is `accepted` AND no other accepted ADR has it listed in its `Supersedes` field.

#### Scenario: Linear chain

- GIVEN three ADRs where `ADR-0003` supersedes `ADR-0002`, which supersedes `ADR-0001`, and all three have `Status: accepted`
- WHEN the in-force set is computed
- THEN only `ADR-0003` SHALL appear in the in-force set

#### Scenario: Draft ADR is excluded

- GIVEN an ADR with `Status: draft`
- WHEN the in-force set is computed
- THEN the draft ADR SHALL NOT appear regardless of whether it supersedes accepted ADRs

### Requirement: Verdicts

For each reference returned by the parser, the checker SHALL emit exactly one verdict from the set `{ ok, missing, superseded, draft }`.

#### Scenario: Verdict — ok

- GIVEN `ADR-0042` exists with `Status: accepted` and no later ADR supersedes it
- WHEN the verdict is computed for a reference to `ADR-0042`
- THEN the verdict SHALL be `ok`

#### Scenario: Verdict — superseded

- GIVEN `ADR-0042` has `Status: accepted`
- AND `ADR-0079` has `Status: accepted` and `Supersedes: ADR-0042`
- WHEN the verdict is computed for a reference to `ADR-0042`
- THEN the verdict SHALL be `superseded`
- AND the verdict payload SHALL include the in-force replacement id `ADR-0079`

#### Scenario: Verdict — missing

- GIVEN no file matching `ADR-0999*.md` exists under `<repo>/adr/`
- WHEN the verdict is computed for a reference to `ADR-0999`
- THEN the verdict SHALL be `missing`

### Requirement: CLI command

The system SHALL provide a `openspec adr check <change>` command that runs the parser + verdict pipeline against the change's `design.md` and prints a table.

#### Scenario: Exit code

- WHEN `openspec adr check <change>` produces at least one non-`ok` verdict
- THEN the process SHALL exit with code 1

- WHEN every verdict is `ok` (or the change has no `design.md`)
- THEN the process SHALL exit with code 0

### Requirement: Apply precheck

The `apply` command SHALL run the ADR cross-reference checker as a precheck. IF any verdict is `missing` or `draft`, THEN apply SHALL refuse to begin unless the user passes `--force-adr`.

#### Scenario: Refuse on missing

- GIVEN a `design.md` referencing `ADR-0999` which does not exist
- WHEN the user runs `openspec apply <change>`
- THEN apply SHALL refuse to start and SHALL print the offending reference

#### Scenario: Warn on superseded

- GIVEN a `design.md` referencing only superseded ADRs (no missing or draft)
- WHEN the user runs `openspec apply <change>`
- THEN apply SHALL print a warning listing each superseded reference and its in-force replacement
- AND apply SHALL proceed without `--force-adr`
