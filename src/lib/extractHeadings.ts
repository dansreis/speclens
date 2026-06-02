import GithubSlugger from "github-slugger";

export interface Heading {
	depth: number;
	text: string;
	slug: string;
}

const fence = /^\s*(```|~~~)/;
const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function extractHeadings(source: string): Heading[] {
	const slugger = new GithubSlugger();
	const out: Heading[] = [];
	let inFence = false;
	for (const line of source.split("\n")) {
		if (fence.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const match = heading.exec(line);
		if (!match) continue;
		const depth = match[1].length;
		const text = match[2].replace(/`/g, "").trim();
		out.push({ depth, text, slug: slugger.slug(text) });
	}
	return out;
}
