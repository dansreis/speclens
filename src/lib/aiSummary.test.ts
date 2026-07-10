import { describe, expect, it } from "vitest";
import {
	buildSummaryPrompt,
	formatBytes,
	PROMPT_CHAR_LIMIT,
	parseSpecLink,
	SPEC_CHAR_LIMIT,
	SPEC_LINK_SCHEME,
} from "./aiSummary";

describe("buildSummaryPrompt", () => {
	it("includes project name, capabilities, changes, and link instructions", () => {
		const prompt = buildSummaryPrompt({
			repoName: "my-project",
			capabilities: [
				{ name: "search", content: "Search spec body." },
				{ name: "auth", content: "Auth spec body." },
			],
			activeChangeTitles: ["Add Fuzzy Search"],
		});
		expect(prompt).toContain("Project: my-project");
		expect(prompt).toContain("### search\nSearch spec body.");
		expect(prompt).toContain("### auth\nAuth spec body.");
		expect(prompt).toContain("- Add Fuzzy Search");
		expect(prompt).toContain(SPEC_LINK_SCHEME);
		expect(prompt).toContain("one bullet per capability");
	});

	it("shows (none) when there are no active changes", () => {
		const prompt = buildSummaryPrompt({
			repoName: "p",
			capabilities: [{ name: "a", content: "x" }],
			activeChangeTitles: [],
		});
		expect(prompt).toContain("Active changes in flight:\n(none)");
	});

	it("truncates each spec to the per-spec limit", () => {
		const long = "a".repeat(SPEC_CHAR_LIMIT + 500);
		const prompt = buildSummaryPrompt({
			repoName: "p",
			capabilities: [{ name: "big", content: long }],
			activeChangeTitles: [],
		});
		expect(prompt).toContain(`### big\n${"a".repeat(SPEC_CHAR_LIMIT - 1)}…`);
		expect(prompt).not.toContain("a".repeat(SPEC_CHAR_LIMIT));
	});

	it("caps the total prompt evenly without dropping capabilities", () => {
		const capabilities = Array.from({ length: 20 }, (_, i) => ({
			name: `cap-${i}`,
			content: "z".repeat(SPEC_CHAR_LIMIT * 2),
		}));
		const prompt = buildSummaryPrompt({
			repoName: "p",
			capabilities,
			activeChangeTitles: [],
		});
		expect(prompt.length).toBeLessThanOrEqual(PROMPT_CHAR_LIMIT);
		for (const c of capabilities) {
			expect(prompt).toContain(`### ${c.name}\n`);
		}
		// Even truncation: every spec body ends up the same length.
		const bodies = [...prompt.matchAll(/### cap-\d+\n(z*)…/g)].map(
			(m) => m[1].length,
		);
		expect(bodies).toHaveLength(20);
		expect(new Set(bodies).size).toBe(1);
		expect(bodies[0]).toBeGreaterThan(0);
	});

	it("keeps short prompts untouched", () => {
		const input = {
			repoName: "p",
			capabilities: [{ name: "a", content: "short" }],
			activeChangeTitles: ["c1"],
		};
		expect(buildSummaryPrompt(input).length).toBeLessThan(PROMPT_CHAR_LIMIT);
		expect(buildSummaryPrompt(input)).toContain("short");
	});
});

describe("parseSpecLink", () => {
	it("extracts the capability from scheme links", () => {
		expect(parseSpecLink("speclens-spec://search")).toBe("search");
		expect(parseSpecLink("speclens-spec://user-auth/")).toBe("user-auth");
		expect(parseSpecLink("speclens-spec://a%20b")).toBe("a b");
	});

	it("returns null for other or empty links", () => {
		expect(parseSpecLink(undefined)).toBeNull();
		expect(parseSpecLink("")).toBeNull();
		expect(parseSpecLink("https://example.com")).toBeNull();
		expect(parseSpecLink("speclens-spec://")).toBeNull();
	});
});

describe("formatBytes", () => {
	it("formats GB, MB, kB, and bytes", () => {
		expect(formatBytes(3_110_000_000)).toBe("3.11 GB");
		expect(formatBytes(512_000_000)).toBe("512 MB");
		expect(formatBytes(12_000)).toBe("12 kB");
		expect(formatBytes(42)).toBe("42 B");
	});
});
