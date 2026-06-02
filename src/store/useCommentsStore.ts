import { create } from "zustand";
import { mockComments } from "../comments/mockComments";
import type { AppComment, Highlight } from "../lib/comments";

interface CommentsState {
	comments: AppComment[];
	addComment: (body: string, highlight: Highlight) => void;
	toggleResolved: (id: string) => void;
}

export const useCommentsStore = create<CommentsState>((set) => ({
	comments: mockComments,
	addComment: (body, highlight) =>
		set((state) => ({
			comments: [
				{
					id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					author: "You",
					initials: "Y",
					timestamp: new Date(),
					body,
					quote: highlight.text,
					resolved: false,
					highlight,
				},
				...state.comments,
			],
		})),
	toggleResolved: (id) =>
		set((state) => ({
			comments: state.comments.map((c) =>
				c.id === id ? { ...c, resolved: !c.resolved } : c,
			),
		})),
}));
