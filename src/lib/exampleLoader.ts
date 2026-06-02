export interface Change {
	slug: string;
	name: string;
	archived: boolean;
	proposal: string | null;
	tasks: string | null;
	specs: Record<string, string>;
}

const files = import.meta.glob("/examples/openspec/changes/**/*.md", {
	eager: true,
	query: "?raw",
	import: "default",
}) as Record<string, string>;

interface ParsedPath {
	slug: string;
	archived: boolean;
	kind: "proposal" | "tasks" | "spec";
	capability?: string;
}

function parsePath(path: string): ParsedPath | null {
	const rel = path.replace("/examples/openspec/changes/", "");
	const parts = rel.split("/");
	const archived = parts[0] === "archive";
	if (archived) parts.shift();
	const slug = parts[0];
	if (!slug) return null;
	const rest = parts.slice(1);
	if (rest[0] === "proposal.md") return { slug, archived, kind: "proposal" };
	if (rest[0] === "tasks.md") return { slug, archived, kind: "tasks" };
	if (rest[0] === "specs" && rest[1] && rest[2] === "spec.md")
		return { slug, archived, kind: "spec", capability: rest[1] };
	return null;
}

function slugToName(slug: string): string {
	return slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function buildChanges(): Change[] {
	const map = new Map<string, Change>();
	for (const [path, content] of Object.entries(files)) {
		const parsed = parsePath(path);
		if (!parsed) continue;
		const key = `${parsed.archived ? "archive/" : ""}${parsed.slug}`;
		let change = map.get(key);
		if (!change) {
			change = {
				slug: parsed.slug,
				name: slugToName(parsed.slug),
				archived: parsed.archived,
				proposal: null,
				tasks: null,
				specs: {},
			};
			map.set(key, change);
		}
		if (parsed.kind === "proposal") change.proposal = content;
		else if (parsed.kind === "tasks") change.tasks = content;
		else if (parsed.kind === "spec" && parsed.capability)
			change.specs[parsed.capability] = content;
	}
	return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const changes: Change[] = buildChanges();
