/**
 * Deterministic spec linting ("Checks", docs/design/checks-and-claims.md
 * feature 1). Pure module - no Tauri imports (the design doc requires the
 * lint engine to stay extractable into a CLI later).
 *
 * Scope decisions for v1:
 * - Checks run over the changes of a loaded repo. Archived changes are
 *   historical records, so they are skipped except where the check is about
 *   the archive state itself (SL011 reference targets, SL013 inverse).
 * - Language checks (SL02x) run on spec deltas only, where prose is
 *   normative; proposals and tasks are free-form.
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
	/** Owning change key: "archive/" prefix + slug for archived changes. */
	changeKey: string;
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

const MODALS = ["MUST", "SHALL", "SHOULD", "MAY"] as const;
const MODAL_REGEX = new RegExp(`\\b(${MODALS.join("|")})\\b`, "g");
const HAS_MODAL = new RegExp(`\\b(${MODALS.join("|")})\\b`);

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
 * MarkdownView documentId a finding renders under: `<slug>/<tab>` normally,
 * `<slug>/<tab>/<file>` when the tab resolves to multiple files. Null when
 * the finding has no tab (change-level findings like SL001).
 */
export function findingDocumentId(
	change: Change,
	result: SpecCheckResult,
): string | null {
	if (!result.tab) return null;
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
		const change = repo.changes.find(
			(c) => changeKeyOf(c) === result.changeKey,
		);
		if (!change || findingDocumentId(change, result) !== documentId) continue;
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

export function runSpecChecks(repo: Repo): SpecCheckResult[] {
	const results: SpecCheckResult[] = [];
	const active = repo.changes.filter((c) => !c.archived);
	const archived = repo.changes.filter((c) => c.archived);
	const repoCapabilities = new Set(repo.repoSpecs.map((s) => s.capability));

	// Requirement headings across all active deltas, for SL010.
	const requirementIndex = new Map<
		string,
		{
			capability: string;
			changeKey: string;
			heading: string;
			ref: SpecDocRef;
		}[]
	>();

	for (const change of active) {
		const key = changeKeyOf(change);
		const push = (
			id: CheckId,
			variant: string,
			params: Record<string, string> = {},
			loc?: Partial<
				Pick<SpecCheckResult, "tab" | "file" | "heading" | "snippet">
			>,
		) => {
			results.push({
				id,
				severity: CHECKS[id].severity,
				message: formatCheckMessage(id, variant, params),
				changeKey: key,
				tab: loc?.tab ?? null,
				file: loc?.file ?? null,
				heading: loc?.heading ?? null,
				snippet: loc?.snippet ?? null,
			});
		};

		// SL001 / SL002 - required documents.
		if (change.proposal === null) {
			push("SL001", "default");
		}
		if (change.tasks === null) {
			push("SL002", "default");
		}

		const specRefs = specDocRefs(change);

		for (const ref of specRefs) {
			const loc = { tab: ref.tab, file: ref.file };

			// SL003 - delta for a capability that neither exists nor is added.
			if (
				!repoCapabilities.has(ref.capability) &&
				!ADDED_SECTION.test(ref.content)
			) {
				push("SL003", "default", { capability: ref.capability }, loc);
			}

			// SL004 / SL005 - heading-block structure.
			const blocks = scanHeadingBlocks(ref.content);
			for (const block of blocks) {
				const blockLoc = { ...loc, heading: block.text };
				if (SCENARIO_HEADING.test(block.text)) {
					const params = { scenario: block.text };
					if (!block.owningRequirement) {
						push("SL004", "orphanScenario", params, blockLoc);
					}
					const body = block.body.join("\n");
					const hasWhen = /\bWHEN\b/.test(body);
					const hasGiven = /\bGIVEN\b/.test(body);
					const hasThen = /\bTHEN\b/.test(body);
					if (hasWhen && !hasThen) {
						push("SL004", "whenWithoutThen", params, blockLoc);
					}
					if (hasGiven && !hasThen) {
						push("SL004", "givenWithoutThen", params, blockLoc);
					}
				}
				if (REQUIREMENT_HEADING.test(block.text)) {
					const followedByContent =
						block.body.length > 0 ||
						blocks.some((b) => b.owningRequirement === block.text);
					if (!followedByContent) {
						push("SL005", "default", { requirement: block.text }, blockLoc);
					}
					// Collect for SL010.
					const normalized = normalizeRequirementText(block.text);
					if (normalized) {
						const entries = requirementIndex.get(normalized) ?? [];
						entries.push({
							capability: ref.capability,
							changeKey: key,
							heading: block.text,
							ref,
						});
						requirementIndex.set(normalized, entries);
					}
				}
			}

			// SL020-SL023 - language checks on normative spec prose.
			for (const line of scanLines(ref.content)) {
				const lineLoc = {
					...loc,
					heading: line.heading,
					snippet: toSnippet(line.raw),
				};

				// Case-sensitive on purpose: only fully lowercase forms are misuse.
				const misuse = line.text.match(/\b(shall|must)\b/g);
				if (misuse) {
					push("SL020", "default", { word: misuse[0] }, lineLoc);
				}

				const modals = new Set(line.text.match(MODAL_REGEX) ?? []);
				if (modals.size >= 2) {
					push(
						"SL021",
						"default",
						{ modals: [...modals].join(" + ") },
						lineLoc,
					);
				}

				for (const term of AMBIGUITY_TERMS) {
					const re = new RegExp(`\\b${escapeRegex(term)}(?!\\w)`, "i");
					if (re.test(line.text)) {
						push("SL022", "default", { term }, lineLoc);
					}
				}

				if (HAS_MODAL.test(line.text)) {
					for (const q of UNBOUNDED_QUANTIFIERS) {
						const re = new RegExp(`\\b${q}\\b`, "i");
						if (re.test(line.text)) {
							push("SL023", "default", { term: q }, lineLoc);
						}
					}
				}
			}
		}

		// SL011 - references to archived changes.
		for (const other of archived) {
			const re = new RegExp(`(^|[^\\w-])${escapeRegex(other.slug)}([^\\w-]|$)`);
			const docs: [string, string | null][] = [
				["proposal.md", change.proposal],
				["tasks.md", change.tasks],
			];
			for (const [relPath, content] of docs) {
				if (content && re.test(content)) {
					push(
						"SL011",
						"default",
						{ slug: other.slug },
						{ tab: tabForPath(change, relPath), snippet: other.slug },
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
				push(
					"SL012",
					"default",
					{ capabilities: capabilities.join(", ") },
					{ tab: tabForPath(change, "tasks.md") },
				);
			}
		}
	}

	// SL013 - task completion vs archive state (runs on all changes).
	for (const change of repo.changes) {
		if (!change.tasks) continue;
		const { total, done } = countTaskCompletion(change.tasks);
		if (total === 0) continue;
		const pushTaskState = (variant: string, params: Record<string, string>) => {
			results.push({
				id: "SL013",
				severity: CHECKS.SL013.severity,
				message: formatCheckMessage("SL013", variant, params),
				changeKey: changeKeyOf(change),
				tab: tabForPath(change, "tasks.md"),
				file: null,
				heading: null,
				snippet: null,
			});
		};
		if (!change.archived && done === total) {
			pushTaskState("readyToArchive", {});
		}
		if (change.archived && done < total) {
			pushTaskState("archivedIncomplete", {
				done: String(done),
				total: String(total),
			});
		}
	}

	// SL010 - near-duplicate requirement text across capabilities.
	for (const entries of requirementIndex.values()) {
		const capabilities = new Set(entries.map((e) => e.capability));
		if (capabilities.size < 2) continue;
		for (const entry of entries) {
			const others = [...capabilities].filter((c) => c !== entry.capability);
			results.push({
				id: "SL010",
				severity: CHECKS.SL010.severity,
				message: formatCheckMessage("SL010", "default", {
					requirement: entry.heading,
					others: others.join(", "),
				}),
				changeKey: entry.changeKey,
				tab: entry.ref.tab,
				file: entry.ref.file,
				heading: entry.heading,
				snippet: null,
			});
		}
	}

	return results.sort(
		(a, b) =>
			SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
			a.id.localeCompare(b.id) ||
			a.changeKey.localeCompare(b.changeKey),
	);
}
