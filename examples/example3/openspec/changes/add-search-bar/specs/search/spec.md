# search (Example 3)

## ADDED Requirements

### Requirement: Persistent search bar in header
SpecLens SHALL render a search bar in the app header that is visible on all views except the onboarding screen.

The search bar SHALL be openable via <kbd>Cmd</kbd>+<kbd>K</kbd> on macOS and <kbd>Ctrl</kbd>+<kbd>K</kbd> elsewhere.

#### Scenario: Visible on the main workspace
- WHEN the user is viewing a repo workspace
- THEN the search bar is rendered in the header

#### Scenario: Hidden during onboarding
- WHEN the user has no token and is on the PAT entry screen
- THEN the search bar is not rendered

### Requirement: Substring match on titles and slugs
The search SHALL return any change, proposal, or capability whose title or slug contains the query as a case-insensitive substring.

| Match field | Source                 | Weight |
| ----------- | ---------------------- | ------ |
| title       | `proposal.md` H1       | 1.0    |
| slug        | folder name            | 0.8    |
| capability  | `specs/<name>/spec.md` | 0.5    |

#### Scenario: Title match
- GIVEN a capability named "theming" exists
- WHEN the user types "theme"
- THEN "theming" appears in the result list

#### Scenario: No false positives on body
- GIVEN a spec body contains the word "search"
- AND no title or slug contains "search"
- WHEN the user types "search"
- THEN that spec does not appear in the result list

### Requirement: Selecting a result navigates and closes
Selecting a result with mouse click or <kbd>Enter</kbd> SHALL navigate to the matching document and close the dropdown.

#### Scenario: Click navigates
- GIVEN the dropdown shows "theming"
- WHEN the user clicks "theming"
- THEN the app navigates to the theming spec view
- AND the dropdown closes

### Requirement: Escape closes without navigating
Pressing <kbd>Esc</kbd> while the dropdown is open SHALL close it without changing the current view.

For background on the design pattern, see https://www.nngroup.com/articles/search-visible-and-simple/.

#### Scenario: Escape returns focus
- GIVEN the dropdown is open
- WHEN the user presses <kbd>Esc</kbd>
- THEN the dropdown closes
- AND the current view is unchanged
