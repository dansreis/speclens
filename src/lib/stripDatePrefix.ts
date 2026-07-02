// Change slugs/names are commonly date-prefixed ("2026-06-15-add-search", or
// the title-cased "2026 06 15 add search") - dead weight on a cramped canvas
// label. Strip a leading YYYY-MM-DD-style prefix (any of - . or space as the
// separator) for display; the hover cards and sidebars keep the full value.
export function stripDatePrefix(value: string): string {
	const stripped = value.replace(/^\d{4}[-. ]\d{1,2}[-. ]\d{1,2}[-. ]+/, "");
	return stripped || value;
}
