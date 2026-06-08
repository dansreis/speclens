export interface HighlightTarget {
	text: string;
	occurrence: number;
}

const MARK_CLASS = "user-highlight";

export function highlightKey(target: HighlightTarget): string {
	return `${target.text}|${target.occurrence}`;
}

export function clearHighlights(container: HTMLElement): void {
	const marks = Array.from(
		container.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`),
	);
	for (const mark of marks) {
		const parent = mark.parentNode;
		if (!parent) continue;
		while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
		parent.removeChild(mark);
	}
	container.normalize();
}

export function applyHighlights(
	container: HTMLElement,
	targets: HighlightTarget[],
): void {
	clearHighlights(container);
	for (const target of targets) applyOne(container, target);
}

interface Segment {
	node: Text;
	start: number;
	end: number;
	length: number;
}

function collectSegments(container: HTMLElement): {
	segments: Segment[];
	flat: string;
} {
	const segments: Segment[] = [];
	const parts: string[] = [];
	let offset = 0;
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode() as Text | null;
	while (node) {
		const text = node.textContent ?? "";
		segments.push({
			node,
			start: offset,
			end: offset + text.length,
			length: text.length,
		});
		parts.push(text);
		offset += text.length;
		node = walker.nextNode() as Text | null;
	}
	return { segments, flat: parts.join("") };
}

function applyOne(container: HTMLElement, target: HighlightTarget): boolean {
	if (!target.text) return false;
	const { segments, flat } = collectSegments(container);

	let count = 0;
	let matchStart = -1;
	let idx = flat.indexOf(target.text);
	while (idx !== -1) {
		count++;
		if (count === target.occurrence) {
			matchStart = idx;
			break;
		}
		idx = flat.indexOf(target.text, idx + target.text.length);
	}
	if (matchStart === -1) return false;

	const matchEnd = matchStart + target.text.length;
	const key = highlightKey(target);

	for (const seg of segments) {
		if (seg.end <= matchStart) continue;
		if (seg.start >= matchEnd) break;
		const localStart = Math.max(0, matchStart - seg.start);
		const localEnd = Math.min(seg.length, matchEnd - seg.start);
		if (localEnd <= localStart) continue;
		try {
			const range = document.createRange();
			range.setStart(seg.node, localStart);
			range.setEnd(seg.node, localEnd);
			const mark = document.createElement("mark");
			mark.className = MARK_CLASS;
			mark.dataset.highlightKey = key;
			range.surroundContents(mark);
		} catch {
			// Skip this segment if surroundContents rejects it; other segments still wrap.
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
	let count = 0;
	let idx = before.indexOf(text);
	while (idx !== -1) {
		count++;
		idx = before.indexOf(text, idx + text.length);
	}
	return count + 1;
}
