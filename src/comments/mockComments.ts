import type { AppComment } from "../lib/comments";

export const mockComments: AppComment[] = [
	{
		id: "c1",
		author: "Daniel Reis",
		initials: "DR",
		timestamp: new Date("2026-06-02T10:30:00Z"),
		quote: "exact-substring is fine for the first pass",
		body: "Should we consider fuzzy matching here? Users will misspell their queries — particularly for capability names like 'theming'.",
		resolved: false,
		highlight: {
			text: "exact-substring is fine for the first pass",
			occurrence: 1,
			documentId: "add-search-bar/proposal",
		},
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
	// AdMedia (example6) comments — anchored into active changes.
	{
		id: "c6",
		author: "Mariana Tavares",
		initials: "MT",
		timestamp: new Date("2026-06-05T09:20:00Z"),
		quote:
			"rollups under multi-touch are not arithmetically comparable to historical last-click numbers",
		body: "Finance is going to push back hard on this — we publish quarterly ROAS comparisons externally. Can we keep last-click as a parallel rollup for at least two quarters, not one?",
		resolved: false,
		highlight: {
			text: "rollups under multi-touch are not arithmetically comparable to historical last-click numbers",
			occurrence: 1,
			documentId: "add-multi-touch-attribution/proposal",
		},
	},
	{
		id: "c7",
		author: "João Pereira",
		initials: "JP",
		timestamp: new Date("2026-06-03T14:45:00Z"),
		quote: "sixty-three active retailer tenants",
		body: "Worth flagging that the two enterprise pilots add ~40 more tenants by themselves. The per-tenant Flyway runner needs to handle 100+ schemas comfortably, not just 65.",
		resolved: false,
		highlight: {
			text: "sixty-three active retailer tenants",
			occurrence: 1,
			documentId: "migrate-tenant-isolation-to-schema-per-tenant/proposal",
		},
	},
	{
		id: "c8",
		author: "Sofia Mendes",
		initials: "SM",
		timestamp: new Date("2026-05-29T10:10:00Z"),
		body: "Great call on the HTML5 sandbox open question. Whatever we do here, it has to be done before we let any retailer flip auto-approval to default-on for HTML5.",
		resolved: false,
	},
];
