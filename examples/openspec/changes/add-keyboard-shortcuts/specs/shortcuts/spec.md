# shortcuts

## ADDED Requirements

### Requirement: Platform-aware modifier key
SpecLens SHALL treat `Cmd` as the primary modifier on macOS and `Ctrl` on other operating systems. Bindings SHALL be documented and rendered using the platform's modifier.

#### Scenario: macOS uses Cmd
- GIVEN the user is on macOS
- WHEN the user presses `Cmd+K`
- THEN the search bar opens

#### Scenario: Linux/Windows uses Ctrl
- GIVEN the user is on Linux or Windows
- WHEN the user presses `Ctrl+K`
- THEN the search bar opens

### Requirement: Esc closes the topmost overlay
Pressing `Esc` SHALL close the topmost open modal, dropdown, or search bar without navigating away from the current view.

#### Scenario: Closing the search dropdown
- GIVEN the search dropdown is open
- WHEN the user presses `Esc`
- THEN the dropdown closes
- AND the underlying view is unchanged

### Requirement: Shortcuts ignored in text inputs
Shortcut bindings (other than `Esc`) SHALL be suppressed when focus is inside a text input or textarea, so users can type normally.

#### Scenario: Typing "k" in a search field
- GIVEN focus is in the search input
- WHEN the user types the letter `k`
- THEN no shortcut handler runs
- AND the letter appears in the input
