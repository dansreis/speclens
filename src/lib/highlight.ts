export interface HighlightTarget {
	text: string;
	occurrence: number;
}

const MARK_CLASS = "user-highlight";

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

function applyOne(container: HTMLElement, target: HighlightTarget): boolean {
	if (!target.text) return false;
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	let count = 0;
	let node = walker.nextNode() as Text | null;
	while (node) {
		const nodeText = node.textContent ?? "";
		let searchFrom = 0;
		while (searchFrom <= nodeText.length - target.text.length) {
			const idx = nodeText.indexOf(target.text, searchFrom);
			if (idx === -1) break;
			count++;
			if (count === target.occurrence) {
				const range = document.createRange();
				range.setStart(node, idx);
				range.setEnd(node, idx + target.text.length);
				try {
					const mark = document.createElement("mark");
					mark.className = MARK_CLASS;
					range.surroundContents(mark);
				} catch {
					return false;
				}
				return true;
			}
			searchFrom = idx + target.text.length;
		}
		node = walker.nextNode() as Text | null;
	}
	return false;
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
