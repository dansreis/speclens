import { describe, expect, it } from "vitest";
import { extractHeadings } from "./extractHeadings";

describe("extractHeadings", () => {
	it("extracts depth, text, and slug", () => {
		const md = ["# Title", "## Sub section", "###### Deep"].join("\n");
		expect(extractHeadings(md)).toEqual([
			{ depth: 1, text: "Title", slug: "title" },
			{ depth: 2, text: "Sub section", slug: "sub-section" },
			{ depth: 6, text: "Deep", slug: "deep" },
		]);
	});

	it("deduplicates slugs like GitHub does", () => {
		const md = ["## Setup", "## Setup"].join("\n");
		expect(extractHeadings(md).map((h) => h.slug)).toEqual([
			"setup",
			"setup-1",
		]);
	});

	it("strips inline backticks and trailing hashes", () => {
		const md = ["## `code` heading ##"].join("\n");
		expect(extractHeadings(md)).toEqual([
			{ depth: 2, text: "code heading", slug: "code-heading" },
		]);
	});

	it("ignores headings inside fenced code blocks", () => {
		const md = ["```sh", "# not a heading", "```", "# Real"].join("\n");
		expect(extractHeadings(md).map((h) => h.text)).toEqual(["Real"]);
	});

	it("does not treat #hashtag lines as headings", () => {
		expect(extractHeadings("#nospace")).toEqual([]);
	});
});
