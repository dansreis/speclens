export interface Highlight {
	text: string;
	occurrence: number;
	documentId: string;
}

export interface AppComment {
	id: string;
	author: string;
	initials: string;
	timestamp: Date;
	body: string;
	quote?: string;
	resolved: boolean;
	highlight?: Highlight;
}
