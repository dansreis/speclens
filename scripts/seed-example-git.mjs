#!/usr/bin/env node
/**
 * Seed each examples/* with a real .git/ history so SpecLens has authorship data
 * to render. Idempotent: re-run with --force to wipe and re-seed.
 *
 * Pipeline: seed-example-git.mjs → extract-example-history.mjs → .history.json
 *   See CLAUDE.md "Local-git authorship" for the full data flow.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const EXAMPLES_DIR = join(ROOT, "examples");
const FORCE = process.argv.includes("--force");

const AUTHORS = [
	{ name: "Daniel Reis", email: "daniel@speclens.dev" },
	{ name: "Anna Costa", email: "anna@speclens.dev" },
	{ name: "Pedro Silva", email: "pedro@speclens.dev" },
	{ name: "Sofia Mendes", email: "sofia@speclens.dev" },
	{ name: "Marcus Tang", email: "marcus@speclens.dev" },
	{ name: "Joana Pinto", email: "joana@speclens.dev" },
];

// Mirrors src/lib/exampleLoader.ts mockTimestamps so commit dates line up with
// the UI's existing createdAt/archivedAt. Keep in sync by hand.
const TIMESTAMPS = {
	"add-multi-touch-attribution": { createdAt: "2026-05-22T11:00:00Z" },
	"migrate-tenant-isolation-to-schema-per-tenant": {
		createdAt: "2026-05-18T09:30:00Z",
	},
	"deprecate-legacy-impression-pixel": { createdAt: "2026-04-22T15:40:00Z" },
	"rename-stop-overspend-requirement": { createdAt: "2026-05-30T13:10:00Z" },
	"add-budget-pacing-v2-smoothing": { createdAt: "2026-04-30T10:00:00Z" },
	"add-fraud-shadow-mode": { createdAt: "2026-05-08T14:20:00Z" },
	"introduce-roas-forecasting": { createdAt: "2026-06-08T09:00:00Z" },
	"add-self-service-creative-upload": { createdAt: "2026-05-05T11:45:00Z" },
	"2025-08-12-init-platform-skeleton": {
		createdAt: "2025-08-12T09:00:00Z",
		archivedAt: "2025-08-30T17:00:00Z",
	},
	"2025-09-04-add-campaign-management": {
		createdAt: "2025-09-04T10:30:00Z",
		archivedAt: "2025-09-20T15:00:00Z",
	},
	"2025-09-22-add-bid-engine-mvp": {
		createdAt: "2025-09-22T08:45:00Z",
		archivedAt: "2025-10-08T18:20:00Z",
	},
	"2025-10-10-add-ad-decisioning-pipeline": {
		createdAt: "2025-10-10T11:00:00Z",
		archivedAt: "2025-10-26T16:30:00Z",
	},
	"2025-10-28-add-impression-pixel": {
		createdAt: "2025-10-28T09:15:00Z",
		archivedAt: "2025-11-12T14:00:00Z",
	},
	"2025-11-14-add-budget-pacing-v1": {
		createdAt: "2025-11-14T10:00:00Z",
		archivedAt: "2025-12-01T13:45:00Z",
	},
	"2025-12-02-add-audience-segments": {
		createdAt: "2025-12-02T11:30:00Z",
		archivedAt: "2025-12-18T17:15:00Z",
	},
	"2026-01-09-introduce-brand-safety": {
		createdAt: "2026-01-09T09:00:00Z",
		archivedAt: "2026-01-28T16:00:00Z",
	},
	"2026-01-30-add-rls-tenant-isolation": {
		createdAt: "2026-01-30T08:30:00Z",
		archivedAt: "2026-02-14T15:30:00Z",
	},
	"2026-02-18-add-last-click-attribution": {
		createdAt: "2026-02-18T10:15:00Z",
		archivedAt: "2026-03-04T14:50:00Z",
	},
	"2026-03-05-add-billing-and-payouts": {
		createdAt: "2026-03-05T09:45:00Z",
		archivedAt: "2026-03-26T17:00:00Z",
	},
	"2026-03-28-migrate-bid-state-to-scylladb": {
		createdAt: "2026-03-28T08:00:00Z",
		archivedAt: "2026-04-30T18:00:00Z",
	},
	"2026-04-15-add-creative-approval-workflow": {
		createdAt: "2026-04-15T10:30:00Z",
		archivedAt: "2026-05-02T16:00:00Z",
	},
	// Evergreen Health EHR (example7) — active changes
	"add-medication-safety-keyword-blocklist": {
		createdAt: "2026-05-12T14:22:00Z",
	},
	"add-prescription-pacing-v2-smoothing": { createdAt: "2026-04-30T10:00:00Z" },
	"add-duplicate-order-shadow-mode": { createdAt: "2026-05-08T14:20:00Z" },
	"add-multi-provider-attribution": { createdAt: "2026-05-22T11:00:00Z" },
	"add-self-service-document-upload": { createdAt: "2026-05-05T11:45:00Z" },
	"add-webhook-signing-rotation": { createdAt: "2026-05-20T09:10:00Z" },
	"introduce-readmission-risk-forecasting": {
		createdAt: "2026-06-08T09:00:00Z",
	},
	"deprecate-legacy-encounter-pixel": { createdAt: "2026-04-22T15:40:00Z" },
	"rename-stop-overdispense-requirement": { createdAt: "2026-05-30T13:10:00Z" },
	// Evergreen Health EHR (example7) — archived changes
	"2025-09-04-add-patient-records": {
		createdAt: "2025-09-04T10:30:00Z",
		archivedAt: "2025-09-20T15:00:00Z",
	},
	"2025-09-22-add-clinical-orders-mvp": {
		createdAt: "2025-09-22T08:45:00Z",
		archivedAt: "2025-10-08T18:20:00Z",
	},
	"2025-10-10-add-clinical-decisioning-pipeline": {
		createdAt: "2025-10-10T11:00:00Z",
		archivedAt: "2025-10-26T16:30:00Z",
	},
	"2025-10-28-add-encounter-pixel": {
		createdAt: "2025-10-28T09:15:00Z",
		archivedAt: "2025-11-12T14:00:00Z",
	},
	"2025-11-14-add-prescription-pacing-v1": {
		createdAt: "2025-11-14T10:00:00Z",
		archivedAt: "2025-12-01T13:45:00Z",
	},
	"2025-12-02-add-cohort-targeting": {
		createdAt: "2025-12-02T11:30:00Z",
		archivedAt: "2025-12-18T17:15:00Z",
	},
	"2026-01-09-introduce-medication-safety": {
		createdAt: "2026-01-09T09:00:00Z",
		archivedAt: "2026-01-28T16:00:00Z",
	},
	"2026-02-18-add-last-touch-attribution": {
		createdAt: "2026-02-18T10:15:00Z",
		archivedAt: "2026-03-04T14:50:00Z",
	},
	"2026-03-05-add-billing-and-claims": {
		createdAt: "2026-03-05T09:45:00Z",
		archivedAt: "2026-03-26T17:00:00Z",
	},
	"2026-03-28-migrate-encounter-state-to-cassandra": {
		createdAt: "2026-03-28T08:00:00Z",
		archivedAt: "2026-04-30T18:00:00Z",
	},
	"2026-04-15-add-eprescribing-approval-workflow": {
		createdAt: "2026-04-15T10:30:00Z",
		archivedAt: "2026-05-02T16:00:00Z",
	},
};

// Deterministic offset so two different inputs hash to different authors but
// the same input always hashes the same way.
function hash(s) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h >>> 0;
}

function authorFor(seed) {
	return AUTHORS[hash(seed) % AUTHORS.length];
}

function otherAuthorFor(seed, exclude) {
	const filtered = AUTHORS.filter((a) => a.email !== exclude.email);
	return filtered[hash(`${seed}::edit`) % filtered.length];
}

function listExampleRepos() {
	return readdirSync(EXAMPLES_DIR)
		.map((name) => join(EXAMPLES_DIR, name))
		.filter(
			(p) => statSync(p).isDirectory() && existsSync(join(p, "config.json")),
		);
}

function walk(dir, base = dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		if (entry === ".git") continue;
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) out.push(...walk(full, base));
		else out.push(relative(base, full));
	}
	return out;
}

function listChangeDirs(repoPath) {
	const changesRoot = join(repoPath, "openspec", "changes");
	if (!existsSync(changesRoot)) return [];
	const out = [];
	for (const entry of readdirSync(changesRoot)) {
		const full = join(changesRoot, entry);
		if (!statSync(full).isDirectory()) continue;
		if (entry === "archive") {
			for (const sub of readdirSync(full)) {
				const subFull = join(full, sub);
				if (statSync(subFull).isDirectory()) {
					out.push({ slug: sub, archived: true, dir: subFull });
				}
			}
		} else {
			out.push({ slug: entry, archived: false, dir: full });
		}
	}
	return out;
}

function git(repoPath, args, env = {}) {
	return execFileSync("git", args, {
		cwd: repoPath,
		env: { ...process.env, ...env },
		stdio: ["ignore", "pipe", "pipe"],
	})
		.toString()
		.trim();
}

function commit(repoPath, files, message, author, isoDate) {
	const env = {
		GIT_AUTHOR_NAME: author.name,
		GIT_AUTHOR_EMAIL: author.email,
		GIT_AUTHOR_DATE: isoDate,
		GIT_COMMITTER_NAME: author.name,
		GIT_COMMITTER_EMAIL: author.email,
		GIT_COMMITTER_DATE: isoDate,
	};
	git(repoPath, ["add", "--", ...files], env);
	git(repoPath, ["commit", "-m", message, "--allow-empty"], env);
}

function timestampFor(slug) {
	const explicit = TIMESTAMPS[slug];
	if (explicit) return explicit;
	// Synthesize a date deterministically for slugs we don't know about.
	const baseDate = new Date("2026-03-15T10:00:00Z").getTime();
	const offsetDays = (hash(slug) % 90) - 45;
	const synthesized = new Date(baseDate + offsetDays * 86400_000);
	return { createdAt: synthesized.toISOString() };
}

function addDays(iso, days) {
	const d = new Date(iso);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString();
}

function seedRepo(repoPath) {
	const id = relative(EXAMPLES_DIR, repoPath);
	const gitDir = join(repoPath, ".git");
	if (existsSync(gitDir)) {
		if (!FORCE) {
			console.log(`  ${id}: skipping (already seeded, use --force to rebuild)`);
			return;
		}
		rmSync(gitDir, { recursive: true, force: true });
	}

	git(repoPath, ["init", "-q", "-b", "main"]);

	const allFiles = walk(repoPath);
	const changeDirs = listChangeDirs(repoPath);
	const changeFileSet = new Set();
	for (const c of changeDirs) {
		const rel = relative(repoPath, c.dir);
		for (const f of allFiles) {
			if (f === rel || f.startsWith(`${rel}/`)) changeFileSet.add(f);
		}
	}
	const baseFiles = allFiles.filter((f) => !changeFileSet.has(f));

	// Repo skeleton (config.json, openspec/config.yaml, schemas, root specs, etc.)
	// gets committed up front by Daniel so the tree exists before any change lands.
	const skeletonDate = "2026-01-01T09:00:00Z";
	if (baseFiles.length > 0) {
		commit(
			repoPath,
			baseFiles,
			"chore: initial repo skeleton",
			AUTHORS[0],
			skeletonDate,
		);
	}

	// Sort by creation date so history reads chronologically — git log later
	// would show creator order anyway, but this also keeps follow-up edits
	// from time-traveling past unrelated changes.
	const sorted = changeDirs
		.map((c) => ({ ...c, ts: timestampFor(c.slug) }))
		.sort(
			(a, b) =>
				new Date(a.ts.createdAt).getTime() - new Date(b.ts.createdAt).getTime(),
		);

	let committed = 0;
	for (const c of sorted) {
		const relDir = relative(repoPath, c.dir);
		const files = allFiles.filter(
			(f) => f === relDir || f.startsWith(`${relDir}/`),
		);
		if (files.length === 0) continue;
		committed++;
		const creator = authorFor(`${id}::${c.slug}`);
		const message = c.archived
			? `feat(${c.slug}): land change (later archived)`
			: `feat(${c.slug}): add change proposal and specs`;
		commit(repoPath, files, message, creator, c.ts.createdAt);

		// ~50% of active changes get a deterministic follow-up edit by a
		// different author, so created-by and last-edited-by can diverge.
		if (!c.archived && hash(`${id}::${c.slug}::edit?`) % 2 === 0) {
			const editor = otherAuthorFor(`${id}::${c.slug}`, creator);
			const editDate = addDays(
				c.ts.createdAt,
				1 + (hash(`${id}::${c.slug}::days`) % 5),
			);
			// Touch tasks.md if present, else any one file in the change folder.
			const tasksFile = files.find((f) => f.endsWith("/tasks.md"));
			const target = tasksFile ?? files[0];
			commit(
				repoPath,
				[target],
				`chore(${c.slug}): refine tasks`,
				editor,
				editDate,
			);
		}

		if (c.archived && c.ts.archivedAt) {
			// One symbolic archive commit by a different author so the file's
			// lastEditedBy reflects "who closed it out" rather than the creator.
			const archiver = otherAuthorFor(`${id}::${c.slug}::arch`, creator);
			const tasksFile = files.find((f) => f.endsWith("/tasks.md"));
			const target = tasksFile ?? files[0];
			commit(
				repoPath,
				[target],
				`chore(${c.slug}): archive`,
				archiver,
				c.ts.archivedAt,
			);
		}
	}

	console.log(`  ${id}: seeded ${committed} change(s)`);
}

function main() {
	const repos = listExampleRepos();
	if (repos.length === 0) {
		console.error("No example repos found under examples/");
		process.exit(1);
	}
	console.log(
		`Seeding ${repos.length} example repo(s)${FORCE ? " (force)" : ""}:`,
	);
	for (const repo of repos) seedRepo(repo);
	console.log("Done. Run `pnpm extract:history` next.");
}

main();
