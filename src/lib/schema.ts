import yaml from "js-yaml";

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
	if (glob.includes("..")) return null;
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
	return new RegExp(`^${pattern}$`);
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
): Record<string, string> {
	const documents: Record<string, string> = {};
	for (const artifact of schema.artifacts) {
		const re = globToRegex(artifact.generates);
		if (!re) continue;
		const matches: string[] = [];
		for (const path of files.keys()) if (re.test(path)) matches.push(path);
		if (matches.length === 0) continue;
		matches.sort();
		documents[artifact.id] = matches
			.map((p) => files.get(p) ?? "")
			.join("\n\n");
	}
	return documents;
}
