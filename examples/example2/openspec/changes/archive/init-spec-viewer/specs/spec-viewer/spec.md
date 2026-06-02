# spec-viewer (Example 2)

## ADDED Requirements

### Requirement: Render proposal, tasks, and specs from a change folder
The viewer SHALL accept a path to an OpenSpec change folder and render `proposal.md`, `tasks.md`, and each `specs/<capability>/spec.md` it contains.

#### Scenario: All three documents present
- GIVEN a change folder containing `proposal.md`, `tasks.md`, and at least one `specs/<capability>/spec.md`
- WHEN the viewer opens that folder
- THEN three tabs are rendered: Proposal, Tasks, and Specs

#### Scenario: Missing tasks file
- GIVEN a change folder with `proposal.md` but no `tasks.md`
- WHEN the viewer opens that folder
- THEN the Tasks tab shows an empty-state message

### Requirement: GitHub-flavoured markdown
Markdown SHALL be rendered with GFM extensions enabled: tables, fenced code blocks, and task lists.

#### Scenario: Table renders as a table
- GIVEN a proposal contains a GFM table
- WHEN the proposal is rendered
- THEN the output is an HTML `<table>`, not raw markdown text

### Requirement: Task completion counts
The Tasks tab header SHALL display a `done / total` count derived from `- [x]` / `- [ ]` items in `tasks.md`, excluding any inside fenced code blocks.

#### Scenario: Mixed completion
- GIVEN `tasks.md` contains four `- [ ]` items and two `- [x]` items
- WHEN the Tasks tab renders
- THEN the header shows `2 / 6`

#### Scenario: Checkboxes in code blocks ignored
- GIVEN `tasks.md` contains a fenced code block with `- [x] example`
- AND no other checkboxes appear in the file
- WHEN the Tasks tab renders
- THEN the header shows `0 / 0`
