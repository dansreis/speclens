export interface DocumentDef {
	id: string;
	label: string;
	file?: string;
	directory?: string;
	join?: boolean;
	completion?: "checklist";
}

export interface ChangeSchema {
	documents: DocumentDef[];
}

export const DEFAULT_SCHEMA: ChangeSchema = {
	documents: [
		{ id: "proposal", file: "proposal.md", label: "Proposal" },
		{ id: "tasks", file: "tasks.md", label: "Tasks", completion: "checklist" },
		{ id: "specs", directory: "specs", label: "Specs", join: true },
	],
};
