/**
 * Pure helpers for the per-document AI summary ("help reviewers"): prompt
 * construction and the session cache key. No Tauri imports so the whole file
 * is unit-testable in node. Shares the char-budget approach (and total
 * PROMPT_CHAR_LIMIT) with the project-overview prompt in aiSummary.ts.
 */

import { PROMPT_CHAR_LIMIT, truncate } from "./aiSummary";

export interface DocSummaryPromptInput {
	/** Human document title, e.g. the change or capability name. */
	title: string;
	/** What kind of document this is: "proposal", "tasks", "spec delta", ... */
	kind: string;
	/** Full markdown source of the document being read. */
	source: string;
}

function assemble(input: DocSummaryPromptInput, sourceChars: number): string {
	return [
		"You are helping a reviewer quickly get oriented in a document from an OpenSpec project.",
		"",
		`Document: ${input.title}`,
		`Kind: ${input.kind}`,
		"",
		"Document content:",
		"",
		truncate(input.source, sourceChars),
		"",
		"Write markdown and nothing else - no preamble, no headings, no code fences, no link or URL syntax, no closing remarks:",
		"1. Start with one paragraph (3-5 sentences) explaining what this document is, what it covers, and why it exists - grounded in what the document actually says.",
		'2. Then the bold lead-in "**Key points**" on its own line, followed by one bullet per major section, requirement, or decision in the document. Be specific and concrete: use the document\'s own names, terms, thresholds, and behaviors (one or two sentences each). Do not write generic statements that could apply to any document, and do not add anything the document does not say.',
		'3. Then the bold lead-in "**Worth a reviewer\'s attention**" on its own line, followed by a bullet list of risks, ambiguities, contradictions, or open questions grounded in specific passages. If nothing stands out, write the single bullet "- (nothing stood out)".',
	].join("\n");
}

/**
 * Builds the reviewer-oriented document summary prompt. If the full source
 * pushes the prompt past PROMPT_CHAR_LIMIT, the source alone is truncated to
 * whatever budget remains after the fixed instruction overhead.
 */
export function buildDocSummaryPrompt(input: DocSummaryPromptInput): string {
	const prompt = assemble(input, Number.MAX_SAFE_INTEGER);
	if (prompt.length <= PROMPT_CHAR_LIMIT) return prompt;
	// Fixed overhead = the prompt with the source emptied; the source gets
	// whatever budget is left.
	const overhead = assemble({ ...input, source: "" }, 0).length;
	return assemble(input, Math.max(0, PROMPT_CHAR_LIMIT - overhead));
}

/** Cheap FNV-1a 32-bit hash, rendered base36. Not cryptographic. */
function fnv1a(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}

/**
 * Session-cache key for a generated document summary. Keyed by model and
 * source content (length + hash) so an unchanged document reuses its summary
 * while any edit - or a model switch - regenerates.
 */
export function docSummaryCacheKey(modelId: string, source: string): string {
	return `${modelId}:${source.length.toString(36)}:${fnv1a(source)}`;
}
