import { describe, expect, it } from "vitest";
import {
	buildSummaryPrompt,
	formatBytes,
	linkifyCapabilities,
	PROMPT_CHAR_LIMIT,
	parseSpecLink,
	SPEC_CHAR_LIMIT,
	SPEC_LINK_SCHEME,
} from "./aiSummary";

describe("buildSummaryPrompt", () => {
	it("includes project name, capabilities, changes, and plain-bullet instructions", () => {
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
		expect(prompt).toContain("exactly 2 capabilities");
		expect(prompt).toContain("one bullet per capability");
		// Linking is done in code (linkifyCapabilities) - the model must not
		// attempt link syntax, so the scheme never appears in the prompt.
		expect(prompt).not.toContain(SPEC_LINK_SCHEME);
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

describe("linkifyCapabilities", () => {
	const caps = ["agent-playbooks", "billing-and-claims", "category-reporting"];
	const canonical = (name: string, desc: string) =>
		`- **[${name}](speclens-spec://${name})** - ${desc}`;

	it("links plain '- name: description' bullets", () => {
		expect(
			linkifyCapabilities("- billing-and-claims: Governs claims.", caps),
		).toBe(canonical("billing-and-claims", "Governs claims."));
	});

	it("repairs the observed 'name](scheme://name)' mangling", () => {
		const broken =
			"- **agent-playbooks](speclens-spec://agent-playbooks)** - Codifies workflows.";
		expect(linkifyCapabilities(broken, caps)).toBe(
			canonical("agent-playbooks", "Codifies workflows."),
		);
	});

	it("repairs the observed 'name(scheme://name)' mangling", () => {
		const broken =
			"- **category-reporting(speclens-spec://category-reporting)** - Defines logging.";
		expect(linkifyCapabilities(broken, caps)).toBe(
			canonical("category-reporting", "Defines logging."),
		);
	});

	it("is idempotent on already-canonical bullets", () => {
		const ok = canonical("billing-and-claims", "Governs claims.");
		expect(linkifyCapabilities(ok, caps)).toBe(ok);
	});

	it("leaves non-capability bullets and prose untouched", () => {
		const text = "An overview paragraph.\n- some other bullet: unrelated";
		expect(linkifyCapabilities(text, caps)).toBe(text);
	});

	it("matches capability names case-insensitively", () => {
		expect(linkifyCapabilities("- Billing-and-claims: Governs.", caps)).toBe(
			canonical("billing-and-claims", "Governs."),
		);
	});
});
