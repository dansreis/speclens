# adr-header-parser

A small, dependency-free reader for the metadata block at the top of every ADR file. The cross-reference checker uses this to build the supersession graph, but the parser SHALL stand on its own so other tools (a future `openspec adr graph` renderer, a docs site generator, an editor extension) can consume the same records without depending on the checker pipeline.

## ADDED Requirements

### Requirement: Front-matter detection

The parser SHALL recognise a YAML front-matter block delimited by `---` lines at the very start of the file. WHERE the front-matter block is missing, the parser MUST fall back to a header-scan strategy (see "Header-scan fallback" below) rather than rejecting the document.

#### Scenario: Standard front matter

- GIVEN an ADR whose first three lines are `---`, key/value pairs, and `---`
- WHEN the parser is invoked
- THEN the parsed record SHALL contain every key/value pair from the block
- AND the markdown body returned SHALL start AFTER the closing `---`

#### Scenario: No front matter, header-only document

- GIVEN an ADR whose first line is `# ADR-0042: Use Postgres for catalog state`
- WHEN the parser is invoked
- THEN the parser SHALL NOT throw
- AND the parsed record SHALL be populated by the header-scan fallback

#### Scenario: Malformed YAML

- GIVEN a front-matter block whose YAML body fails to parse
- WHEN the parser is invoked
- THEN the parser SHALL return a record with `status: "unknown"` and `parseError` populated
- AND the parser SHALL NOT throw

### Requirement: Canonical fields

The parser SHALL populate the following fields on every returned record, regardless of input strategy:

- `id` — canonical form `ADR-NNNN` (uppercase, zero-padded to 4 digits)
- `title` — string, may be empty
- `status` — one of `accepted | draft | proposed | superseded | unknown`
- `supersedes` — array of canonical ids (possibly empty)
- `date` — ISO-8601 date string OR null
- `parseError` — string OR null

#### Scenario: Id derivation from filename

- GIVEN a file named `0042-use-postgres-for-catalog.md` with no `id:` in its front matter
- WHEN the parser is invoked
- THEN `record.id` SHALL be `ADR-0042` derived from the filename prefix

#### Scenario: Status normalisation

- GIVEN a front matter field `Status: ACCEPTED, supersedes ADR-0017`
- WHEN the parser is invoked
- THEN `record.status` SHALL be `accepted`
- AND `record.supersedes` SHALL contain `ADR-0017`

#### Scenario: Multiple supersedes entries

- GIVEN a `Supersedes:` field containing a YAML list of two ids
- WHEN the parser is invoked
- THEN both ids SHALL appear in `record.supersedes` in source order

### Requirement: Header-scan fallback

WHEN no YAML front matter is present, the parser SHALL scan the first paragraph block for `Key: value` pairs whose keys match the canonical field set (case-insensitive). The scan SHALL stop at the first blank line or at the first markdown heading after the metadata pairs.

#### Scenario: Inline metadata block

- GIVEN an ADR whose first paragraph is:

```
Status: accepted
Supersedes: ADR-0017
Date: 2026-05-10
```

- WHEN the parser is invoked
- THEN the parsed record SHALL contain the three fields above with normalised values

#### Scenario: Scan stops at first heading

- GIVEN the metadata pairs are followed by a `## Context` heading on the next line
- WHEN the parser is invoked
- THEN the heading SHALL NOT be consumed as metadata
- AND the markdown body returned SHALL begin at the heading line

### Requirement: Streaming-safe interface

The parser SHALL accept a `string` input and SHALL NOT perform any filesystem I/O. Callers (CLI command, supersession graph, editor extensions) are responsible for reading files. This keeps the parser trivially unit-testable and safe to run in browser contexts such as SpecLens itself.

#### Scenario: No filesystem access

- GIVEN the parser is invoked with a string in a sandboxed runtime where `fs` is unavailable
- WHEN the parser runs
- THEN the parser SHALL complete successfully and return a record
- AND no `fs` API SHALL have been called
