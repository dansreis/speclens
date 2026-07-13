import { describe, expect, it } from "vitest";
import {
	CHECK_INTERVAL_MS,
	isNewerVersion,
	parseVersion,
	shouldCheck,
	shouldNotify,
} from "./updateCheck";

describe("parseVersion / isNewerVersion", () => {
	it("parses with and without the v prefix", () => {
		expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
		expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
		expect(parseVersion("v1.2")).toBeNull();
		expect(parseVersion("nightly")).toBeNull();
	});

	it("compares semver correctly", () => {
		expect(isNewerVersion("v1.1.1", "1.1.0")).toBe(true);
		expect(isNewerVersion("v1.1.0", "1.1.0")).toBe(false);
		expect(isNewerVersion("v1.0.9", "1.1.0")).toBe(false);
		expect(isNewerVersion("v2.0.0", "1.9.9")).toBe(true);
		expect(isNewerVersion("v1.2.0", "1.1.9")).toBe(true);
	});

	it("never notifies on unparsable tags", () => {
		expect(isNewerVersion("beta", "1.0.0")).toBe(false);
	});
});

describe("shouldCheck / shouldNotify", () => {
	it("checks when never checked or a day has passed", () => {
		expect(shouldCheck({ lastCheckedAt: null, dismissedTag: null }, 100)).toBe(
			true,
		);
		const now = CHECK_INTERVAL_MS + 5000;
		expect(shouldCheck({ lastCheckedAt: 1000, dismissedTag: null }, now)).toBe(
			true,
		);
		expect(
			shouldCheck({ lastCheckedAt: now - 1000, dismissedTag: null }, now),
		).toBe(false);
	});

	it("does not re-notify a dismissed tag", () => {
		expect(shouldNotify("v1.1.1", "1.1.0", "v1.1.1")).toBe(false);
		expect(shouldNotify("v1.1.1", "1.1.0", "v1.1.0")).toBe(true);
		expect(shouldNotify("v1.1.1", "1.1.0", null)).toBe(true);
	});
});
