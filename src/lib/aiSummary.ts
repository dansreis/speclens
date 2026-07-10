/**
 * Pure helpers for the AI overview summary: prompt construction, the
 * in-app spec link scheme, and byte formatting. No Tauri imports so the
 * whole file is unit-testable in node.
 */

export const SPEC_LINK_SCHEME = "speclens-spec://";

/** Per-capability spec budget before global capping kicks in. */
export const SPEC_CHAR_LIMIT = 1500;
/** Rough total prompt budget (chars, not tokens). */
export const PROMPT_CHAR_LIMIT = 16_000;

export interface CapabilityDoc {
	name: string;
	content: string;
}

/**
 * The full capability universe for a repo, matching what the Specs view
 * shows: every capability with a materialized `openspec/specs/` file plus
 * every capability referenced only by change spec-deltas. Many repos keep
 * few (or no) top-level spec files, so building the summary from repoSpecs
 * alone drops most capabilities. Content priority: the real spec file if it
 * exists, otherwise the newest change's delta for that capability.
 */
export function collectCapabilities(
	repoSpecs: { capability: string; content: string }[],
	changes: { createdAt: Date | null; specs: Record<string, string> }[],
): CapabilityDoc[] {
	const map = new Map<string, string>();
	for (const s of repoSpecs) map.set(s.capability, s.content);
	const newestFirst = [...changes].sort(
		(a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
	);
	for (const c of newestFirst) {
		for (const [capability, body] of Object.entries(c.specs)) {
			if (!map.has(capability)) map.set(capability, body);
		}
	}
	return [...map.entries()]
		.map(([name, content]) => ({ name, content }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export interface SummaryPromptInput {
	repoName: string;
	/** Capability name + full spec.md content. */
	capabilities: { name: string; content: string }[];
	/** Names of active (non-archived) changes. */
	activeChangeTitles: string[];
}

/** Truncated output never exceeds `max` chars, ellipsis included. */
function truncate(text: string, max: number): string {
	const trimmed = text.trim();
	if (trimmed.length <= max) return trimmed;
	if (max <= 1) return max === 1 ? "…" : "";
	return `${trimmed.slice(0, max - 1)}…`;
}

function assemble(input: SummaryPromptInput, perSpecChars: number): string {
	const specSections = input.capabilities
		.map((c) => `### ${c.name}\n${truncate(c.content, perSpecChars)}`)
		.join("\n\n");
	const changeLines =
		input.activeChangeTitles.length > 0
			? input.activeChangeTitles.map((t) => `- ${t}`).join("\n")
			: "(none)";
	const capabilityNames = input.capabilities.map((c) => `- ${c.name}`);
	const count = input.capabilities.length;
	return [
		"You are generating a project overview for an OpenSpec repository.",
		"",
		`Project: ${input.repoName}`,
		"",
		`The project has exactly ${count} capabilities (use these exact names):`,
		...capabilityNames,
		"",
		"Their current specs:",
		"",
		specSections,
		"",
		"Active changes in flight:",
		changeLines,
		"",
		"Write markdown and nothing else - no preamble, no headings, no code fences, no closing remarks:",
		"1. Start with one overview paragraph (3-5 sentences) describing what this project is, what domain it covers, and how its capabilities fit together.",
		`2. Then write exactly one bullet per capability - all ${count} of them, in the order listed - in this form:`,
		"- <capability-name>: two or three sentences describing what it governs and why it matters.",
		"Each bullet must start with the capability's exact name. Do not invent capabilities, do not skip any, and do not use link or URL syntax anywhere.",
	].join("\n");
}

/**
 * Builds the summary prompt. Each spec is truncated to SPEC_CHAR_LIMIT; if
 * the total still exceeds PROMPT_CHAR_LIMIT the per-spec budget is reduced
 * evenly across all capabilities (none are dropped).
 */
export function buildSummaryPrompt(input: SummaryPromptInput): string {
	const prompt = assemble(input, SPEC_CHAR_LIMIT);
	if (prompt.length <= PROMPT_CHAR_LIMIT || input.capabilities.length === 0) {
		return prompt;
	}
	// Fixed overhead = the prompt with every spec body emptied. Whatever
	// budget remains is split evenly across capabilities.
	const overhead = assemble(input, 0).length;
	const perSpec = Math.max(
		0,
		Math.floor((PROMPT_CHAR_LIMIT - overhead) / input.capabilities.length),
	);
	return assemble(input, perSpec);
}

/**
 * Rewrites capability bullets into canonical linked form:
 * `- **[<name>](speclens-spec://<name>)** - description`.
 *
 * The model is told to emit plain `- <name>: description` bullets (small
 * models reliably fumble link syntax), and linking happens here instead.
 * Also repairs summaries from the earlier prompt where the model attempted
 * the link syntax and mangled it (`name](scheme://name)`, `name(scheme://name)`),
 * and is idempotent on already-canonical bullets - so cached summaries render
 * correctly without regeneration.
 */
export function linkifyCapabilities(
	markdown: string,
	capabilities: string[],
): string {
	if (capabilities.length === 0) return markdown;
	// Longest first so "billing-and-claims" wins over a hypothetical "billing".
	const sorted = [...capabilities].sort((a, b) => b.length - a.length);
	return markdown
		.split("\n")
		.map((line) => {
			const bullet = /^(\s*[-*]\s+)(.*)$/.exec(line);
			if (!bullet) return line;
			const [, marker, rest] = bullet;
			for (const cap of sorted) {
				const idx = rest.toLowerCase().indexOf(cap.toLowerCase());
				// The name must sit at the bullet head, allowing only emphasis /
				// bracket punctuation before it (e.g. "**[").
				if (idx === -1 || idx > 8 || /[^*_`[\]()]/.test(rest.slice(0, idx))) {
					continue;
				}
				let tail = rest.slice(idx + cap.length);
				// Swallow any (possibly mangled) attempt at our link syntax plus
				// trailing emphasis/bracket junk, then the separator.
				tail = tail
					.replace(/^(\]?\(?speclens-spec:\/\/[^)\s]*\)?)?[*_`\]).]*/, "")
					.replace(/^\s*[-–:]+\s*/, "")
					.trim();
				return `${marker}**[${cap}](${SPEC_LINK_SCHEME}${cap})**${tail ? ` - ${tail}` : ""}`;
			}
			return line;
		})
		.join("\n");
}

/**
 * Extracts the capability name from a `speclens-spec://<capability>` href.
 * Returns null for any other URL.
 */
export function parseSpecLink(href: string | undefined): string | null {
	if (!href?.startsWith(SPEC_LINK_SCHEME)) return null;
	const capability = href.slice(SPEC_LINK_SCHEME.length).replace(/\/+$/, "");
	if (!capability) return null;
	try {
		return decodeURIComponent(capability);
	} catch {
		return capability;
	}
}

/** Human-readable decimal size: "3.11 GB", "512 MB", "12 kB". */
export function formatBytes(bytes: number): string {
	if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
	if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
	if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} kB`;
	return `${bytes} B`;
}
