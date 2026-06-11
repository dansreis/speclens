import yaml from "js-yaml";
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

interface ChangeConfig {
	schema?: string;
	created?: string;
}

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
	// Keyed by path relative to the change folder root, e.g. "proposal.md"
	// or "specs/search/spec.md" — matches DocumentFile.path.
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

interface MockTimestamps {
	createdAt: string;
	archivedAt?: string;
}

const mockTimestamps: Record<string, MockTimestamps> = {
	// AdMedia (example6) — active changes
	"add-multi-touch-attribution": { createdAt: "2026-05-22T11:00:00Z" },
	"migrate-tenant-isolation-to-schema-per-tenant": {
		createdAt: "2026-05-18T09:30:00Z",
	},
	"deprecate-legacy-impression-pixel": {
		createdAt: "2026-04-22T15:40:00Z",
	},
	"rename-stop-overspend-requirement": {
		createdAt: "2026-05-30T13:10:00Z",
	},
	"add-budget-pacing-v2-smoothing": { createdAt: "2026-04-30T10:00:00Z" },
	"add-fraud-shadow-mode": { createdAt: "2026-05-08T14:20:00Z" },
	"introduce-roas-forecasting": { createdAt: "2026-06-08T09:00:00Z" },
	"add-self-service-creative-upload": {
		createdAt: "2026-05-05T11:45:00Z",
	},
	// AdMedia (example6) — archived changes
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
	"add-prescription-pacing-v2-smoothing": {
		createdAt: "2026-04-30T10:00:00Z",
	},
	"add-duplicate-order-shadow-mode": { createdAt: "2026-05-08T14:20:00Z" },
	"add-multi-provider-attribution": { createdAt: "2026-05-22T11:00:00Z" },
	"add-self-service-document-upload": {
		createdAt: "2026-05-05T11:45:00Z",
	},
	"add-webhook-signing-rotation": { createdAt: "2026-05-20T09:10:00Z" },
	"introduce-readmission-risk-forecasting": {
		createdAt: "2026-06-08T09:00:00Z",
	},
	"deprecate-legacy-encounter-pixel": {
		createdAt: "2026-04-22T15:40:00Z",
	},
	"rename-stop-overdispense-requirement": {
		createdAt: "2026-05-30T13:10:00Z",
	},
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

const mdFiles = import.meta.glob("/examples/*/**/*.md", {
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

interface HistoryFile {
	changes: Record<string, ChangeAuthorship>;
}

const historyFiles = import.meta.glob("/examples/*/history.json", {
	eager: true,
	import: "default",
}) as Record<string, HistoryFile>;

function loadHistoryByRepo(): Map<string, Record<string, ChangeAuthorship>> {
	const out = new Map<string, Record<string, ChangeAuthorship>>();
	for (const [path, json] of Object.entries(historyFiles)) {
		const m = path.match(/^\/examples\/([^/]+)\/history\.json$/);
		if (!m) continue;
		out.set(m[1], json?.changes ?? {});
	}
	return out;
}

interface ChangeConfigEntry {
	parsed: ChangeConfig;
	raw: string;
}

function loadChangeConfigs(): Map<string, ChangeConfigEntry> {
	const out = new Map<string, ChangeConfigEntry>();
	for (const [path, text] of Object.entries(changeConfigFiles)) {
		const m = path.match(
			/^\/examples\/([^/]+)\/openspec\/changes\/(.+)\/\.openspec\.yaml$/,
		);
		if (!m) continue;
		const repoId = m[1];
		const parts = m[2].split("/");
		const archived = parts[0].toLowerCase() === "archive";
		if (archived) parts.shift();
		const slug = parts[0];
		if (!slug) continue;
		try {
			const parsed = yaml.load(text) as ChangeConfig | null;
			if (!parsed || typeof parsed !== "object") continue;
			const key = `${repoId}::${archived ? "archive/" : ""}${slug}`;
			out.set(key, { parsed, raw: text });
		} catch {
			// skip malformed YAML
		}
	}
	return out;
}

interface ParsedChangePath {
	scope: "change";
	repoId: string;
	slug: string;
	archived: boolean;
	relPath: string;
}

interface ParsedRepoPath {
	scope: "repo";
	repoId: string;
	relPath: string;
}

type ParsedPath = ParsedChangePath | ParsedRepoPath;

function parsePath(path: string): ParsedPath | null {
	const repoMatch = path.match(/^\/examples\/([^/]+)\/(.+)$/);
	if (!repoMatch) return null;
	const repoId = repoMatch[1];
	const rest = repoMatch[2];
	const changeMatch = rest.match(/^openspec\/changes\/(.+)$/);
	if (changeMatch) {
		const parts = changeMatch[1].split("/");
		const archived = parts[0].toLowerCase() === "archive";
		if (archived) parts.shift();
		const slug = parts[0];
		if (!slug) return null;
		const relPath = parts.slice(1).join("/");
		if (!relPath) return null;
		return { scope: "change", repoId, slug, archived, relPath };
	}
	if (rest.startsWith("openspec/")) return null;
	return { scope: "repo", repoId, relPath: rest };
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
	const rootFilesByRepo = new Map<string, Map<string, string>>();

	for (const [path, content] of Object.entries(mdFiles)) {
		const parsed = parsePath(path);
		if (!parsed) continue;
		if (parsed.scope === "repo") {
			let map = rootFilesByRepo.get(parsed.repoId);
			if (!map) {
				map = new Map();
				rootFilesByRepo.set(parsed.repoId, map);
			}
			map.set(parsed.relPath, content);
			continue;
		}
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
	const historyByRepo = loadHistoryByRepo();

	const out: Repo[] = [];
	for (const [path, config] of Object.entries(configFiles)) {
		const m = path.match(/^\/examples\/([^/]+)\/config\.json$/);
		if (!m) continue;
		const repoId = m[1];
		const resolved = resolveSchemaFor(repoId, repoSchemas);
		const rootFiles = rootFilesByRepo.get(repoId) ?? new Map<string, string>();
		const builders = [...(changesByRepo.get(repoId)?.values() ?? [])].sort(
			(a, b) => a.name.localeCompare(b.name),
		);
		const repoHistory = historyByRepo.get(repoId) ?? {};
		const changes: Change[] = builders.map((b) => {
			const cfgKey = `${repoId}::${b.archived ? "archive/" : ""}${b.slug}`;
			const cfgEntry = changeConfigs.get(cfgKey);
			const cfg = cfgEntry?.parsed;
			const overrideName = cfg?.schema;
			const overrideEntry = overrideName
				? repoSchemas.get(repoId)?.get(overrideName)
				: undefined;
			const changeSchema = overrideEntry?.schema ?? resolved.schema;
			const changeSchemaYaml = overrideEntry?.yaml ?? resolved.schemaYaml;
			const createdAt =
				cfg?.created && !Number.isNaN(Date.parse(cfg.created))
					? new Date(cfg.created)
					: b.createdAt;
			const historyKey = `${b.archived ? "archive/" : ""}${b.slug}`;
			return {
				slug: b.slug,
				name: b.name,
				archived: b.archived,
				createdAt,
				archivedAt: b.archivedAt,
				schema: changeSchema,
				configYaml: cfgEntry?.raw ?? null,
				schemaYaml: changeSchemaYaml,
				documents: resolveDocuments(changeSchema, b.files, rootFiles),
				documentFiles: resolveDocumentFiles(changeSchema, b.files, rootFiles),
				specs: deriveSpecs(b.files),
				proposal: findFileIgnoreCase(b.files, "proposal.md"),
				tasks: findFileIgnoreCase(b.files, "tasks.md"),
				authorship: repoHistory[historyKey] ?? null,
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
