#!/usr/bin/env node
/**
 * Read git log from each seeded examples/* and emit history.json that the
 * loader bundles via Vite glob. Run after seed-example-git.mjs.
 *
 * Output shape (per example):
 *   {
 *     "changes": {
 *       "<archived-prefix><slug>": {
 *         "rolled":  { createdBy, createdAt, lastEditedBy, lastEditedAt, editCount },
 *         "files":   { "<relPathFromChangeRoot>": { ...same... } }
 *       }
 *     }
 *   }
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const EXAMPLES_DIR = join(ROOT, "examples");

function listExampleRepos() {
	return readdirSync(EXAMPLES_DIR)
		.map((name) => join(EXAMPLES_DIR, name))
		.filter(
			(p) => statSync(p).isDirectory() && existsSync(join(p, "config.json")),
		);
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

function walkFiles(dir, base = dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		if (entry === ".git") continue;
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) out.push(...walkFiles(full, base));
		else out.push(relative(base, full));
	}
	return out;
}

function gitLog(repoPath, pathspec) {
	// Lines are newest-first by default; the `0x1f` separator avoids any
	// realistic collision with author names that include "|".
	const SEP = "\x1f";
	const out = execFileSync(
		"git",
		[
			"log",
			"--follow",
			`--format=%H${SEP}%aN${SEP}%aE${SEP}%aI`,
			"--",
			pathspec,
		],
		{ cwd: repoPath, stdio: ["ignore", "pipe", "pipe"] },
	)
		.toString()
		.trim();
	if (!out) return [];
	return out.split("\n").map((line) => {
		const [hash, name, email, date] = line.split(SEP);
		return { hash, name, email, date };
	});
}

function gitLogDir(repoPath, dirRel) {
	const SEP = "\x1f";
	const out = execFileSync(
		"git",
		["log", `--format=%H${SEP}%aN${SEP}%aE${SEP}%aI`, "--", dirRel],
		{ cwd: repoPath, stdio: ["ignore", "pipe", "pipe"] },
	)
		.toString()
		.trim();
	if (!out) return [];
	return out.split("\n").map((line) => {
		const [hash, name, email, date] = line.split(SEP);
		return { hash, name, email, date };
	});
}

function rollup(commits) {
	if (commits.length === 0) return null;
	const last = commits[0];
	const first = commits[commits.length - 1];
	return {
		createdAt: first.date,
		createdBy: { name: first.name, email: first.email },
		lastEditedAt: last.date,
		lastEditedBy: { name: last.name, email: last.email },
		editCount: commits.length,
	};
}

function extractRepo(repoPath) {
	const id = relative(EXAMPLES_DIR, repoPath);
	if (!existsSync(join(repoPath, ".git"))) {
		console.log(`  ${id}: no .git/, skipping (run pnpm seed:examples first)`);
		return false;
	}

	const changes = {};
	const changeDirs = listChangeDirs(repoPath);
	for (const c of changeDirs) {
		const dirRel = relative(repoPath, c.dir);
		const rolled = rollup(gitLogDir(repoPath, dirRel));
		if (!rolled) continue;
		const files = {};
		for (const f of walkFiles(c.dir)) {
			const fileRel = `${dirRel}/${f}`;
			const fileRolled = rollup(gitLog(repoPath, fileRel));
			if (fileRolled) files[f] = fileRolled;
		}
		const key = `${c.archived ? "archive/" : ""}${c.slug}`;
		changes[key] = { rolled, files };
	}

	const out = { changes };
	writeFileSync(
		join(repoPath, "history.json"),
		`${JSON.stringify(out, null, "\t")}\n`,
	);
	console.log(
		`  ${id}: ${Object.keys(changes).length} change(s) → history.json`,
	);
	return true;
}

function main() {
	const repos = listExampleRepos();
	let extracted = 0;
	console.log(`Extracting history from ${repos.length} example repo(s):`);
	for (const repo of repos) {
		if (extractRepo(repo)) extracted++;
	}
	if (extracted === 0) {
		console.error("No repos had .git/ — run `pnpm seed:examples` first.");
		process.exit(1);
	}
}

main();
