import yaml from "js-yaml";
import {
	DEFAULT_SCHEMA,
	type OpenSpecConfig,
	type OpenSpecSchema,
	parseConfigYaml,
	parseSchemaYaml,
	resolveDocuments,
} from "./schema";

interface ChangeConfig {
	schema?: string;
	created?: string;
}

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
	schema: OpenSpecSchema;
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
	schema: OpenSpecSchema;
	config: OpenSpecConfig | null;
	configYaml: string | null;
	schemaYaml: string | null;
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

const openspecConfigFiles = import.meta.glob(
	"/examples/*/openspec/config.yaml",
	{ eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const schemaYamlFiles = import.meta.glob(
	"/examples/*/openspec/schemas/*/schema.yaml",
	{ eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const changeConfigFiles = import.meta.glob(
	"/examples/*/openspec/changes/**/.openspec.yaml",
	{ eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

function loadChangeConfigs(): Map<string, ChangeConfig> {
	const out = new Map<string, ChangeConfig>();
	for (const [path, text] of Object.entries(changeConfigFiles)) {
		const m = path.match(
			/^\/examples\/([^/]+)\/openspec\/changes\/(.+)\/\.openspec\.yaml$/,
		);
		if (!m) continue;
		const repoId = m[1];
		const parts = m[2].split("/");
		const archived = parts[0] === "archive";
		if (archived) parts.shift();
		const slug = parts[0];
		if (!slug) continue;
		try {
			const parsed = yaml.load(text) as ChangeConfig | null;
			if (!parsed || typeof parsed !== "object") continue;
			const key = `${repoId}::${archived ? "archive/" : ""}${slug}`;
			out.set(key, parsed);
		} catch {
			// skip malformed YAML
		}
	}
	return out;
}

interface ParsedPath {
	repoId: string;
	slug: string;
	archived: boolean;
	relPath: string;
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
	const relPath = parts.slice(1).join("/");
	if (!relPath) return null;
	return { repoId, slug, archived, relPath };
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
	files: Map<string, string>;
}

function deriveSpecs(files: Map<string, string>): Record<string, string> {
	const specs: Record<string, string> = {};
	for (const [path, content] of files) {
		const m = path.match(/^specs\/([^/]+)\/spec\.md$/);
		if (m) specs[m[1]] = content;
	}
	return specs;
}

interface RepoSchemaEntry {
	schema: OpenSpecSchema;
	yaml: string;
}

function loadRepoSchemas(): Map<string, Map<string, RepoSchemaEntry>> {
	const byRepo = new Map<string, Map<string, RepoSchemaEntry>>();
	for (const [path, text] of Object.entries(schemaYamlFiles)) {
		const m = path.match(
			/^\/examples\/([^/]+)\/openspec\/schemas\/([^/]+)\/schema\.yaml$/,
		);
		if (!m) continue;
		const schema = parseSchemaYaml(text);
		if (!schema) continue;
		let map = byRepo.get(m[1]);
		if (!map) {
			map = new Map();
			byRepo.set(m[1], map);
		}
		map.set(m[2], { schema, yaml: text });
	}
	return byRepo;
}

interface ResolvedSchema {
	schema: OpenSpecSchema;
	config: OpenSpecConfig | null;
	configYaml: string | null;
	schemaYaml: string | null;
}

function resolveSchemaFor(
	repoId: string,
	repoSchemas: Map<string, Map<string, RepoSchemaEntry>>,
): ResolvedSchema {
	const configPath = `/examples/${repoId}/openspec/config.yaml`;
	const configYaml = openspecConfigFiles[configPath] ?? null;
	const config = configYaml ? parseConfigYaml(configYaml) : null;
	const name = config?.schema;
	const entry = name ? repoSchemas.get(repoId)?.get(name) : undefined;
	return {
		schema: entry?.schema ?? DEFAULT_SCHEMA,
		config,
		configYaml,
		schemaYaml: entry?.yaml ?? null,
	};
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
				files: new Map(),
			};
			changesMap.set(key, builder);
		}
		builder.files.set(parsed.relPath, content);
	}

	const repoSchemas = loadRepoSchemas();
	const changeConfigs = loadChangeConfigs();

	const out: Repo[] = [];
	for (const [path, config] of Object.entries(configFiles)) {
		const m = path.match(/^\/examples\/([^/]+)\/config\.json$/);
		if (!m) continue;
		const repoId = m[1];
		const resolved = resolveSchemaFor(repoId, repoSchemas);
		const builders = [...(changesByRepo.get(repoId)?.values() ?? [])].sort(
			(a, b) => a.name.localeCompare(b.name),
		);
		const changes: Change[] = builders.map((b) => {
			const cfgKey = `${repoId}::${b.archived ? "archive/" : ""}${b.slug}`;
			const cfg = changeConfigs.get(cfgKey);
			const overrideName = cfg?.schema;
			const overrideSchema = overrideName
				? repoSchemas.get(repoId)?.get(overrideName)?.schema
				: undefined;
			const changeSchema = overrideSchema ?? resolved.schema;
			const createdAt =
				cfg?.created && !Number.isNaN(Date.parse(cfg.created))
					? new Date(cfg.created)
					: b.createdAt;
			return {
				slug: b.slug,
				name: b.name,
				archived: b.archived,
				createdAt,
				archivedAt: b.archivedAt,
				schema: changeSchema,
				documents: resolveDocuments(changeSchema, b.files),
				specs: deriveSpecs(b.files),
				proposal: b.files.get("proposal.md") ?? null,
				tasks: b.files.get("tasks.md") ?? null,
			};
		});
		out.push({
			id: repoId,
			name: config.name,
			type: config.type,
			schema: resolved.schema,
			config: resolved.config,
			configYaml: resolved.configYaml,
			schemaYaml: resolved.schemaYaml,
			changes,
		});
	}

	return out.sort((a, b) => a.id.localeCompare(b.id));
}

export const repos: Repo[] = buildRepos();
