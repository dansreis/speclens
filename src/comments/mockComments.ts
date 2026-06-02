export interface MockComment {
	id: string;
	author: string;
	initials: string;
	timestamp: Date;
	body: string;
	quote?: string;
	resolved: boolean;
}

export const mockComments: MockComment[] = [
	{
		id: "c1",
		author: "Daniel Reis",
		initials: "DR",
		timestamp: new Date("2026-06-02T10:30:00Z"),
		quote: "exact-substring is fine for the first pass",
		body: "Should we consider fuzzy matching here? Users will misspell their queries — particularly for capability names like 'theming'.",
		resolved: false,
	},
	{
		id: "c2",
		author: "Anna Costa",
		initials: "AC",
		timestamp: new Date("2026-06-01T14:15:00Z"),
		body: "I think 150ms debounce is too aggressive. Let's start with 100ms and tune from there based on feel.",
		resolved: true,
	},
	{
		id: "c3",
		author: "Pedro Silva",
		initials: "PS",
		timestamp: new Date("2026-06-01T09:42:00Z"),
		quote:
			"Build an in-memory index of `{ kind, title, slug, path }` on app load",
		body: "What's the memory ceiling on this? For a repo with 200 capabilities we'd index ~600 items — should be fine but worth measuring once we have real data.",
		resolved: false,
	},
	{
		id: "c4",
		author: "Sofia Mendes",
		initials: "SM",
		timestamp: new Date("2026-05-30T16:08:00Z"),
		body: "Love the keyboard-first approach. One ask: please make the search dropdown render above any open modal — easy to forget about z-index here.",
		resolved: true,
	},
	{
		id: "c5",
		author: "Daniel Reis",
		initials: "DR",
		timestamp: new Date("2026-05-28T11:00:00Z"),
		body: "Tagging this as v0 scope. Fuzzy matching + body-search can land later when we know whether users actually need them.",
		resolved: false,
	},
];
