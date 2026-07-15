/**
 * Deterministic spec linting ("Checks", docs/design/checks-and-claims.md
 * feature 1). Pure module - no Tauri imports (the design doc requires the
 * lint engine to stay extractable into a CLI later).
 *
 * Scope decisions for v1:
 * - Change-level checks run over the changes of a loaded repo. Archived
 *   changes are historical records, so by default they are skipped except
 *   where the check is about the archive state itself (SL011 reference
 *   targets, SL013 inverse). `options.includeArchived` opts archived
 *   changes into the full set (settings.specChecksIncludeArchived).
 * - Spec-content checks (SL004/SL005 structure, SL02x language, SL010
 *   duplicates) run on active change deltas AND the canonical
 *   `openspec/specs/<cap>/spec.md` files. Canonical-spec findings have no
 *   owning change: `changeKey` is null and `capability` locates them.
 * - Language checks are limited to spec documents, where prose is normative;
 *   proposals and tasks are free-form.
 * - SL003 tolerates deltas that introduce a capability (an ADDED section):
 *   a delta for a brand-new capability is the normal way capabilities are
 *   born, not an error.
 */

import type { HighlightTarget } from "./highlight";
import type { Change, Repo } from "./repoLoader";
import {
	AMBIGUITY_TERMS,
	CHECKS,
	type CheckId,
	type CheckSeverity,
	formatCheckMessage,
	UNBOUNDED_QUANTIFIERS,
} from "./specChecksConfig";
import { countTaskCompletion } from "./tasksCompletion";

export type { CheckId, CheckSeverity } from "./specChecksConfig";

export interface SpecCheckResult {
	/** Stable check id, e.g. "SL004". User-visible and greppable. */
	id: CheckId;
	severity: CheckSeverity;
	message: string;
	/**
	 * Owning change key ("archive/" prefix + slug), or null for findings in
	 * canonical repo specs, which have no owning change.
	 */
	changeKey: string | null;
	/** Capability the finding belongs to, when it lives in a spec document. */
	capability: string | null;
	/** Artifact/tab id to open when deep-linking, when known. */
	tab: string | null;
	/** File name within a multi-file tab (e.g. a spec delta), when known. */
	file: string | null;
	/** Nearest heading text above the finding, for scroll deep-linking. */
	heading: string | null;
	/**
	 * Offending text as it renders in the document (markdown syntax stripped),
	 * for highlight deep-linking. Falls back to `heading` when null.
	 */
	snippet: string | null;
}

export interface CheckCounts {
	errors: number;
	warnings: number;
	infos: number;
	total: number;
}

export function changeKeyOf(change: Change): string {
	return `${change.archived ? "archive/" : ""}${change.slug}`;
}

export function countBySeverity(results: SpecCheckResult[]): CheckCounts {
	const counts = { errors: 0, warnings: 0, infos: 0, total: results.length };
	for (const r of results) {
		if (r.severity === "error") counts.errors++;
		else if (r.severity === "warning") counts.warnings++;
		else counts.infos++;
	}
	return counts;
}

export function maxSeverity(counts: CheckCounts): CheckSeverity | null {
	if (counts.errors > 0) return "error";
	if (counts.warnings > 0) return "warning";
	if (counts.infos > 0) return "info";
	return null;
}

/** Results belonging to one change, errors first, stable id order within. */
export function checksForChange(
	results: SpecCheckResult[],
	changeKey: string,
): SpecCheckResult[] {
	return results.filter((r) => r.changeKey === changeKey);
}

/**
 * MarkdownView documentId a finding renders under: `spec:<capability>` for
 * canonical-spec findings, `<slug>/<tab>` for change docs (or
 * `<slug>/<tab>/<file>` when the tab resolves to multiple files). Null when
 * the finding has no anchored document (change-level findings like SL001).
 */
export function findingDocumentId(
	change: Change | null,
	result: SpecCheckResult,
): string | null {
	if (result.changeKey === null) {
		return result.capability ? `spec:${result.capability}` : null;
	}
	if (!change || !result.tab) return null;
	const tabFiles = change.documentFiles[result.tab] ?? [];
	return tabFiles.length > 1 && result.file
		? `${change.slug}/${result.tab}/${result.file}`
		: `${change.slug}/${result.tab}`;
}

/**
 * Findings anchored in one rendered document, grouped by the text they
 * anchor to. Results arrive sorted errors-first, so each group's first entry
 * carries the highest severity. Used for the wavy underlines and their hover
 * diagnostics.
 */
export function checksByAnchorText(
	repo: Repo,
	results: SpecCheckResult[],
	documentId: string,
): Map<string, SpecCheckResult[]> {
	const byText = new Map<string, SpecCheckResult[]>();
	for (const result of results) {
		const change = result.changeKey
			? (repo.changes.find((c) => changeKeyOf(c) === result.changeKey) ?? null)
			: null;
		if (findingDocumentId(change, result) !== documentId) continue;
		const text = result.snippet ?? result.heading;
		if (!text) continue;
		const group = byText.get(text);
		if (group) group.push(result);
		else byText.set(text, [result]);
	}
	return byText;
}

/**
 * Highlight targets for the findings anchored in one rendered document, for
 * the IDE-style wavy underlines. One per anchor text, classed by the highest
 * severity among the findings sharing it.
 */
export function checkHighlightTargets(
	repo: Repo,
	results: SpecCheckResult[],
	documentId: string,
): HighlightTarget[] {
	return [...checksByAnchorText(repo, results, documentId).entries()].map(
		([text, findings]) => ({
			text,
			occurrence: 1,
			className: `spec-check spec-check-${findings[0].severity}`,
		}),
	);
}

const SEVERITY_ORDER: Record<CheckSeverity, number> = {
	error: 0,
	warning: 1,
	info: 2,
};

interface ScannedLine {
	text: string;
	/** Original markdown line, for snippet extraction. */
	raw: string;
	/** Nearest heading text above this line (null before the first heading). */
	heading: string | null;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/**
 * Splits markdown into scannable lines: fenced code blocks are dropped,
 * inline code spans are blanked (so `must` in code never triggers language
 * checks), and each line carries the nearest heading above it.
 */
function scanLines(markdown: string): ScannedLine[] {
	const out: ScannedLine[] = [];
	let inFence = false;
	let heading: string | null = null;
	for (const line of markdown.split("\n")) {
		if (FENCE.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const h = HEADING.exec(line);
		if (h) {
			heading = h[2].replace(/`/g, "").trim();
			continue;
		}
		out.push({ text: line.replace(/`[^`]*`/g, " "), raw: line, heading });
	}
	return out;
}

/**
 * Reduces a markdown source line to the text the reader sees, so the
 * highlight mechanism (which matches rendered text) can locate it. List
 * markers, checkboxes, strong-emphasis markers, and backticks render as
 * nothing; single *emphasis* is left alone (stripping it would corrupt
 * legitimate asterisks more often than it would help).
 */
function toSnippet(raw: string): string | null {
	const cleaned = raw
		.replace(/^\s*(?:[-*+]\s+)?(?:\[[xX ]\]\s+)?/, "")
		.replace(/^\s*\d+\.\s+/, "")
		.replace(/\*\*|__/g, "")
		.replace(/`/g, "")
		.trim();
	return cleaned || null;
}

interface HeadingBlock {
	/** Heading text without the leading #s. */
	text: string;
	depth: number;
	/** Non-blank body lines before the next heading of any depth. */
	body: string[];
	/** Nearest requirement heading above (for scenario ownership). */
	owningRequirement: string | null;
}

const REQUIREMENT_HEADING = /^requirement\b/i;
const SCENARIO_HEADING = /^scenario\b/i;

/** Extracts heading blocks with fence awareness. */
function scanHeadingBlocks(markdown: string): HeadingBlock[] {
	const blocks: HeadingBlock[] = [];
	let inFence = false;
	let current: HeadingBlock | null = null;
	let lastRequirement: { text: string; depth: number } | null = null;
	for (const line of markdown.split("\n")) {
		if (FENCE.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const h = HEADING.exec(line);
		if (h) {
			const depth = h[1].length;
			const text = h[2].replace(/`/g, "").trim();
			if (REQUIREMENT_HEADING.test(text)) {
				lastRequirement = { text, depth };
			} else if (lastRequirement && depth <= lastRequirement.depth) {
				// A sibling or shallower non-requirement heading closes the
				// requirement's scope - scenarios after it are orphaned.
				lastRequirement = null;
			}
			current = {
				text,
				depth,
				body: [],
				owningRequirement:
					REQUIREMENT_HEADING.test(text) || !lastRequirement
						? null
						: lastRequirement.text,
			};
			blocks.push(current);
			continue;
		}
		if (current && line.trim() !== "") current.body.push(line);
	}
	return blocks;
}

const MODALS = ["MUST", "SHALL", "SHOULD", "MAY"] as const;
const MODAL_REGEX = new RegExp(`\\b(${MODALS.join("|")})\\b`, "g");
const HAS_MODAL = new RegExp(`\\b(${MODALS.join("|")})\\b`);

/** Location of one spec-delta document inside a change's tab structure. */
interface SpecDocRef {
	capability: string;
	content: string;
	tab: string | null;
	file: string | null;
}

/**
 * Resolves each spec delta of a change to the artifact tab + file name the
 * viewer would open it under, by matching `specs/<cap>/spec.md` paths against
 * the change's resolved documentFiles.
 */
function specDocRefs(change: Change): SpecDocRef[] {
	const refs: SpecDocRef[] = [];
	for (const [capability, content] of Object.entries(change.specs)) {
		const relPath = `specs/${capability}/spec.md`;
		let tab: string | null = null;
		let file: string | null = null;
		for (const [artifactId, files] of Object.entries(change.documentFiles)) {
			const match = files.find(
				(f) => f.path.toLowerCase() === relPath.toLowerCase(),
			);
			if (match) {
				tab = artifactId;
				file = match.name;
				break;
			}
		}
		refs.push({ capability, content, tab, file });
	}
	return refs;
}

/** Tab id whose resolved files include the given change-relative path. */
function tabForPath(change: Change, relPath: string): string | null {
	for (const [artifactId, files] of Object.entries(change.documentFiles)) {
		if (files.some((f) => f.path.toLowerCase() === relPath.toLowerCase())) {
			return artifactId;
		}
	}
	return null;
}

/** Requirement text normalization for SL010 near-duplicate comparison. */
function normalizeRequirementText(text: string): string {
	return text
		.toLowerCase()
		.replace(/^requirement[:\s]*/, "")
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ADDED_SECTION = /^#{1,6}\s+ADDED\b/im;

/** Where a spec document lives, threaded through every finding it produces. */
interface SpecDocLoc {
	changeKey: string | null;
	capability: string;
	tab: string | null;
	file: string | null;
}

interface RequirementEntry extends SpecDocLoc {
	heading: string;
}

export interface SpecCheckOptions {
	/** Also lint archived changes' documents and deltas. Default false. */
	includeArchived?: boolean;
}

export function runSpecChecks(
	repo: Repo,
	options: SpecCheckOptions = {},
): SpecCheckResult[] {
	const results: SpecCheckResult[] = [];
	const included = options.includeArchived
		? repo.changes
		: repo.changes.filter((c) => !c.archived);
	const archived = repo.changes.filter((c) => c.archived);
	const repoCapabilities = new Set(repo.repoSpecs.map((s) => s.capability));

	const emit = (
		id: CheckId,
		variant: string,
		params: Record<string, string>,
		loc: Partial<
			Pick<
				SpecCheckResult,
				"changeKey" | "capability" | "tab" | "file" | "heading" | "snippet"
			>
		>,
	) => {
		results.push({
			id,
			severity: CHECKS[id].severity,
			message: formatCheckMessage(id, variant, params),
			changeKey: loc.changeKey ?? null,
			capability: loc.capability ?? null,
			tab: loc.tab ?? null,
			file: loc.file ?? null,
			heading: loc.heading ?? null,
			snippet: loc.snippet ?? null,
		});
	};

	// Requirement headings across all spec docs (deltas + canonical), for SL010.
	const requirementIndex = new Map<string, RequirementEntry[]>();

	// SL004 / SL005 structure + SL02x language + SL010 collection, shared by
	// change deltas and canonical repo specs.
	const checkSpecDoc = (content: string, loc: SpecDocLoc) => {
		const blocks = scanHeadingBlocks(content);
		for (const block of blocks) {
			const blockLoc = { ...loc, heading: block.text };
			if (SCENARIO_HEADING.test(block.text)) {
				const params = { scenario: block.text };
				if (!block.owningRequirement) {
					emit("SL004", "orphanScenario", params, blockLoc);
				}
				const body = block.body.join("\n");
				const hasWhen = /\bWHEN\b/.test(body);
				const hasGiven = /\bGIVEN\b/.test(body);
				const hasThen = /\bTHEN\b/.test(body);
				if (hasWhen && !hasThen) {
					emit("SL004", "whenWithoutThen", params, blockLoc);
				}
				if (hasGiven && !hasThen) {
					emit("SL004", "givenWithoutThen", params, blockLoc);
				}
			}
			if (REQUIREMENT_HEADING.test(block.text)) {
				const followedByContent =
					block.body.length > 0 ||
					blocks.some((b) => b.owningRequirement === block.text);
				if (!followedByContent) {
					emit("SL005", "default", { requirement: block.text }, blockLoc);
				}
				const normalized = normalizeRequirementText(block.text);
				if (normalized) {
					const entries = requirementIndex.get(normalized) ?? [];
					entries.push({ ...loc, heading: block.text });
					requirementIndex.set(normalized, entries);
				}
			}
		}

		for (const line of scanLines(content)) {
			const lineLoc = {
				...loc,
				heading: line.heading,
				snippet: toSnippet(line.raw),
			};

			// Case-sensitive on purpose: only fully lowercase forms are misuse.
			const misuse = line.text.match(/\b(shall|must)\b/g);
			if (misuse) {
				emit("SL020", "default", { word: misuse[0] }, lineLoc);
			}

			const modals = new Set(line.text.match(MODAL_REGEX) ?? []);
			if (modals.size >= 2) {
				emit("SL021", "default", { modals: [...modals].join(" + ") }, lineLoc);
			}

			for (const term of AMBIGUITY_TERMS) {
				const re = new RegExp(`\\b${escapeRegex(term)}(?!\\w)`, "i");
				if (re.test(line.text)) {
					emit("SL022", "default", { term }, lineLoc);
				}
			}

			if (HAS_MODAL.test(line.text)) {
				for (const q of UNBOUNDED_QUANTIFIERS) {
					const re = new RegExp(`\\b${q}\\b`, "i");
					if (re.test(line.text)) {
						emit("SL023", "default", { term: q }, lineLoc);
					}
				}
			}
		}
	};

	for (const change of included) {
		const key = changeKeyOf(change);
		const changeLoc = { changeKey: key };

		// SL001 / SL002 - required documents.
		if (change.proposal === null) {
			emit("SL001", "default", {}, changeLoc);
		}
		if (change.tasks === null) {
			emit("SL002", "default", {}, changeLoc);
		}

		for (const ref of specDocRefs(change)) {
			const loc: SpecDocLoc = {
				changeKey: key,
				capability: ref.capability,
				tab: ref.tab,
				file: ref.file,
			};

			// SL003 - delta for a capability that neither exists nor is added.
			if (
				!repoCapabilities.has(ref.capability) &&
				!ADDED_SECTION.test(ref.content)
			) {
				emit("SL003", "default", { capability: ref.capability }, loc);
			}

			checkSpecDoc(ref.content, loc);
		}

		// SL011 - references to archived changes. Self-references are skipped:
		// with includeArchived on, an archived change naming its own slug in
		// its proposal is not a stale reference.
		for (const other of archived) {
			if (changeKeyOf(other) === key) continue;
			const re = new RegExp(`(^|[^\\w-])${escapeRegex(other.slug)}([^\\w-]|$)`);
			const docs: [string, string | null][] = [
				["proposal.md", change.proposal],
				["tasks.md", change.tasks],
			];
			for (const [relPath, content] of docs) {
				if (content && re.test(content)) {
					emit(
						"SL011",
						"default",
						{ slug: other.slug },
						{
							...changeLoc,
							tab: tabForPath(change, relPath),
							snippet: other.slug,
						},
					);
					break;
				}
			}
		}

		// SL012 - tasks never mention any touched capability.
		const capabilities = Object.keys(change.specs);
		if (change.tasks && capabilities.length > 0) {
			const tasksLower = change.tasks.toLowerCase();
			const mentioned = capabilities.some((cap) =>
				tasksLower.includes(cap.toLowerCase()),
			);
			if (!mentioned) {
				emit(
					"SL012",
					"default",
					{ capabilities: capabilities.join(", ") },
					{ ...changeLoc, tab: tabForPath(change, "tasks.md") },
				);
			}
		}
	}

	// Canonical repo specs: same structure/language/duplicate checks, no
	// owning change.
	for (const spec of repo.repoSpecs) {
		checkSpecDoc(spec.content, {
			changeKey: null,
			capability: spec.capability,
			tab: null,
			file: null,
		});
	}

	// SL013 - task completion vs archive state (runs on all changes).
	for (const change of repo.changes) {
		if (!change.tasks) continue;
		const { total, done } = countTaskCompletion(change.tasks);
		if (total === 0) continue;
		const loc = {
			changeKey: changeKeyOf(change),
			tab: tabForPath(change, "tasks.md"),
		};
		if (!change.archived && done === total) {
			emit("SL013", "readyToArchive", {}, loc);
		}
		if (change.archived && done < total) {
			emit(
				"SL013",
				"archivedIncomplete",
				{ done: String(done), total: String(total) },
				loc,
			);
		}
	}

	// SL010 - near-duplicate requirement text across capabilities.
	for (const entries of requirementIndex.values()) {
		const capabilities = new Set(entries.map((e) => e.capability));
		if (capabilities.size < 2) continue;
		for (const entry of entries) {
			const others = [...capabilities].filter((c) => c !== entry.capability);
			emit(
				"SL010",
				"default",
				{ requirement: entry.heading, others: others.join(", ") },
				{ ...entry, snippet: null },
			);
		}
	}

	return results.sort(
		(a, b) =>
			SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
			a.id.localeCompare(b.id) ||
			(a.changeKey ?? "").localeCompare(b.changeKey ?? ""),
	);
}
