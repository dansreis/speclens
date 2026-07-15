export interface HighlightTarget {
	text: string;
	occurrence: number;
	/** Optional tag carried in the returned found-map (typically a commentId). */
	id?: string;
	/** Extra class(es) on the <mark>, e.g. spec-check severity styling. */
	className?: string;
}

const MARK_CLASS = "user-highlight";
const BLOCK_SEP = "\n\n";

const BLOCK_TAGS = new Set([
	"P",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"LI",
	"UL",
	"OL",
	"BLOCKQUOTE",
	"PRE",
	"TABLE",
	"TR",
	"TD",
	"TH",
	"DETAILS",
	"SUMMARY",
	"DIV",
	"ARTICLE",
	"SECTION",
	"HEADER",
	"FOOTER",
	"ASIDE",
	"MAIN",
	"NAV",
]);

export function highlightKey(target: HighlightTarget): string {
	return `${target.text}|${target.occurrence}`;
}

export function clearHighlights(container: HTMLElement): void {
	const marks = Array.from(
		container.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`),
	);
	for (const mark of marks) {
		try {
			const parent = mark.parentNode;
			if (!parent) continue;
			while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
			parent.removeChild(mark);
		} catch {
			// React may have detached the mark between our snapshot and this
			// step (mid-reconciliation). The next applyHighlights pass will
			// re-establish a consistent state.
		}
	}
	try {
		container.normalize();
	} catch {
		// no-op
	}
}

/**
 * Applies each target as a `<mark>` wrap. Returns a per-id map of whether the
 * target's text+occurrence was located in the container; ids only appear in the
 * map for targets that were passed with an `id`.
 */
export function applyHighlights(
	container: HTMLElement,
	targets: HighlightTarget[],
): Record<string, boolean> {
	clearHighlights(container);
	const found: Record<string, boolean> = {};
	for (const target of targets) {
		const ok = applyOne(container, target);
		if (target.id !== undefined) found[target.id] = ok;
	}
	return found;
}

interface Segment {
	node: Text;
	start: number;
	end: number;
	length: number;
}

function findBlockAncestor(node: Node, container: HTMLElement): HTMLElement {
	let current: HTMLElement | null = node.parentElement;
	while (current && current !== container) {
		if (BLOCK_TAGS.has(current.tagName)) return current;
		current = current.parentElement;
	}
	return container;
}

function collectSegments(container: HTMLElement): {
	segments: Segment[];
	flat: string;
} {
	const segments: Segment[] = [];
	const parts: string[] = [];
	let offset = 0;
	let prevBlock: HTMLElement | null = null;

	// Skip text inside rendered mermaid diagrams: wrapping <mark>s around SVG
	// text nodes would corrupt the diagram, and comments can't anchor there
	// anyway (MarkdownView blocks selections inside [data-mermaid]).
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) =>
			node.parentElement?.closest("[data-mermaid]")
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT,
	});
	let node = walker.nextNode() as Text | null;
	while (node) {
		const block = findBlockAncestor(node, container);
		if (prevBlock !== null && block !== prevBlock) {
			parts.push(BLOCK_SEP);
			offset += BLOCK_SEP.length;
		}
		const text = node.textContent ?? "";
		segments.push({
			node,
			start: offset,
			end: offset + text.length,
			length: text.length,
		});
		parts.push(text);
		offset += text.length;
		prevBlock = block;
		node = walker.nextNode() as Text | null;
	}
	return { segments, flat: parts.join("") };
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fuzzyPattern(text: string): RegExp {
	return new RegExp(escapeRegex(text).replace(/\s+/g, "\\s+"), "g");
}

function findMatchPosition(
	flat: string,
	text: string,
	occurrence: number,
): { start: number; end: number } | null {
	const re = fuzzyPattern(text);
	let count = 0;
	let m = re.exec(flat);
	while (m !== null) {
		count++;
		if (count === occurrence) {
			return { start: m.index, end: m.index + m[0].length };
		}
		if (m[0].length === 0) re.lastIndex++;
		m = re.exec(flat);
	}
	return null;
}

function isSoleTextChildOfEarsSpan(node: Text): boolean {
	const parent = node.parentElement;
	if (!parent) return false;
	if (!parent.classList.contains("ears-kw")) return false;
	return parent.childNodes.length === 1 && parent.firstChild === node;
}

interface Boundary {
	node: Node;
	offset: number;
}

function adjustStart(node: Text, offset: number): Boundary {
	if (offset !== 0 || !isSoleTextChildOfEarsSpan(node)) return { node, offset };
	const span = node.parentElement as HTMLElement;
	const parent = span.parentNode;
	if (!parent) return { node, offset };
	const index = Array.prototype.indexOf.call(parent.childNodes, span);
	return { node: parent, offset: index };
}

function adjustEnd(node: Text, offset: number, length: number): Boundary {
	if (offset !== length || !isSoleTextChildOfEarsSpan(node))
		return { node, offset };
	const span = node.parentElement as HTMLElement;
	const parent = span.parentNode;
	if (!parent) return { node, offset };
	const index = Array.prototype.indexOf.call(parent.childNodes, span);
	return { node: parent, offset: index + 1 };
}

interface Touched {
	seg: Segment;
	lStart: number;
	lEnd: number;
}

function applyOne(container: HTMLElement, target: HighlightTarget): boolean {
	if (!target.text) return false;
	const { segments, flat } = collectSegments(container);
	const pos = findMatchPosition(flat, target.text, target.occurrence);
	if (!pos) return false;

	const groups: Array<{ block: HTMLElement; touched: Touched[] }> = [];
	for (const seg of segments) {
		if (seg.end <= pos.start) continue;
		if (seg.start >= pos.end) break;
		const lStart = Math.max(0, pos.start - seg.start);
		const lEnd = Math.min(seg.length, pos.end - seg.start);
		if (lEnd <= lStart) continue;
		const block = findBlockAncestor(seg.node, container);
		let group = groups.find((g) => g.block === block);
		if (!group) {
			group = { block, touched: [] };
			groups.push(group);
		}
		group.touched.push({ seg, lStart, lEnd });
	}

	if (groups.length === 0) return false;

	const key = highlightKey(target);

	for (const group of groups) {
		const first = group.touched[0];
		const last = group.touched[group.touched.length - 1];
		const start = adjustStart(first.seg.node, first.lStart);
		const end = adjustEnd(last.seg.node, last.lEnd, last.seg.length);
		try {
			const range = document.createRange();
			range.setStart(start.node, start.offset);
			range.setEnd(end.node, end.offset);
			const fragment = range.extractContents();
			const mark = document.createElement("mark");
			mark.className = target.className
				? `${MARK_CLASS} ${target.className}`
				: MARK_CLASS;
			mark.dataset.highlightKey = key;
			mark.appendChild(fragment);
			range.insertNode(mark);
		} catch {
			// Skip this group if extraction fails.
		}
	}

	return true;
}

export function countOccurrenceBefore(
	container: HTMLElement,
	range: Range,
	text: string,
): number {
	const tmpRange = document.createRange();
	tmpRange.setStart(container, 0);
	tmpRange.setEnd(range.startContainer, range.startOffset);
	const before = tmpRange.toString();
	const re = fuzzyPattern(text);
	let count = 0;
	let m = re.exec(before);
	while (m !== null) {
		count++;
		if (m[0].length === 0) re.lastIndex++;
		m = re.exec(before);
	}
	return count + 1;
}
