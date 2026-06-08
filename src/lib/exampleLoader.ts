import { type ChangeSchema, DEFAULT_SCHEMA } from "./schema";

export type RepoType = "private" | "organization" | "local";

export interface RepoConfig {
	name: string;
	type: RepoType;
}

export interface Change {
	slug: string;
	name: string;
	archived: boolean;
	createdAt: Date | null;
	archivedAt: Date | null;
	documents: Record<string, string>;
	specs: Record<string, string>;
	proposal: string | null;
	tasks: string | null;
}

interface MockTimestamps {
	createdAt: string;
	archivedAt?: string;
}

const mockTimestamps: Record<string, MockTimestamps> = {
	"add-search-bar": { createdAt: "2026-05-22T10:00:00Z" },
	"add-keyboard-shortcuts": { createdAt: "2026-05-10T14:30:00Z" },
	"init-spec-viewer": {
		createdAt: "2026-04-02T09:15:00Z",
		archivedAt: "2026-05-01T16:42:00Z",
	},
};

export interface Repo {
	id: string;
	name: string;
	type: RepoType;
	schema: ChangeSchema;
	changes: Change[];
}

const mdFiles = import.meta.glob("/examples/*/openspec/changes/**/*.md", {
	eager: true,
	query: "?raw",
	import: "default",
}) as Record<string, string>;

const configFiles = import.meta.glob("/examples/*/config.json", {
	eager: true,
	import: "default",
}) as Record<string, RepoConfig>;

const schemaFiles = import.meta.glob("/examples/*/openspec/schema.json", {
	eager: true,
	import: "default",
}) as Record<string, ChangeSchema>;

interface ParsedPath {
	repoId: string;
	slug: string;
	archived: boolean;
	kind: "rootFile" | "spec";
	fileName?: string;
	capability?: string;
}

function parsePath(path: string): ParsedPath | null {
	const m = path.match(/^\/examples\/([^/]+)\/openspec\/changes\/(.+)$/);
	if (!m) return null;
	const repoId = m[1];
	const parts = m[2].split("/");
	const archived = parts[0] === "archive";
	if (archived) parts.shift();
	const slug = parts[0];
	if (!slug) return null;
	const rest = parts.slice(1);
	if (rest.length === 1 && rest[0].endsWith(".md"))
		return { repoId, slug, archived, kind: "rootFile", fileName: rest[0] };
	if (rest[0] === "specs" && rest[1] && rest[2] === "spec.md")
		return { repoId, slug, archived, kind: "spec", capability: rest[1] };
	return null;
}

function slugToName(slug: string): string {
	return slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

interface ChangeBuilder {
	slug: string;
	name: string;
	archived: boolean;
	createdAt: Date | null;
	archivedAt: Date | null;
	rootFiles: Record<string, string>;
	specs: Record<string, string>;
}

function resolveDocuments(
	schema: ChangeSchema,
	rootFiles: Record<string, string>,
	specs: Record<string, string>,
): Record<string, string> {
	const documents: Record<string, string> = {};
	for (const doc of schema.documents) {
		if (doc.file) {
			const content = rootFiles[doc.file];
			if (content) documents[doc.id] = content;
			continue;
		}
		if (doc.directory && doc.join) {
			const keys = Object.keys(specs).sort();
			if (keys.length === 0) continue;
			documents[doc.id] = keys.map((k) => specs[k]).join("\n\n");
		}
	}
	return documents;
}

function buildRepos(): Repo[] {
	const changesByRepo = new Map<string, Map<string, ChangeBuilder>>();

	for (const [path, content] of Object.entries(mdFiles)) {
		const parsed = parsePath(path);
		if (!parsed) continue;
		let changesMap = changesByRepo.get(parsed.repoId);
		if (!changesMap) {
			changesMap = new Map();
			changesByRepo.set(parsed.repoId, changesMap);
		}
		const key = `${parsed.archived ? "archive/" : ""}${parsed.slug}`;
		let builder = changesMap.get(key);
		if (!builder) {
			const ts = mockTimestamps[parsed.slug];
			builder = {
				slug: parsed.slug,
				name: slugToName(parsed.slug),
				archived: parsed.archived,
				createdAt: ts ? new Date(ts.createdAt) : null,
				archivedAt: ts?.archivedAt ? new Date(ts.archivedAt) : null,
				rootFiles: {},
				specs: {},
			};
			changesMap.set(key, builder);
		}
		if (parsed.kind === "rootFile" && parsed.fileName)
			builder.rootFiles[parsed.fileName] = content;
		else if (parsed.kind === "spec" && parsed.capability)
			builder.specs[parsed.capability] = content;
	}

	const schemaByRepo = new Map<string, ChangeSchema>();
	for (const [path, schema] of Object.entries(schemaFiles)) {
		const m = path.match(/^\/examples\/([^/]+)\/openspec\/schema\.json$/);
		if (!m) continue;
		schemaByRepo.set(m[1], schema);
	}

	const out: Repo[] = [];
	for (const [path, config] of Object.entries(configFiles)) {
		const m = path.match(/^\/examples\/([^/]+)\/config\.json$/);
		if (!m) continue;
		const repoId = m[1];
		const schema = schemaByRepo.get(repoId) ?? DEFAULT_SCHEMA;
		const builders = [...(changesByRepo.get(repoId)?.values() ?? [])].sort(
			(a, b) => a.name.localeCompare(b.name),
		);
		const changes: Change[] = builders.map((b) => ({
			slug: b.slug,
			name: b.name,
			archived: b.archived,
			createdAt: b.createdAt,
			archivedAt: b.archivedAt,
			documents: resolveDocuments(schema, b.rootFiles, b.specs),
			specs: b.specs,
			proposal: b.rootFiles["proposal.md"] ?? null,
			tasks: b.rootFiles["tasks.md"] ?? null,
		}));
		out.push({
			id: repoId,
			name: config.name,
			type: config.type,
			schema,
			changes,
		});
	}

	return out.sort((a, b) => a.id.localeCompare(b.id));
}

export const repos: Repo[] = buildRepos();
