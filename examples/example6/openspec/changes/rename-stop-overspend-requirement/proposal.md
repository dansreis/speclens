# Rename Stop-Overspend Requirement

## Why

The budget-pacing spec contains a requirement named "Stop overspend within 60 seconds". The name describes the outcome from a billing point of view — what the brand cares about — but the requirement itself is about a specific bid-engine behaviour: suspend bidding when the budget is exhausted, and propagate that suspension to the cache within 60 seconds.

When the team onboarded two new engineers this quarter, both initially read this requirement as "the platform guarantees no overspend ever occurs", which is a stronger guarantee than the requirement actually makes. Renaming the requirement to describe what the bid engine does — not what the billing outcome is — removes the systematic misreading without changing any behaviour.

A documentation refresh shipping next month references the bid-engine and pacing requirements by name. We want the renamed name in place before that ships.

## What Changes

- Rename the requirement "Stop overspend within 60 seconds" to "Suspend bidding on budget exhaustion within 60 seconds" in `budget-pacing`.
- No behavioural change. The scenarios are unchanged. The requirement number, ordering, and content are unchanged.

## Capabilities

- **Modified Capabilities**:
  - `budget-pacing` — single requirement renamed; no behaviour changed

## Impact

- Internal documentation refresh (the upcoming engineering-onboarding guide) can reference the requirement by its less-misleading name.
- The `add-budget-pacing-v2-smoothing` change (in flight) references this requirement by the old name; coordinate with that change's owner to update the reference before either change archives.
