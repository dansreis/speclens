# Design: Checks and Claims

Status: **Feature 1 (Checks) is implemented** (`feature/spec-checks`); see the implementation notes in that section for where it deviates from or extends the sketch below. Features 2 (Claims) and 3 (Export) are not started.

## Thesis

Agents make producing code cheap, so verification of *intent* becomes the bottleneck. SpecLens sits exactly at the layer where intent is inspected before it becomes code. The long-term direction is:

> Turn human-readable specifications into explicit, checkable claims - and eventually track the evidence that they hold.

This document covers only the first slice of that: three features that are shippable with what the app already has, plus a revision of the "no LLM" stance on the current roadmap.

1. **Checks** - deterministic spec linting (structural, consistency, language).
2. **Claims** - parse EARS-shaped requirements into structured claims (trigger / preconditions / outcomes / invariants), show gaps, let the user approve the interpretation.
3. **Export** - emit approved claims as stable JSON that a coding agent can consume.

Explicitly out of scope for this slice (see "Deferred"): verification adapters, test/evidence tracking, SMT contradiction detection, CLI/MCP packaging.

## Revised LLM policy

The roadmap currently frames validation as "Spec validation without LLMs". That framing is half right: determinism should be the default, but it is a *preference ordering*, not a ban - especially now that the local AI stack (llama.cpp + Ollama via the `ai_*` commands) is implemented and preserves the no-network promise.

New policy - **deterministic first, local LLM assist second, never silent**:

- **Tier 0 (always on, no model required).** Everything that can be computed is computed: all lint checks, EARS grammar parsing, readiness gaps. These run for every user, produce the same result every time, and are fully explainable.
- **Tier 1 (opt-in, local model required).** Where parsing fails - a requirement written in free prose - the user can invoke "Interpret with AI" on that requirement. The local model proposes a structured claim.
- **Guardrails on Tier 1:**
  - LLM output must validate against the same claim schema the parser emits. Use llama.cpp grammar-constrained sampling (GBNF) so the model *cannot* produce malformed output; Ollama backend falls back to JSON-schema validation + retry.
  - Every claim carries `source: "parsed" | "inferred"`. Inferred claims are visually distinct and start `unreviewed`.
  - An inferred claim is never exported as approved without an explicit human approval click. Wrong-but-confident formalization is the failure mode this exists to prevent.
  - Per-action invocation only. No background LLM passes over the whole repo.

Roadmap change if this doc is approved: retitle the feature to "Spec validation (deterministic core, local-AI assist)" and fold the tier language in. *(Done - see docs/ROADMAP.md.)*

## Feature 1: Checks (spec linting)

Deterministic analysis of a loaded repo, in the spirit of spec-check. Pure TypeScript in `src/lib/specChecks.ts` (+ co-located Vitest tests), operating on the already-loaded `Repo` object - no new Rust needed.

### Check categories

Each check has a stable id (`SL###`), a severity (`error` / `warning` / `info`), a message, and a location (change slug + tab + heading anchor where possible, so results can deep-link via the existing `scrollTarget` mechanism).

**Structural (errors)**
- `SL001` change folder missing `proposal.md`
- `SL002` change folder missing `tasks.md`
- `SL003` spec delta references a capability that does not exist
- `SL004` malformed EARS/Gherkin block: `WHEN` without `THEN`, `GIVEN` without `THEN`, scenario without an owning requirement
- `SL005` requirement heading with an empty body

**Consistency (warnings)**
- `SL010` near-duplicate requirement text across capabilities
- `SL011` archived change still referenced by an active change
- `SL012` task list does not mention any capability its spec delta touches
- `SL013` tasks all complete but change not archived (and the inverse)

**Language (warnings/info)**
- `SL020` RFC 2119 misuse: lowercase "shall"/"must" in normative position
- `SL021` conflicting modality in one clause (`SHOULD` + `MUST`)
- `SL022` ambiguity flags: "fast", "quickly", "appropriate", "reasonable", "etc.", "as needed" (word list in one exported const, easy to extend)
- `SL023` unbounded quantity: "some", "several", "many" in a normative sentence

### Surfacing

- Per-change: a badge on the change title row (count by max severity), opening a results list; each row deep-links to the offending heading.
- Per-repo: aggregate count in the changes sidebar header.
- A setting to disable checks entirely (`settings.specChecks: boolean`), following the existing `AppSettings` pattern.

Checks are recomputed when a repo (re)loads - same lifecycle as the repo cache, no persistence needed.

### Implementation notes (shipped)

Where the implementation settled relative to the sketch above:

- **Engine + config split.** Detection logic lives in `src/lib/specChecks.ts`; everything user-facing or tunable - ids, severities, titles, message templates, the SL022/SL023 word lists - lives in the `src/lib/specChecksConfig.ts` registry. Changing a severity or message is a one-line config edit. Both modules are pure (no Tauri imports), preserving the CLI extraction path.
- **Surfacing went further than the badge sketch:** an IDE-style right panel (like the comments panel) with findings grouped by change, per-row severity counts in the changes list, severity-colored wavy underlines on the offending text in rendered documents, hover diagnostics on the underlines, and a findings section + stat card on the Overview. Clicking a finding anywhere navigates and blink-highlights the offending text via the existing scrollTarget mechanism (`jumpToFinding`).
- **Scoping decisions:** archived changes are skipped except where the archive state is the point (SL011 reference targets, SL013 inverse), so history doesn't drown the signal. SL003 tolerates deltas that introduce a capability via an ADDED section. Language checks (SL02x) run on spec deltas only, where prose is normative.
- **Findings carry a `snippet`** - the offending line as it renders (markdown syntax stripped) - so the highlight engine can locate it in the DOM.
- `settings.specChecks` defaults to **on**.

## Feature 2: Claims (structured requirements)

### The claim model

```ts
type Modality = "MUST" | "MUST_NOT" | "SHOULD" | "SHOULD_NOT" | "MAY";

interface RequirementClaim {
	/** hash(repoId, capability, requirement heading text) - stable across reorders */
	id: string;
	source: "parsed" | "inferred";
	/** approval invalidates automatically when the requirement text hash changes */
	review: "unreviewed" | "approved" | "stale";
	trigger: string | null;          // WHEN ...
	preconditions: string[];         // IF / AND / GIVEN ...
	outcomes: { modality: Modality; text: string }[];  // THEN ... MUST ...
	invariants: string[];            // "... MUST remain unchanged" outcomes
	gaps: ReadinessGap[];
	requirementText: string;         // original prose, verbatim
	textHash: string;
}
```

### Tier 0 parsing

A small recursive-descent parser over the requirement/scenario blocks the loader already extracts. Grammar is deliberately strict: uppercase keywords (`WHEN` / `WHILE` / `IF` / `GIVEN` / `AND` / `THEN` + RFC 2119 modals), one clause per line or sentence. This reuses the keyword set in `earsKeywords.ts` (currently highlight-only) - extract the list into a shared module.

Requirements that do not parse are not errors. They surface as "unstructured" with the gap list explaining what is missing. The strictness is the point: SpecLens rewards specs written in checkable form.

### Readiness gaps

Computed per claim (parsed or not):

- no trigger identified
- no measurable bound on a quality adverb ("quickly", "efficiently")
- no failure / rejection behaviour specified
- quantifier unclear (one? every? at most one?)
- no statement about what must remain unchanged
- concurrent/repeated-invocation behaviour unspecified (heuristic: trigger present, no `WHILE` clause)

Rendered as the checklist from the review discussion:

```text
Formalization readiness: 4/6
✓ Trigger identified
✓ Required outcome identified
✗ "quickly" has no measurable bound
✗ Failure behaviour unspecified
```

### Tier 1 assist

For unstructured requirements, an "Interpret with AI" action sends the requirement text (plus its capability heading for context) to the local model with a GBNF grammar for the claim schema. The proposal renders in the same claim UI, marked *inferred*, diffable against the prose, with Approve / Discard. No batch mode in v1.

### Approval persistence

Approvals are review state, not content - they live in SpecLens's SQLite (new `claim_reviews` table: claim id, text hash, status, timestamp), following the comments pattern. If the requirement text changes on a later load, the stored hash mismatches and the claim shows `stale`.

Writing claims back into the repo as files (so they version with the spec) is deliberately deferred - it would be SpecLens's first write path into user files and deserves its own decision.

### UI

A "Claims" view per change, sibling to the existing tabs, listing each requirement with its parse result, readiness checklist, and approval state. Per-capability rollup ("7 requirements: 4 parsed, 1 approved, 2 unstructured") on the spec view. Exact layout to be prototyped; not load-bearing for this review.

## Feature 3: Export

"Export claims" produces one JSON file per repo (or per change - open question):

```json
{
	"speclensClaims": 1,
	"repo": "payments-service",
	"generatedFrom": { "signature": "…" },
	"claims": [
		{
			"id": "a41f…",
			"capability": "withdrawals",
			"requirement": "Reject withdrawals exceeding balance",
			"source": "parsed",
			"review": "approved",
			"trigger": "a withdrawal is requested",
			"preconditions": ["withdrawal_amount > account_balance"],
			"outcomes": [{ "modality": "MUST", "text": "the withdrawal is rejected" }],
			"invariants": ["account balance remains unchanged"],
			"gaps": []
		}
	]
}
```

- Schema versioned via the top-level integer; additive changes only within a version.
- Unreviewed and inferred claims are included but carry their status - consumers decide what to trust. Approved claims are the contract.
- v1 export is a save-file dialog from the GUI (plus copy-to-clipboard). This is the thinnest entry into the agent loop: a human exports, an agent reads the file alongside the spec.

### The CLI question (deferred, but named)

The full agent loop (agent asks "which claims am I violating?" in CI) wants a CLI or MCP server, which means extracting the loader + checks + parser out of the app. That is an architecture fork: today the parsing pipeline is TypeScript inside the Tauri frontend. Options when we get there: publish the pure `src/lib` core as an npm package with a thin CLI, or port to a Rust crate shared with `src-tauri`. No decision needed now - but avoid adding Tauri imports to the new `src/lib` modules so the extraction stays possible. (`specChecks.ts`, the claim parser, and the export serializer must stay pure.)

## Phasing

1. **Checks** - lint engine + tests, badge + results list, setting. No LLM, no persistence. Smallest slice, ships alone.
2. **Claims (Tier 0)** - claim model, EARS parser + tests, readiness gaps, Claims view, approval state in SQLite.
3. **Assist + Export (Tier 1)** - "Interpret with AI" via the existing `ai_*` commands with grammar-constrained output, then JSON export.

Each phase is independently useful; stop-anywhere is fine.

## Deferred / out of scope

- **Verification adapters** (generating property tests, SMT queries, temporal models) - company-sized surface; backend-neutrality multiplies the integration cost.
- **Evidence tracking** (specified / implemented / tested / verified per requirement) - the most valuable long-term piece, but it needs stable requirement ids *in the spec files* and a convention for tests to reference them. Ecosystem work; revisit after Claims proves the id scheme.
- **SMT contradiction detection** - keep on the roadmap as "further out". Honest expectation: real specs contain few machine-detectable contradictions; readiness gaps will fire daily, Z3 twice a year.
- **Writing claims into the repo** - see approval persistence above.
- **LLM-suggested ambiguity terms (SL022)** - an opt-in Tier 1 action where the local model reviews requirement prose and proposes *additions to the word list*; the user accepts or discards each, and accepted terms persist as a settings-layer extension of the base list in `specChecksConfig.ts`. The scan itself never calls the model, so checks stay deterministic and reproducible. Belongs with the Phase 3 assist work.
- **Prior art to study before Phase 2 design hardens:** NASA FRET (EARS-like requirements compiled to temporal logic with human-reviewable semantics), classic requirements-traceability matrices.

## Open questions for review

1. Claims view placement: a new tab per change vs. a panel on the spec view vs. both?
2. Export granularity: per repo, per change, or selectable?
3. ~~Should `SL0xx` check ids be user-visible (greppable, suppressible later) or internal?~~ **Answered in v1: user-visible** - shown in the panel rows, hover diagnostics, and Overview list.
4. ~~Ambiguity word list (`SL022`): hardcode v1, or make it a setting from day one?~~ **Answered in v1: hardcoded** exported const in `specChecksConfig.ts`; a user-editable settings layer is deferred (see the LLM-suggested-terms item).
5. Is `claim_reviews` in app SQLite acceptable for now, knowing reviews don't travel with the repo?
