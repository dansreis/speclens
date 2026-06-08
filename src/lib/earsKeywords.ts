// EARS (Easy Approach to Requirements Syntax) keywords + Gherkin scenario steps
// + RFC 2119 modal verbs. Matched only when uppercase and word-bounded.
const EARS_KEYWORDS = [
	"SHALL",
	"MUST",
	"SHOULD",
	"MAY",
	"WHEN",
	"WHILE",
	"WHERE",
	"IF",
	"THEN",
	"GIVEN",
	"AND",
] as const;

export type EarsKeyword = (typeof EARS_KEYWORDS)[number];

const EARS_REGEX = new RegExp(`\\b(${EARS_KEYWORDS.join("|")})\\b`, "g");

interface HastNode {
	type: string;
	tagName?: string;
	value?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
}

const SKIP_TAGS = new Set(["code", "pre", "kbd", "script", "style"]);

function splitText(value: string): HastNode[] | null {
	EARS_REGEX.lastIndex = 0;
	if (!EARS_REGEX.test(value)) return null;
	EARS_REGEX.lastIndex = 0;

	const out: HastNode[] = [];
	let last = 0;
	let match = EARS_REGEX.exec(value);
	while (match !== null) {
		if (match.index > last) {
			out.push({ type: "text", value: value.slice(last, match.index) });
		}
		const kw = match[1] as EarsKeyword;
		out.push({
			type: "element",
			tagName: "span",
			properties: { className: ["ears-kw", `ears-${kw.toLowerCase()}`] },
			children: [{ type: "text", value: kw }],
		});
		last = match.index + kw.length;
		match = EARS_REGEX.exec(value);
	}
	if (last < value.length) {
		out.push({ type: "text", value: value.slice(last) });
	}
	return out;
}

function walk(node: HastNode): void {
	const children = node.children;
	if (!children) return;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (child.type === "element") {
			if (child.tagName && SKIP_TAGS.has(child.tagName)) continue;
			walk(child);
		} else if (child.type === "text" && typeof child.value === "string") {
			const replacement = splitText(child.value);
			if (replacement) {
				children.splice(i, 1, ...replacement);
				i += replacement.length - 1;
			}
		}
	}
}

export function rehypeEarsKeywords() {
	return (tree: HastNode) => {
		walk(tree);
	};
}
