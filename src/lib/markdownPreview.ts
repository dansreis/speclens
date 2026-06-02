const fence = /^\s*(```|~~~)/;
const heading = /^\s*#/;
const listMark = /^[\s-*+]+/;

export function firstParagraphPreview(
	source: string | null,
	maxLength = 160,
): string {
	if (!source) return "";
	const paragraphs: string[] = [];
	let current: string[] = [];
	let inFence = false;
	for (const line of source.split("\n")) {
		if (fence.test(line)) {
			inFence = !inFence;
			if (current.length > 0) {
				paragraphs.push(current.join(" ").trim());
				current = [];
			}
			continue;
		}
		if (inFence) continue;
		if (line.trim() === "" || heading.test(line)) {
			if (current.length > 0) {
				paragraphs.push(current.join(" ").trim());
				current = [];
			}
			continue;
		}
		current.push(line.trim());
	}
	if (current.length > 0) paragraphs.push(current.join(" ").trim());
	const first = paragraphs.find((p) => p.length > 0) ?? "";
	const stripped = first
		.replace(listMark, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.trim();
	if (stripped.length <= maxLength) return stripped;
	return `${stripped.slice(0, maxLength).trimEnd()}…`;
}
