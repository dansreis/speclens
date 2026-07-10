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
	return [
		"You are generating a project overview for an OpenSpec repository.",
		"",
		`Project: ${input.repoName}`,
		"",
		"Capabilities and their current specs:",
		"",
		specSections,
		"",
		"Active changes in flight:",
		changeLines,
		"",
		"Write concise markdown and nothing else - no preamble, no code fences, no closing remarks:",
		"1. One short overview paragraph describing what this project covers.",
		"2. Then exactly one bullet per capability listed above, in this exact form:",
		`- **[<capability>](${SPEC_LINK_SCHEME}<capability>)** - one-sentence description`,
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
