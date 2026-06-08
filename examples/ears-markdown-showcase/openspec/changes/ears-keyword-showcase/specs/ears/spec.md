# ears (keyword showcase)

A non-functional spec whose only job is to exercise every keyword the EARS highlighter colors. Use this page to eyeball the palette against the active theme.

## ADDED Requirements

### Requirement: Ubiquitous (SHALL)

The system SHALL render markdown documents. This is the canonical EARS pattern — an unconditional requirement using SHALL as the modal verb.

#### Scenario: Plain SHALL statement
- GIVEN the spec viewer is open on any document
- WHEN the user scrolls
- THEN the document SHALL remain readable at every zoom level

### Requirement: Mandatory (MUST)

Authentication tokens MUST be stored in the OS keychain. MUST is interchangeable with SHALL in RFC 2119 contexts, and the highlighter colors them the same way to reflect that shared meaning.

### Requirement: Recommended (SHOULD)

The viewer SHOULD preload adjacent documents to make navigation feel instant. SHOULD signals a strong recommendation that may be relaxed with justification — visually distinct from SHALL/MUST so the reader notices the weaker obligation.

### Requirement: Optional (MAY)

The viewer MAY cache rendered HTML between sessions. MAY signals a permitted-but-not-required behavior — colored with the lightest weight in the palette so it reads as "allowed."

### Requirement: Event-driven (WHEN)

WHEN the user opens a change, the proposal tab SHALL be selected by default. This is the event-driven EARS pattern: a trigger (`WHEN <event>`) paired with a response (`SHALL <action>`).

#### Scenario: Switching repos
- GIVEN the user has a repo selected
- WHEN the user picks a different repo from the switcher
- THEN the selected change SHALL reset to the first change of the new repo
- AND the active tab SHALL reset to the proposal

### Requirement: State-driven (WHILE)

WHILE a comment selection is active, the floating popover SHALL remain anchored to the selection rectangle. WHILE describes a continuous state — distinct from WHEN's discrete event — so the color is warmer and warmer-weighted.

### Requirement: Feature-driven (WHERE)

WHERE the user has enabled EARS keyword highlighting, the renderer SHALL wrap matching tokens in styled spans. WHERE marks a conditional feature flag — only true when the optional capability is on.

### Requirement: Unwanted behavior (IF / THEN)

IF a markdown file fails to parse, THEN the viewer SHALL fall back to a plain-text render and emit a console warning. IF/THEN pairs handle exceptional or unwanted conditions — the IF is colored as a hazard, THEN as the response.

#### Scenario: Multiple conditions in one sentence
- GIVEN a spec contains both a SHALL and a MUST clause
- WHEN the renderer encounters the same paragraph
- AND the EARS toggle is on
- THEN every keyword SHALL receive its color
- AND no keyword SHALL be skipped because of an adjacent keyword

### Requirement: Mixed scenario (GIVEN / WHEN / THEN / AND)

A single scenario step list exercises the Gherkin-flavored keywords used throughout SpecLens scenarios.

#### Scenario: Comment jump
- GIVEN a comment with a highlight exists on the current document
- AND the comments panel is open
- WHEN the user clicks the comment's quoted snippet
- THEN the viewport SHALL smooth-scroll to the highlight
- AND the highlight SHALL flash briefly to draw the eye

## Negative cases (should NOT be colored)

These exist to confirm the highlighter respects skip rules.

Inline code keeps default styling: `WHEN`, `SHALL`, `IF`, `THEN`.

```
# Inside a fenced block, none of these should be colored:
WHEN the user clicks
THEN the system SHALL respond
GIVEN a token AND a repo
```

Keyboard hints are skipped too: press <kbd>WHEN</kbd>+<kbd>THEN</kbd> to do the impossible.

Lowercase prose is never matched: "when the user clicks the button, the system shall respond" — none of `when`, `shall`, `if`, `then`, `and` are colored because the regex is uppercase-only and word-bounded.

Partial matches are ignored: words like *whenever*, *therein*, *android*, *shallow* contain keyword substrings but should remain plain because they are not whole-word matches.
