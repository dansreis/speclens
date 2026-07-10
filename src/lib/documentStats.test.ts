import { describe, expect, it } from "vitest";
import { computeDocumentStats } from "./documentStats";

describe("computeDocumentStats", () => {
	it("counts words, characters, paragraphs, sentences, and headings", () => {
		const source = "# Title\n\nOne two three. Four five!\n\nSix seven?";
		const stats = computeDocumentStats(source);
		expect(stats.words).toBe(9); // "# Title" contributes two tokens
		expect(stats.characters).toBe(source.length);
		expect(stats.paragraphs).toBe(3);
		expect(stats.sentences).toBe(3);
		expect(stats.headings).toBe(1);
	});

	it("rounds reading time up and never below one minute", () => {
		expect(computeDocumentStats("a few words").readingTimeMinutes).toBe(1);
		const words = Array(401).fill("word").join(" ");
		expect(computeDocumentStats(words, 200).readingTimeMinutes).toBe(3);
	});

	it("handles empty-ish input", () => {
		const stats = computeDocumentStats("   ");
		expect(stats.words).toBe(0);
		expect(stats.paragraphs).toBe(0);
		expect(stats.sentences).toBe(0);
	});
});
