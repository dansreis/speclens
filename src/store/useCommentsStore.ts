import { create } from "zustand";
import type { AppComment, DocumentKind, Highlight } from "../lib/comments";
import {
	type CommentRow,
	commentsDelete,
	commentsDeleteByRepo,
	commentsInsert,
	commentsSetResolved,
} from "../lib/db";

export interface AddCommentInput {
	repoId: string;
	documentKind: DocumentKind;
	documentId: string | null;
	headingSlug?: string | null;
	body: string;
	quote?: string | null;
	highlight?: Highlight | null;
	author?: string;
	initials?: string;
}

interface CommentsState {
	comments: AppComment[];
	loaded: boolean;
	/** Per-comment orphan flag from highlight rendering (commentId → orphan?). */
	highlightOrphans: Record<string, boolean>;
	/** Comment ids whose (documentKind, documentId) doesn't resolve in any loaded repo. */
	documentOrphans: Record<string, boolean>;
	addComment: (input: AddCommentInput) => Promise<AppComment>;
	deleteComment: (id: string) => Promise<void>;
	toggleResolved: (id: string) => Promise<void>;
	deleteCommentsForRepo: (repoId: string) => Promise<void>;
	countForRepo: (repoId: string) => number;
	setHighlightOrphans: (
		patch: Record<string, boolean>,
		scope: { repoId: string; documentId: string },
	) => void;
	setDocumentOrphans: (orphans: Record<string, boolean>) => void;
}

function newId(): string {
	return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowToComment(row: CommentRow): AppComment {
	const highlight: Highlight | null =
		row.highlight_text !== null && row.highlight_occurrence !== null
			? { text: row.highlight_text, occurrence: row.highlight_occurrence }
			: null;
	return {
		id: row.id,
		repoId: row.repo_id,
		documentKind: row.document_kind as DocumentKind,
		documentId: row.document_id,
		headingSlug: row.heading_slug,
		body: row.body,
		quote: row.quote,
		highlight,
		author: row.author,
		initials: row.initials,
		timestamp: new Date(row.created_at),
		resolved: !!row.resolved,
	};
}

function commentToRow(c: AppComment): CommentRow {
	return {
		id: c.id,
		repo_id: c.repoId,
		document_kind: c.documentKind,
		document_id: c.documentId,
		heading_slug: c.headingSlug,
		body: c.body,
		quote: c.quote,
		highlight_text: c.highlight?.text ?? null,
		highlight_occurrence: c.highlight?.occurrence ?? null,
		author: c.author,
		initials: c.initials,
		created_at: c.timestamp.toISOString(),
		resolved: c.resolved ? 1 : 0,
	};
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
	comments: [],
	loaded: false,
	highlightOrphans: {},
	documentOrphans: {},

	addComment: async (input) => {
		const comment: AppComment = {
			id: newId(),
			repoId: input.repoId,
			documentKind: input.documentKind,
			documentId: input.documentId,
			headingSlug: input.headingSlug ?? null,
			body: input.body,
			quote: input.quote ?? input.highlight?.text ?? null,
			highlight: input.highlight ?? null,
			author: input.author ?? "You",
			initials: input.initials ?? "Y",
			timestamp: new Date(),
			resolved: false,
		};
		await commentsInsert(commentToRow(comment));
		set((state) => ({ comments: [comment, ...state.comments] }));
		return comment;
	},

	deleteComment: async (id) => {
		await commentsDelete(id);
		set((state) => ({
			comments: state.comments.filter((c) => c.id !== id),
		}));
	},

	toggleResolved: async (id) => {
		const current = get().comments.find((c) => c.id === id);
		if (!current) return;
		const next = !current.resolved;
		await commentsSetResolved(id, next);
		set((state) => ({
			comments: state.comments.map((c) =>
				c.id === id ? { ...c, resolved: next } : c,
			),
		}));
	},

	deleteCommentsForRepo: async (repoId) => {
		await commentsDeleteByRepo(repoId);
		set((state) => ({
			comments: state.comments.filter((c) => c.repoId !== repoId),
		}));
	},

	countForRepo: (repoId) =>
		get().comments.filter((c) => c.repoId === repoId).length,

	setHighlightOrphans: (patch, scope) => {
		set((state) => {
			// Replace only the entries for comments matching the (repoId, documentId)
			// of this rendering pass; preserve unrelated entries from other views.
			const next = { ...state.highlightOrphans };
			for (const c of state.comments) {
				if (
					c.repoId === scope.repoId &&
					c.documentId === scope.documentId &&
					c.highlight
				) {
					if (c.id in patch) {
						next[c.id] = patch[c.id];
					} else {
						delete next[c.id];
					}
				}
			}
			return { highlightOrphans: next };
		});
	},

	setDocumentOrphans: (orphans) => set({ documentOrphans: orphans }),
}));

/** Apply orphan flags as a derived view on top of the stored comments. */
export function withOrphans(
	comments: AppComment[],
	highlightOrphans: Record<string, boolean>,
	documentOrphans: Record<string, boolean>,
): AppComment[] {
	return comments.map((c) => {
		const orphan =
			documentOrphans[c.id] === true || highlightOrphans[c.id] === true;
		return orphan ? { ...c, orphan: true } : c;
	});
}

export function hydrateCommentsFromRows(rows: CommentRow[]): void {
	useCommentsStore.setState({
		comments: rows.map(rowToComment),
		loaded: true,
	});
}
