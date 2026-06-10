# Add Brand-Safety Keyword Blocklist

## Why

Brand-safety profiles currently support category-block rules and a small set of content rules. Multiple retailers have asked for a finer-grained tool: keyword blocklists that match against creative metadata (title, alt text, brand name) and reject any creative whose metadata matches a configured term.

Concrete example: a grocery retailer wants to block any creative whose brand name contains the word "diet" on its kids-aisle slot. Category rules cannot express this. Keyword blocklists can.

## What Changes

- New rule type `keyword-block` for brand-safety profiles.
- Each rule carries a list of terms (case-insensitive, accent-insensitive) and a metadata-field selector.
- Decisioning evaluates keyword-block rules alongside the existing category and content rules.

## Capabilities

- **Modified Capabilities**:
  - `brand-safety` — new rule type ADDED; existing rule evaluation unchanged

## Impact

- New rule-evaluation code path in the decisioning hot-path snapshot. Benchmarked against the bid-engine 80ms p99 budget; expected impact < 0.5ms.
- Rule-management UI gets a new rule-type form.
- Audit channel logs the matching term when a keyword-block rule rejects a creative.
