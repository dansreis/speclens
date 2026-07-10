import { describe, expect, it } from "vitest";
import { buildDocSummaryPrompt, docSummaryCacheKey } from "./aiDocSummary";
import { PROMPT_CHAR_LIMIT } from "./aiSummary";

describe("buildDocSummaryPrompt", () => {
	it("includes title, kind, and the full source when it fits", () => {
		const prompt = buildDocSummaryPrompt({
			title: "add-search-bar",
			kind: "proposal",
			source: "## Why\nUsers cannot find changes quickly.",
		});
		expect(prompt).toContain("Document: add-search-bar");
		expect(prompt).toContain("Kind: proposal");
		expect(prompt).toContain("## Why\nUsers cannot find changes quickly.");
	});

	it("asks for the reviewer-oriented structure with bold lead-ins only", () => {
		const prompt = buildDocSummaryPrompt({
			title: "t",
			kind: "spec",
			source: "body",
		});
		expect(prompt).toContain("2-3 sentences");
		expect(prompt).toContain("**Key points**");
		expect(prompt).toContain("**Worth a reviewer's attention**");
		expect(prompt).toContain("(nothing stood out)");
		expect(prompt).toContain("no preamble");
		expect(prompt).toContain("no link or URL syntax");
	});

	it("caps the total prompt at PROMPT_CHAR_LIMIT by truncating the source", () => {
		const prompt = buildDocSummaryPrompt({
			title: "big-doc",
			kind: "tasks",
			source: "z".repeat(PROMPT_CHAR_LIMIT * 2),
		});
		expect(prompt.length).toBeLessThanOrEqual(PROMPT_CHAR_LIMIT);
		// Truncation ends with an ellipsis and keeps the trailing instructions.
		expect(prompt).toContain("z…");
		expect(prompt).toContain("**Worth a reviewer's attention**");
		expect(prompt).toContain("Document: big-doc");
	});

	it("handles an empty source without exceeding the budget", () => {
		const prompt = buildDocSummaryPrompt({
			title: "empty",
			kind: "design",
			source: "",
		});
		expect(prompt.length).toBeLessThanOrEqual(PROMPT_CHAR_LIMIT);
		expect(prompt).toContain("Document: empty");
	});
});

describe("docSummaryCacheKey", () => {
	it("is deterministic for the same inputs", () => {
		expect(docSummaryCacheKey("gemma-4-e2b-it", "# Doc\nbody")).toBe(
			docSummaryCacheKey("gemma-4-e2b-it", "# Doc\nbody"),
		);
	});

	it("differs when the model changes", () => {
		expect(docSummaryCacheKey("gemma-4-e2b-it", "same")).not.toBe(
			docSummaryCacheKey("qwen3.5-4b", "same"),
		);
	});

	it("differs when the source changes", () => {
		expect(docSummaryCacheKey("m", "one")).not.toBe(
			docSummaryCacheKey("m", "two"),
		);
	});

	it("embeds the model id so keys never collide across models", () => {
		expect(
			docSummaryCacheKey("qwen3.5-4b", "x").startsWith("qwen3.5-4b:"),
		).toBe(true);
	});
});
