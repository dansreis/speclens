export type DocumentKind =
	| "change"
	| "repo-spec"
	| "schema"
	| "folder-doc"
	| "root-file"
	| "repo";

export interface Highlight {
	text: string;
	occurrence: number;
}

export interface AppComment {
	id: string;
	repoId: string;
	documentKind: DocumentKind;
	documentId: string | null;
	headingSlug: string | null;
	body: string;
	quote: string | null;
	highlight: Highlight | null;
	author: string;
	initials: string;
	timestamp: Date;
	resolved: boolean;
	/** Derived, not persisted. True when the comment's location or highlight
	 * can no longer be resolved in the loaded repos. */
	orphan?: boolean;
}
