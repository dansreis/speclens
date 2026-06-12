import { invoke } from "@tauri-apps/api/core";
import {
	DEFAULT_SCHEMA,
	type DocumentFile,
	type OpenSpecConfig,
	type OpenSpecSchema,
	parseConfigYaml,
	parseSchemaYaml,
	resolveDocumentFiles,
	resolveDocuments,
} from "./schema";

export type RepoType = "private" | "organization" | "local";

export interface RepoConfig {
	name: string;
	type: RepoType;
}

export interface Person {
	name: string;
	email: string;
}

export interface DocAuthorship {
	createdBy: Person;
	createdAt: string;
	lastEditedBy: Person;
	lastEditedAt: string;
	editCount: number;
}

export interface ChangeAuthorship {
	rolled: DocAuthorship;
	files: Record<string, DocAuthorship>;
}

export interface Change {
	slug: string;
	name: string;
	archived: boolean;
	createdAt: Date | null;
	archivedAt: Date | null;
	schema: OpenSpecSchema;
	configYaml: string | null;
	schemaYaml: string | null;
	documents: Record<string, string>;
	documentFiles: Record<string, DocumentFile[]>;
	specs: Record<string, string>;
	proposal: string | null;
	tasks: string | null;
	authorship: ChangeAuthorship | null;
}

export interface RepoFolderDoc {
	slug: string;
	name: string;
	/** Leading NNNN- if present (e.g. "0001" from "0001-foo.md"). */
	number: string | null;
	/** openspec/-stripped path, e.g. "playbooks/add-background-job.md" */
	path: string;
	content: string;
	authorship: DocAuthorship | null;
}

/** A top-level folder under openspec/ surfaced as a Library tab. Auto-discovered. */
export interface RepoFolder {
	/** Folder name as it appears under openspec/, e.g. "playbooks", "adr". */
	name: string;
	docs: RepoFolderDoc[];
}

export interface RepoSpecDoc {
	capability: string;
	content: string;
	path: string;
	authorship: DocAuthorship | null;
}

export interface RepoSchemaDoc {
	name: string;
	yaml: string;
	schema: OpenSpecSchema;
	path: string;
	authorship: DocAuthorship | null;
	isActive: boolean;
}

export interface Repo {
	id: string;
	name: string;
	type: RepoType;
	schema: OpenSpecSchema;
	config: OpenSpecConfig | null;
	configYaml: string | null;
	schemaYaml: string | null;
	changes: Change[];
	repoSpecs: RepoSpecDoc[];
	schemas: RepoSchemaDoc[];
	folders: RepoFolder[];
}

interface RepoPayload {
	id: string;
	files: Record<string, string>;
	authorship: Record<string, DocAuthorship>;
	changeRollups: Record<string, DocAuthorship>;
	signature: string;
}

/**
 * Loads a single repo from a folder on disk. The folder must contain an
 * `openspec/` subdirectory. Throws a string error from the Rust side if the
 * path doesn't exist, isn't a directory, or has no `openspec/`.
 */
export async function loadRepoFromPath(
	path: string,
): Promise<{ repo: Repo; signature: string }> {
	const payload = await invoke<RepoPayload>("load_repo", { path });
	return { repo: payloadToRepo(payload, path), signature: payload.signature };
}

/**
 * Fast signature fetch. No file content is read. Use to check whether a
 * cached repo entry is still valid before paying the full load cost.
 */
export async function getRepoSignature(path: string): Promise<string> {
	return await invoke<string>("repo_signature", { path });
}

function slugToName(slug: string): string {
	return slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function deriveSpecs(files: Map<string, string>): Record<string, string> {
	const specs: Record<string, string> = {};
	for (const [path, content] of files) {
		const m = path.match(/^specs\/([^/]+)\/spec\.md$/i);
		if (m) specs[m[1]] = content;
	}
	return specs;
}

function findFileIgnoreCase(
	files: Map<string, string>,
	name: string,
): string | null {
	const target = name.toLowerCase();
	for (const [path, content] of files) {
		if (path.toLowerCase() === target) return content;
	}
	return null;
}

interface ChangeFiles {
	slug: string;
	archived: boolean;
	files: Map<string, string>;
	relPathByFile: Map<string, string>;
}

function numberedSlug(slug: string): {
	number: string | null;
	rest: string;
} {
	const m = slug.match(/^(\d+)-(.*)$/);
	if (!m) return { number: null, rest: slug };
	return { number: m[1], rest: m[2] };
}

function payloadToRepo(payload: RepoPayload, sourcePath: string): Repo {
	const rootFiles = new Map<string, string>();
	const rootFileFullPaths = new Map<string, string>();
	const schemaYamlByName = new Map<
		string,
		{ yaml: string; schema: OpenSpecSchema; path: string }
	>();
	const changeBuckets = new Map<string, ChangeFiles>();
	let repoConfigYaml: string | null = null;

	for (const [path, content] of Object.entries(payload.files)) {
		if (path === "openspec/config.yaml") {
			repoConfigYaml = content;
			continue;
		}
		const schemaMatch = path.match(
			/^openspec\/schemas\/([^/]+)\/schema\.yaml$/i,
		);
		if (schemaMatch) {
			const parsed = parseSchemaYaml(content);
			if (parsed)
				schemaYamlByName.set(schemaMatch[1], {
					yaml: content,
					schema: parsed,
					path: path.slice("openspec/".length),
				});
			continue;
		}
		const changeMatch = path.match(/^openspec\/changes\/(.+)$/);
		if (changeMatch) {
			const parts = changeMatch[1].split("/");
			const archived = parts[0].toLowerCase() === "archive";
			if (archived) parts.shift();
			const slug = parts[0];
			if (!slug) continue;
			const rel = parts.slice(1).join("/");
			if (!rel) continue;
			const key = `${archived ? "archive/" : ""}${slug}`;
			let bucket = changeBuckets.get(key);
			if (!bucket) {
				bucket = {
					slug,
					archived,
					files: new Map(),
					relPathByFile: new Map(),
				};
				changeBuckets.set(key, bucket);
			}
			bucket.files.set(rel, content);
			bucket.relPathByFile.set(rel, path);
			continue;
		}
		// openspec/adr/*.md and any other top-level openspec content goes into
		// the repo-root map with the `openspec/` prefix stripped — schemas with
		// `../../../adr/*.md` style globs land here via classifyGenerates.
		if (path.startsWith("openspec/")) {
			const stripped = path.slice("openspec/".length);
			rootFiles.set(stripped, content);
			rootFileFullPaths.set(stripped, path);
		}
	}

	const config = repoConfigYaml ? parseConfigYaml(repoConfigYaml) : null;
	const schemaName = config?.schema;
	const schemaEntry = schemaName ? schemaYamlByName.get(schemaName) : undefined;
	const repoSchema = schemaEntry?.schema ?? DEFAULT_SCHEMA;
	const repoSchemaYaml = schemaEntry?.yaml ?? null;

	const buckets = [...changeBuckets.values()].sort((a, b) =>
		slugToName(a.slug).localeCompare(slugToName(b.slug)),
	);

	const changes: Change[] = buckets.map((bucket) => {
		const key = `${bucket.archived ? "archive/" : ""}${bucket.slug}`;
		const rollup = payload.changeRollups[key] ?? null;
		const fileAuthorship: Record<string, DocAuthorship> = {};
		for (const [rel, fullPath] of bucket.relPathByFile) {
			const a = payload.authorship[fullPath];
			if (a) fileAuthorship[rel] = a;
		}
		const authorship: ChangeAuthorship | null = rollup
			? { rolled: rollup, files: fileAuthorship }
			: null;
		const createdAt = rollup?.createdAt ? new Date(rollup.createdAt) : null;
		const archivedAt =
			bucket.archived && rollup?.lastEditedAt
				? new Date(rollup.lastEditedAt)
				: null;
		return {
			slug: bucket.slug,
			name: slugToName(bucket.slug),
			archived: bucket.archived,
			createdAt,
			archivedAt,
			schema: repoSchema,
			configYaml: null,
			schemaYaml: repoSchemaYaml,
			documents: resolveDocuments(repoSchema, bucket.files, rootFiles),
			documentFiles: resolveDocumentFiles(repoSchema, bucket.files, rootFiles),
			specs: deriveSpecs(bucket.files),
			proposal: findFileIgnoreCase(bucket.files, "proposal.md"),
			tasks: findFileIgnoreCase(bucket.files, "tasks.md"),
			authorship,
		};
	});

	const authorshipFor = (stripped: string): DocAuthorship | null => {
		const full = rootFileFullPaths.get(stripped);
		return full ? (payload.authorship[full] ?? null) : null;
	};

	const repoSpecs: RepoSpecDoc[] = [];
	// Discover Library folders: every top-level folder under openspec/ except
	// `specs/` (its own view, capability-keyed) and `schemas/` (own view, YAML +
	// artifacts) becomes a Library tab automatically. We don't hardcode which
	// folders exist — `playbooks/`, `adr/`, `daybooks/`, anything goes.
	const folderBuckets = new Map<string, RepoFolderDoc[]>();

	for (const [path, content] of rootFiles) {
		const repoSpecMatch = path.match(/^specs\/([^/]+)\/spec\.md$/i);
		if (repoSpecMatch) {
			repoSpecs.push({
				capability: repoSpecMatch[1],
				content,
				path,
				authorship: authorshipFor(path),
			});
			continue;
		}
		if (path.startsWith("specs/") || path.startsWith("schemas/")) continue;
		// Only surface markdown files in Library folders. Other extensions
		// (templates, READMEs in non-md form, configs) are skipped.
		const mdMatch = path.match(/^([^/]+)\/(.+)\.md$/i);
		if (!mdMatch) continue;
		const folderName = mdMatch[1];
		// Strip leading subdirs from the slug so `adr/0001-foo.md` slugs to
		// `0001-foo` but `playbooks/sub/foo.md` slugs to `sub/foo`.
		const fullSlug = mdMatch[2];
		const baseSlug = fullSlug.split("/").pop() ?? fullSlug;
		const { number, rest } = numberedSlug(baseSlug);
		const docs = folderBuckets.get(folderName) ?? [];
		docs.push({
			slug: fullSlug,
			number,
			name: slugToName(rest || baseSlug),
			path,
			content,
			authorship: authorshipFor(path),
		});
		folderBuckets.set(folderName, docs);
	}

	repoSpecs.sort((a, b) => a.capability.localeCompare(b.capability));
	const folders: RepoFolder[] = [...folderBuckets.entries()]
		.map(([name, docs]) => ({
			name,
			docs: docs.sort((a, b) => {
				const an = a.number ?? "";
				const bn = b.number ?? "";
				return an.localeCompare(bn) || a.slug.localeCompare(b.slug);
			}),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	const schemas: RepoSchemaDoc[] = [...schemaYamlByName.entries()]
		.map(([name, entry]) => ({
			name,
			yaml: entry.yaml,
			schema: entry.schema,
			path: entry.path,
			authorship: authorshipFor(entry.path),
			isActive: name === schemaName,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return {
		// `id` must be unique across the loaded set — use the full source path so
		// two folders with the same final segment don't collide on selectedRepoId.
		id: sourcePath,
		name: payload.id,
		type: "local",
		schema: repoSchema,
		config,
		configYaml: repoConfigYaml,
		schemaYaml: repoSchemaYaml,
		changes,
		repoSpecs,
		schemas,
		folders,
	};
}
