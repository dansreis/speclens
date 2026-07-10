import { describe, expect, it } from "vitest";
import { countTaskCompletion } from "./tasksCompletion";

describe("countTaskCompletion", () => {
	it("counts open and done checkboxes", () => {
		const md = ["- [ ] one", "- [x] two", "- [X] three", "plain line"].join(
			"\n",
		);
		expect(countTaskCompletion(md)).toEqual({ total: 3, done: 2 });
	});

	it("recognises * list markers and indentation", () => {
		const md = ["* [X] star", "  - [ ] nested", "\t- [x] tabbed"].join("\n");
		expect(countTaskCompletion(md)).toEqual({ total: 3, done: 2 });
	});

	it("ignores checkboxes inside fenced code blocks", () => {
		const md = [
			"- [x] before",
			"```md",
			"- [ ] inside fence",
			"- [x] also inside",
			"```",
			"- [ ] after",
			"~~~",
			"- [x] tilde fence",
			"~~~",
		].join("\n");
		expect(countTaskCompletion(md)).toEqual({ total: 2, done: 1 });
	});

	it("does not count checkbox-like text mid-line", () => {
		expect(countTaskCompletion("see - [x] not a list item")).toEqual({
			total: 0,
			done: 0,
		});
	});

	it("returns zeros for empty input", () => {
		expect(countTaskCompletion("")).toEqual({ total: 0, done: 0 });
	});
});
