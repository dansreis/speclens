# Tasks: ADR cross-reference checker

## 1. Parser

- [x] 1.1 Implement `parseAdrReferences(text)` matching `\bADR-\d{4}\b` case-insensitively
- [x] 1.2 Return line + column for each match
- [x] 1.3 Honour `<!-- adr-check: ignore -->` end-of-line marker
- [ ] 1.4 Add unit tests for partial-match rejection and ignore markers

## 2. ADR header reader

- [x] 2.1 Read `<repo>/adr/*.md` and extract id, status, supersedes
- [ ] 2.2 Tolerate missing front matter (fall back to scanning the document head)
- [ ] 2.3 Add fixture ADRs covering accepted / draft / superseded chains

## 3. Verdict engine

- [x] 3.1 Build in-force set from header records
- [x] 3.2 Implement `verdict(reference, graph)` returning one of `ok | missing | superseded | draft`
- [ ] 3.3 Include in-force replacement id in superseded verdict payload

## 4. CLI

- [ ] 4.1 Register `openspec adr check <change>` subcommand
- [ ] 4.2 Render the verdict table with colour-coded severity
- [ ] 4.3 Exit code 1 when any verdict is non-`ok`
- [ ] 4.4 Document the command in the schema README

## 5. Apply precheck

- [ ] 5.1 Wire the checker into the `apply` precheck path
- [ ] 5.2 Implement `--force-adr` bypass with a console warning
- [ ] 5.3 Run `openspec schema review spec-driven-with-adr` before marking apply complete

## 6. Documentation

- [ ] 6.1 Update the `spec-driven-with-adr` schema README with the new precheck
- [ ] 6.2 Add a worked example showing one `ok`, one `superseded`, one `missing`
