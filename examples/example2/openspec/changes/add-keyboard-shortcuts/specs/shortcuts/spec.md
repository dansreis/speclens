# shortcuts (Example 2)

## ADDED Requirements

### Requirement: Platform-aware modifier key
SpecLens SHALL treat <kbd>Cmd</kbd> as the primary modifier on macOS and <kbd>Ctrl</kbd> on other operating systems. Bindings SHALL be documented and rendered using the platform's modifier.

| Action            | macOS                                  | Linux / Windows                         |
| ----------------- | -------------------------------------- | --------------------------------------- |
| Open search       | <kbd>Cmd</kbd>+<kbd>K</kbd>            | <kbd>Ctrl</kbd>+<kbd>K</kbd>            |
| Switch tab 1..9   | <kbd>Cmd</kbd>+<kbd>1</kbd>..<kbd>9</kbd> | <kbd>Ctrl</kbd>+<kbd>1</kbd>..<kbd>9</kbd> |
| Close overlay     | <kbd>Esc</kbd>                         | <kbd>Esc</kbd>                          |

#### Scenario: macOS uses Cmd
- GIVEN the user is on macOS
- WHEN the user presses <kbd>Cmd</kbd>+<kbd>K</kbd>
- THEN the search bar opens

#### Scenario: Linux/Windows uses Ctrl
- GIVEN the user is on Linux or Windows
- WHEN the user presses <kbd>Ctrl</kbd>+<kbd>K</kbd>
- THEN the search bar opens

### Requirement: Esc closes the topmost overlay
Pressing <kbd>Esc</kbd> SHALL close the topmost open modal, dropdown, or search bar without navigating away from the current view.

#### Scenario: Closing the search dropdown
- GIVEN the search dropdown is open
- WHEN the user presses <kbd>Esc</kbd>
- THEN the dropdown closes
- AND the underlying view is unchanged

### Requirement: Shortcuts ignored in text inputs
Shortcut bindings (other than <kbd>Esc</kbd>) SHALL be suppressed when focus is inside a text input or textarea, so users can type normally.

For inspiration on cross-platform key handling, see https://github.com/jamiebuilds/tinykeys.

#### Scenario: Typing "k" in a search field
- GIVEN focus is in the search input
- WHEN the user types the letter `k`
- THEN no shortcut handler runs
- AND the letter appears in the input
