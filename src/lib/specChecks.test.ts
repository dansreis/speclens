import { describe, expect, it } from "vitest";
import type { Change, Repo, RepoSpecDoc } from "./repoLoader";
import { DEFAULT_SCHEMA } from "./schema";
import {
	changeKeyOf,
	checkHighlightTargets,
	checksForChange,
	countBySeverity,
	findingDocumentId,
	maxSeverity,
	runSpecChecks,
	type SpecCheckResult,
} from "./specChecks";

const PROPOSAL = "## Why\n\nBecause.\n";
const TASKS = "## Tasks\n\n- [ ] wire the search capability\n";

function makeChange(overrides: Partial<Change> = {}): Change {
	const specs = overrides.specs ?? {};
	const documentFiles: Change["documentFiles"] = {};
	const proposal =
		overrides.proposal !== undefined ? overrides.proposal : PROPOSAL;
	const tasks = overrides.tasks !== undefined ? overrides.tasks : TASKS;
	if (proposal !== null) {
		documentFiles.proposal = [
			{ name: "proposal", path: "proposal.md", content: proposal },
		];
	}
	if (tasks !== null) {
		documentFiles.tasks = [{ name: "tasks", path: "tasks.md", content: tasks }];
	}
	if (Object.keys(specs).length > 0) {
		documentFiles.specs = Object.entries(specs).map(([cap, content]) => ({
			name: cap,
			path: `specs/${cap}/spec.md`,
			content,
		}));
	}
	return {
		slug: "add-search",
		name: "Add Search",
		archived: false,
		createdAt: null,
		archivedAt: null,
		schema: DEFAULT_SCHEMA,
		configYaml: null,
		schemaYaml: null,
		documents: {},
		documentFiles,
		specs,
		proposal,
		tasks,
		authorship: null,
		...overrides,
	};
}

function makeRepo(changes: Change[], capabilities: string[] = []): Repo {
	const repoSpecs: RepoSpecDoc[] = capabilities.map((capability) => ({
		capability,
		content: "# Spec",
		path: `specs/${capability}/spec.md`,
		authorship: null,
	}));
	return {
		id: "/tmp/repo",
		name: "repo",
		type: "local",
		hasGit: false,
		headSha: null,
		schema: DEFAULT_SCHEMA,
		config: null,
		configYaml: null,
		schemaYaml: null,
		changes,
		repoSpecs,
		schemas: [],
		folders: [],
	};
}

function ids(results: SpecCheckResult[]): string[] {
	return results.map((r) => r.id);
}

describe("structural checks", () => {
	it("SL001/SL002 flag missing proposal and tasks", () => {
		const repo = makeRepo([makeChange({ proposal: null, tasks: null })]);
		const results = runSpecChecks(repo);
		expect(ids(results)).toContain("SL001");
		expect(ids(results)).toContain("SL002");
	});

	it("stays quiet on a complete change", () => {
		const repo = makeRepo([makeChange()]);
		expect(runSpecChecks(repo)).toEqual([]);
	});

	it("skips archived changes for structural checks", () => {
		const repo = makeRepo([
			makeChange({ archived: true, proposal: null, tasks: null }),
		]);
		expect(ids(runSpecChecks(repo))).toEqual([]);
	});

	it("SL003 flags a delta for an unknown capability without ADDED", () => {
		const spec = "## MODIFIED Requirements\n\n### Requirement: X\n\nBody.\n";
		const repo = makeRepo(
			[makeChange({ specs: { ghost: spec }, tasks: "- [ ] ghost work" })],
			["search"],
		);
		const results = runSpecChecks(repo);
		expect(ids(results)).toContain("SL003");
		const finding = results.find((r) => r.id === "SL003");
		expect(finding?.tab).toBe("specs");
		expect(finding?.file).toBe("ghost");
	});

	it("SL003 accepts a new capability introduced via ADDED", () => {
		const spec = "## ADDED Requirements\n\n### Requirement: X\n\nBody.\n";
		const repo = makeRepo(
			[makeChange({ specs: { "brand-new": spec }, tasks: "- [ ] brand-new" })],
			["search"],
		);
		expect(ids(runSpecChecks(repo))).not.toContain("SL003");
	});

	it("SL004 flags WHEN without THEN and orphaned scenarios", () => {
		const spec = [
			"## ADDED Requirements",
			"### Requirement: Search MUST return results",
			"#### Scenario: query entered",
			"- WHEN the user types a query",
			"- the list updates",
			"",
			"## Notes",
			"#### Scenario: orphaned",
			"- WHEN something",
			"- THEN something",
		].join("\n");
		const repo = makeRepo([
			makeChange({ specs: { search: spec }, tasks: "- [ ] search" }),
		]);
		const results = runSpecChecks(repo).filter((r) => r.id === "SL004");
		expect(results).toHaveLength(2);
		expect(results.map((r) => r.message).join(" ")).toMatch(/WHEN.*no THEN/);
		expect(results.map((r) => r.message).join(" ")).toMatch(
			/no owning requirement/,
		);
	});

	it("SL004 ignores keywords inside fenced code blocks", () => {
		const spec = [
			"## ADDED Requirements",
			"### Requirement: Search MUST work",
			"#### Scenario: ok",
			"- WHEN the user types",
			"- THEN results appear",
			"```",
			"#### Scenario: fake",
			"WHEN inside a fence",
			"```",
		].join("\n");
		const repo = makeRepo([
			makeChange({ specs: { search: spec }, tasks: "- [ ] search" }),
		]);
		expect(ids(runSpecChecks(repo))).not.toContain("SL004");
	});

	it("SL005 flags a requirement heading with an empty body", () => {
		const spec = [
			"## ADDED Requirements",
			"### Requirement: Empty one",
			"### Requirement: Full one",
			"The system MUST respond.",
		].join("\n");
		const repo = makeRepo([
			makeChange({ specs: { search: spec }, tasks: "- [ ] search" }),
		]);
		const results = runSpecChecks(repo).filter((r) => r.id === "SL005");
		expect(results).toHaveLength(1);
		expect(results[0].message).toContain("Empty one");
		expect(results[0].heading).toBe("Requirement: Empty one");
	});

	it("SL005 treats a requirement with only scenarios as non-empty", () => {
		const spec = [
			"## ADDED Requirements",
			"### Requirement: Has scenarios",
			"#### Scenario: ok",
			"- WHEN a\n- THEN b",
		].join("\n");
		const repo = makeRepo([
			makeChange({ specs: { search: spec }, tasks: "- [ ] search" }),
		]);
		expect(ids(runSpecChecks(repo))).not.toContain("SL005");
	});
});

describe("consistency checks", () => {
	it("SL010 flags near-duplicate requirements across capabilities", () => {
		const a =
			"### Requirement: Reject over-limit input\nThe api MUST reject.\n";
		const b =
			"### Requirement: Reject  over-limit input!\nThe ui MUST reject.\n";
		const repo = makeRepo([
			makeChange({
				specs: { api: a, ui: b },
				tasks: "- [ ] api and ui",
			}),
		]);
		const results = runSpecChecks(repo).filter((r) => r.id === "SL010");
		expect(results).toHaveLength(2);
	});

	it("SL011 flags an active change referencing an archived slug", () => {
		const archived = makeChange({
			slug: "old-search",
			archived: true,
			tasks: "- [x] done",
		});
		const current = makeChange({
			proposal: "Builds on old-search groundwork.\n",
		});
		const repo = makeRepo([archived, current]);
		const results = runSpecChecks(repo).filter((r) => r.id === "SL011");
		expect(results).toHaveLength(1);
		expect(results[0].changeKey).toBe("add-search");
	});

	it("SL012 flags tasks that never mention a touched capability", () => {
		const spec = "### Requirement: R\nThe system MUST respond.\n";
		const repo = makeRepo([
			makeChange({ specs: { search: spec }, tasks: "- [ ] unrelated work" }),
		]);
		expect(ids(runSpecChecks(repo))).toContain("SL012");
	});

	it("SL013 flags complete-but-active and archived-but-incomplete", () => {
		const completeActive = makeChange({ tasks: "- [x] a\n- [x] b" });
		const incompleteArchived = makeChange({
			slug: "old-thing",
			archived: true,
			tasks: "- [ ] a\n- [x] b",
		});
		const repo = makeRepo([completeActive, incompleteArchived]);
		const results = runSpecChecks(repo).filter((r) => r.id === "SL013");
		expect(results).toHaveLength(2);
		expect(results.map((r) => r.changeKey).sort()).toEqual([
			"add-search",
			"archive/old-thing",
		]);
	});
});

describe("language checks", () => {
	function specRepo(line: string): Repo {
		const spec = `### Requirement: R\n${line}\n`;
		return makeRepo([
			makeChange({ specs: { search: spec }, tasks: "- [ ] search" }),
		]);
	}

	it("SL020 flags lowercase modal verbs", () => {
		const results = runSpecChecks(specRepo("The system must respond."));
		expect(ids(results)).toContain("SL020");
	});

	it("SL020 ignores uppercase modals and inline code", () => {
		expect(
			ids(runSpecChecks(specRepo("The system MUST respond."))),
		).not.toContain("SL020");
		expect(
			ids(runSpecChecks(specRepo("Set `must_retry` in the config."))),
		).not.toContain("SL020");
	});

	it("SL021 flags conflicting modality in one clause", () => {
		const results = runSpecChecks(
			specRepo("The system SHOULD retry and MUST log."),
		);
		expect(ids(results)).toContain("SL021");
	});

	it("SL022 flags ambiguity terms including multiword ones", () => {
		expect(
			ids(runSpecChecks(specRepo("The system MUST respond quickly."))),
		).toContain("SL022");
		expect(ids(runSpecChecks(specRepo("Retries happen as needed.")))).toContain(
			"SL022",
		);
	});

	it("SL023 fires only in normative sentences", () => {
		expect(
			ids(runSpecChecks(specRepo("The system MUST retain some entries."))),
		).toContain("SL023");
		expect(
			ids(runSpecChecks(specRepo("There are some entries in the cache."))),
		).not.toContain("SL023");
	});

	it("attaches the nearest heading for deep-linking", () => {
		const results = runSpecChecks(specRepo("The system must respond."));
		const finding = results.find((r) => r.id === "SL020");
		expect(finding?.heading).toBe("Requirement: R");
		expect(finding?.tab).toBe("specs");
	});

	it("carries the offending line as a render-matched snippet", () => {
		const results = runSpecChecks(
			specRepo("- The system **must** respond quickly."),
		);
		const finding = results.find((r) => r.id === "SL022");
		expect(finding?.snippet).toBe("The system must respond quickly.");
	});
});

describe("highlight targets", () => {
	it("builds severity-classed underline targets for one document", () => {
		const spec = [
			"### Requirement: R",
			"- The system MUST respond quickly.",
		].join("\n");
		const change = makeChange({
			specs: { search: spec },
			tasks: "- [ ] search",
		});
		const repo = makeRepo([change]);
		const results = runSpecChecks(repo);
		const finding = results.find((r) => r.id === "SL022");
		expect(finding).toBeDefined();
		const docId = finding && findingDocumentId(change, finding);
		expect(docId).toBe("add-search/specs");
		const targets = checkHighlightTargets(repo, results, docId as string);
		expect(targets).toHaveLength(1);
		expect(targets[0].text).toBe("The system MUST respond quickly.");
		expect(targets[0].className).toContain("spec-check-warning");
		expect(checkHighlightTargets(repo, results, "other/doc")).toEqual([]);
	});

	it("keeps the highest severity when findings share a line", () => {
		const spec = [
			"### Requirement: R",
			"- The system must respond quickly.",
		].join("\n");
		const change = makeChange({
			specs: { search: spec },
			tasks: "- [ ] search",
		});
		const repo = makeRepo([change]);
		// SL020 (warning) and SL022 (warning) share the line; dedupe keeps one.
		const targets = checkHighlightTargets(
			repo,
			runSpecChecks(repo),
			"add-search/specs",
		);
		const lineTargets = targets.filter(
			(t) => t.text === "The system must respond quickly.",
		);
		expect(lineTargets).toHaveLength(1);
	});
});

describe("helpers", () => {
	it("countBySeverity and maxSeverity aggregate correctly", () => {
		const results = runSpecChecks(
			makeRepo([makeChange({ proposal: null, tasks: null })]),
		);
		const counts = countBySeverity(results);
		expect(counts.errors).toBe(2);
		expect(counts.total).toBe(2);
		expect(maxSeverity(counts)).toBe("error");
		expect(maxSeverity(countBySeverity([]))).toBeNull();
	});

	it("checksForChange filters by change key", () => {
		const a = makeChange({ proposal: null });
		const b = makeChange({ slug: "other-change", tasks: null });
		const results = runSpecChecks(makeRepo([a, b]));
		expect(ids(checksForChange(results, changeKeyOf(a)))).toEqual(["SL001"]);
		expect(ids(checksForChange(results, changeKeyOf(b)))).toEqual(["SL002"]);
	});
});
