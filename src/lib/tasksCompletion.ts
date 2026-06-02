/**
 * Counts markdown task-list checkboxes outside of fenced code blocks.
 * `- [ ]` is open; `- [x]` (case-insensitive) is done. `* [X]` is also recognised.
 */
export function countTaskCompletion(markdown: string): {
	total: number;
	done: number;
} {
	const fence = /^\s*(```|~~~)/;
	const checkbox = /^\s*[-*]\s+\[([xX ])\]/;

	let total = 0;
	let done = 0;
	let inFence = false;

	for (const line of markdown.split("\n")) {
		if (fence.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const match = checkbox.exec(line);
		if (!match) continue;
		total += 1;
		if (match[1].toLowerCase() === "x") done += 1;
	}

	return { total, done };
}
