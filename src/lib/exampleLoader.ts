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
	proposal: string | null;
	tasks: string | null;
	specs: Record<string, string>;
}

const mockTimestamps: Record<string, string> = {
	"add-search-bar": "2026-05-22T10:00:00Z",
	"add-keyboard-shortcuts": "2026-05-10T14:30:00Z",
	"init-spec-viewer": "2026-04-02T09:15:00Z",
};

export interface Repo {
	id: string;
	name: string;
	type: RepoType;
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

interface ParsedPath {
	repoId: string;
	slug: string;
	archived: boolean;
	kind: "proposal" | "tasks" | "spec";
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
	if (rest[0] === "proposal.md")
		return { repoId, slug, archived, kind: "proposal" };
	if (rest[0] === "tasks.md") return { repoId, slug, archived, kind: "tasks" };
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

function buildRepos(): Repo[] {
	const changesByRepo = new Map<string, Map<string, Change>>();

	for (const [path, content] of Object.entries(mdFiles)) {
		const parsed = parsePath(path);
		if (!parsed) continue;
		let changesMap = changesByRepo.get(parsed.repoId);
		if (!changesMap) {
			changesMap = new Map();
			changesByRepo.set(parsed.repoId, changesMap);
		}
		const key = `${parsed.archived ? "archive/" : ""}${parsed.slug}`;
		let change = changesMap.get(key);
		if (!change) {
			const ts = mockTimestamps[parsed.slug];
			change = {
				slug: parsed.slug,
				name: slugToName(parsed.slug),
				archived: parsed.archived,
				createdAt: ts ? new Date(ts) : null,
				proposal: null,
				tasks: null,
				specs: {},
			};
			changesMap.set(key, change);
		}
		if (parsed.kind === "proposal") change.proposal = content;
		else if (parsed.kind === "tasks") change.tasks = content;
		else if (parsed.kind === "spec" && parsed.capability)
			change.specs[parsed.capability] = content;
	}

	const out: Repo[] = [];
	for (const [path, config] of Object.entries(configFiles)) {
		const m = path.match(/^\/examples\/([^/]+)\/config\.json$/);
		if (!m) continue;
		const repoId = m[1];
		const changes = [...(changesByRepo.get(repoId)?.values() ?? [])].sort(
			(a, b) => a.name.localeCompare(b.name),
		);
		out.push({
			id: repoId,
			name: config.name,
			type: config.type,
			changes,
		});
	}

	return out.sort((a, b) => a.id.localeCompare(b.id));
}

export const repos: Repo[] = buildRepos();
