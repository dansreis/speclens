#!/usr/bin/env node

/**
 * Create Release Script
 * Usage:
 *   pnpm create-release           (interactive - prompts for release type)
 *   pnpm create-release [type]    (direct - where type is major, minor, or patch)
 *
 * This script:
 * 1. Prompts for release type (if not provided)
 * 2. Shows a preview of the version change and asks for confirmation
 * 3. Bumps the version in package.json, src-tauri/tauri.conf.json,
 *    src-tauri/Cargo.toml, and src-tauri/Cargo.lock
 * 4. Generates/updates CHANGELOG.md from commits since the last tag
 *
 * After running this script, review the changes and open a PR.
 * Once merged to main, the release workflow builds the app, tags the
 * version, and publishes a GitHub release.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

let versionType = process.argv[2];

if (versionType && !["major", "minor", "patch"].includes(versionType)) {
	console.error("❌ Invalid version type. Must be one of: major, minor, patch");
	process.exit(1);
}

function exec(command, options = {}) {
	const { ignoreError = false, ...execOptions } = options;
	try {
		return execSync(command, {
			encoding: "utf8",
			cwd: rootDir,
			...execOptions,
		}).trim();
	} catch (error) {
		if (ignoreError) {
			throw error;
		}
		console.error(`Error executing command: ${command}`);
		console.error(error.message);
		process.exit(1);
	}
}

function getLastTag() {
	try {
		return exec("git describe --tags --abbrev=0", { ignoreError: true });
	} catch {
		return null;
	}
}

/**
 * Commits since the last tag, newest first. Handles both squash merges
 * ("Title (#12)") and plain commits; skips release-chore and merge commits.
 */
function getCommitsSinceTag(tag) {
	const range = tag ? `${tag}..HEAD` : "HEAD";
	const output = exec(
		`git log ${range} --no-merges --first-parent --pretty=format:"%h%x09%s"`,
		{ ignoreError: true },
	);
	if (!output) return [];

	return output
		.split("\n")
		.map((line) => {
			const [hash, ...rest] = line.split("\t");
			return { hash: hash.trim(), subject: rest.join("\t").trim() };
		})
		.filter((c) => c.subject.length > 0)
		.filter((c) => !/^chore: release v?\d/i.test(c.subject))
		.map((c) => `${c.subject} (${c.hash})`);
}

function updateChangelog(newVersion) {
	const changelogPath = join(rootDir, "CHANGELOG.md");
	const lastTag = getLastTag();

	if (lastTag) {
		console.log(`Last tag found: ${lastTag}`);
	} else {
		console.log("No previous tag found, including all history");
	}

	const entries = getCommitsSinceTag(lastTag);

	if (entries.length === 0) {
		console.log(
			"⚠️  No commits found since last version. Skipping changelog update.",
		);
		return;
	}

	const date = new Date().toISOString().split("T")[0];
	let newEntry = `## [${newVersion}] - ${date}\n\n`;
	for (const entry of entries) {
		newEntry += `- ${entry}\n`;
	}
	newEntry += "\n";

	let existingChangelog = "";
	if (existsSync(changelogPath)) {
		existingChangelog = readFileSync(changelogPath, "utf8");
		existingChangelog = existingChangelog.replace(
			/^# Changelog\n\n(All notable changes[^\n]*\n\n)?/,
			"",
		);
	}

	const newChangelog = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n${newEntry}${existingChangelog}`;
	writeFileSync(changelogPath, newChangelog);

	console.log(
		`✓ Updated CHANGELOG.md with ${entries.length} commit${entries.length === 1 ? "" : "s"}`,
	);
}

function calculateNewVersion(currentVersion, type) {
	const [major, minor, patch] = currentVersion.split(".").map(Number);
	switch (type) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
		default:
			return currentVersion;
	}
}

/** Bump the version in every file that carries it. */
function writeVersion(newVersion) {
	// package.json (tab-indented, trailing newline - keep Biome happy)
	const packageJsonPath = join(rootDir, "package.json");
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	packageJson.version = newVersion;
	writeFileSync(
		packageJsonPath,
		`${JSON.stringify(packageJson, null, "\t")}\n`,
	);

	// src-tauri/tauri.conf.json
	const tauriConfPath = join(rootDir, "src-tauri", "tauri.conf.json");
	const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
	tauriConf.version = newVersion;
	writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, "\t")}\n`);

	// src-tauri/Cargo.toml - only the [package] version line (the first one)
	const cargoTomlPath = join(rootDir, "src-tauri", "Cargo.toml");
	const cargoToml = readFileSync(cargoTomlPath, "utf8");
	writeFileSync(
		cargoTomlPath,
		cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`),
	);

	// src-tauri/Cargo.lock - the speclens package entry, so the lockfile
	// doesn't churn on the next build
	const cargoLockPath = join(rootDir, "src-tauri", "Cargo.lock");
	if (existsSync(cargoLockPath)) {
		const cargoLock = readFileSync(cargoLockPath, "utf8");
		writeFileSync(
			cargoLockPath,
			cargoLock.replace(
				/(name = "speclens"\nversion = )"[^"]*"/,
				`$1"${newVersion}"`,
			),
		);
	}
}

function prompt(question) {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

async function promptReleaseType() {
	console.log("\n📦 Select release type:\n");
	console.log("  1. patch  - Bug fixes, dependency updates, docs (0.0.X)");
	console.log("  2. minor  - New features, backwards compatible (0.X.0)");
	console.log("  3. major  - Breaking changes (X.0.0)");
	console.log("");

	const answer = await prompt(
		"Enter your choice (1/2/3 or patch/minor/major): ",
	);
	const lower = answer.toLowerCase();

	if (answer === "1" || lower === "patch") return "patch";
	if (answer === "2" || lower === "minor") return "minor";
	if (answer === "3" || lower === "major") return "major";

	console.error("❌ Invalid choice. Please run the script again.");
	process.exit(1);
}

async function promptConfirmation(question) {
	const answer = await prompt(question);
	return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

async function main() {
	if (!versionType) {
		versionType = await promptReleaseType();
	}

	console.log(`\n🚀 Starting ${versionType} version bump...\n`);

	const packageJsonPath = join(rootDir, "package.json");
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	const oldVersion = packageJson.version;
	const newVersion = calculateNewVersion(oldVersion, versionType);

	console.log(`📦 Release Type: ${versionType.toUpperCase()}`);
	console.log(`📊 Current version: ${oldVersion}`);
	console.log(`📈 New version:     ${newVersion}`);
	console.log("");

	const confirmed = await promptConfirmation(
		`Do you want to proceed with this ${versionType} release? (y/N): `,
	);

	if (!confirmed) {
		console.log("\n❌ Version bump cancelled.\n");
		process.exit(0);
	}

	console.log(`\n✨ Bumping ${versionType} version...`);
	writeVersion(newVersion);
	console.log(`✅ Version updated: ${newVersion}`);

	console.log("\n📝 Updating CHANGELOG.md...");
	updateChangelog(newVersion);

	console.log(`\n✅ Version bump complete!`);
	console.log(`\nFiles updated:`);
	console.log(`  - package.json (${oldVersion} → ${newVersion})`);
	console.log(`  - src-tauri/tauri.conf.json`);
	console.log(`  - src-tauri/Cargo.toml + Cargo.lock`);
	console.log(`  - CHANGELOG.md`);
	console.log(`\n📋 Next steps:`);
	console.log(`  1. Review the changes: git diff`);
	console.log(`  2. Adjust CHANGELOG.md wording if needed`);
	console.log(
		`  3. Create a release branch: git checkout -b release/v${newVersion}`,
	);
	console.log(
		`  4. Commit: git add -A && git commit -m "chore: release v${newVersion}"`,
	);
	console.log(`  5. Push: git push origin release/v${newVersion}`);
	console.log(`  6. Open a PR to main`);
	console.log(
		`  7. Once merged, the release workflow builds, tags, and publishes automatically\n`,
	);
}

try {
	await main();
} catch (error) {
	console.error("\n❌ Error:", error.message);
	process.exit(1);
}
