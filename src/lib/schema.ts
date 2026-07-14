import * as yaml from "js-yaml";

export interface Artifact {
	id: string;
	generates: string;
	description?: string;
	template?: string;
	instruction?: string;
	requires?: string[];
}

export interface OpenSpecSchema {
	name: string;
	version?: number;
	description?: string;
	artifacts: Artifact[];
	apply?: {
		requires?: string[];
		tracks?: string;
		instruction?: string;
	};
}

export interface OpenSpecConfig {
	schema?: string;
	context?: string;
	rules?: Record<string, unknown>;
}

export const DEFAULT_SCHEMA: OpenSpecSchema = {
	name: "spec-driven",
	version: 1,
	description: "Default OpenSpec spec-driven workflow",
	artifacts: [
		{
			id: "proposal",
			generates: "proposal.md",
			description: "Change proposal",
		},
		{
			id: "specs",
			generates: "specs/**/*.md",
			description: "Capability specs",
		},
		{
			id: "tasks",
			generates: "tasks.md",
			description: "Implementation checklist",
		},
	],
	apply: { tracks: "tasks.md" },
};

const LABEL_OVERRIDES: Record<string, string> = {
	adr: "ADR",
};

export function artifactLabel(id: string): string {
	if (LABEL_OVERRIDES[id]) return LABEL_OVERRIDES[id];
	return id.charAt(0).toUpperCase() + id.slice(1);
}

export function parseSchemaYaml(text: string): OpenSpecSchema | null {
	try {
		const obj = yaml.load(text) as OpenSpecSchema | null;
		if (!obj || typeof obj !== "object") return null;
		if (!Array.isArray(obj.artifacts)) return null;
		return obj;
	} catch {
		return null;
	}
}

export function parseConfigYaml(text: string): OpenSpecConfig | null {
	try {
		const obj = yaml.load(text) as OpenSpecConfig | null;
		if (!obj || typeof obj !== "object") return null;
		return obj;
	} catch {
		return null;
	}
}

const REGEX_SPECIAL = /[.+?^${}()|[\]\\]/;

export function globToRegex(glob: string): RegExp | null {
	let pattern = "";
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i];
		if (c === "*" && glob[i + 1] === "*") {
			pattern += ".*";
			i++;
		} else if (c === "*") {
			pattern += "[^/]*";
		} else if (REGEX_SPECIAL.test(c)) {
			pattern += `\\${c}`;
		} else {
			pattern += c;
		}
	}
	return new RegExp(`^${pattern}$`, "i");
}

/**
 * Splits an artifact's `generates` pattern into the file-map it should look in
 * (change-local or repo-root) and the remaining glob to match.
 *
 * Anything starting with `../` is treated as repo-root-scoped: leading `../`
 * segments are stripped (regardless of how many) and the rest matches against
 * the repo-root file map. This matches OpenSpec's intent - `<repo>/adr/*.md`
 * always means the repo's top-level `adr/`, regardless of how deep the change
 * folder sits.
 */
export function classifyGenerates(generates: string): {
	scope: "change" | "repo";
	pattern: string;
} {
	const segments = generates.split("/");
	let i = 0;
	while (i < segments.length && segments[i] === "..") i++;
	if (i === 0) return { scope: "change", pattern: generates };
	return { scope: "repo", pattern: segments.slice(i).join("/") };
}

export function isChecklistArtifact(
	artifact: Artifact,
	schema: OpenSpecSchema,
): boolean {
	const tracks = schema.apply?.tracks;
	if (!tracks) return artifact.id === "tasks";
	return artifact.generates === tracks;
}

export function resolveDocuments(
	schema: OpenSpecSchema,
	files: Map<string, string>,
	rootFiles?: Map<string, string>,
): Record<string, string> {
	const documents: Record<string, string> = {};
	for (const artifact of schema.artifacts) {
		const { scope, pattern } = classifyGenerates(artifact.generates);
		const re = globToRegex(pattern);
		if (!re) continue;
		const source = scope === "repo" ? rootFiles : files;
		if (!source) continue;
		const matches: string[] = [];
		for (const path of source.keys()) if (re.test(path)) matches.push(path);
		if (matches.length === 0) continue;
		matches.sort();
		documents[artifact.id] = matches
			.map((p) => source.get(p) ?? "")
			.join("\n\n");
	}
	return documents;
}

export interface DocumentFile {
	name: string;
	path: string;
	content: string;
}

function staticPrefix(glob: string): string {
	const star = glob.indexOf("*");
	if (star === -1) return glob;
	const slash = glob.lastIndexOf("/", star);
	return slash === -1 ? "" : glob.slice(0, slash + 1);
}

function deriveFileName(path: string, prefix: string): string {
	let rest = path.startsWith(prefix) ? path.slice(prefix.length) : path;
	rest = rest.replace(/\.md$/i, "");
	rest = rest.replace(/\/spec$/i, "");
	return rest || path;
}

export function resolveDocumentFiles(
	schema: OpenSpecSchema,
	files: Map<string, string>,
	rootFiles?: Map<string, string>,
): Record<string, DocumentFile[]> {
	const out: Record<string, DocumentFile[]> = {};
	for (const artifact of schema.artifacts) {
		const { scope, pattern } = classifyGenerates(artifact.generates);
		const re = globToRegex(pattern);
		if (!re) continue;
		const source = scope === "repo" ? rootFiles : files;
		if (!source) continue;
		const prefix = staticPrefix(pattern);
		const matches: string[] = [];
		for (const path of source.keys()) if (re.test(path)) matches.push(path);
		if (matches.length === 0) continue;
		matches.sort();
		out[artifact.id] = matches.map((p) => ({
			name: deriveFileName(p, prefix),
			path: p,
			content: source.get(p) ?? "",
		}));
	}
	return out;
}
