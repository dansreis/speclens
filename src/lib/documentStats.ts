import { extractHeadings } from "./extractHeadings";

const DEFAULT_WORDS_PER_MINUTE = 200;

export interface DocumentStats {
	words: number;
	characters: number;
	paragraphs: number;
	sentences: number;
	headings: number;
	readingTimeMinutes: number;
}

export function computeDocumentStats(
	source: string,
	wordsPerMinute: number = DEFAULT_WORDS_PER_MINUTE,
): DocumentStats {
	const words = source.trim().split(/\s+/).filter(Boolean).length;
	const characters = source.length;
	const paragraphs = source
		.split(/\n\s*\n+/)
		.filter((b) => b.trim().length > 0).length;
	const sentences = (source.match(/[.!?]+/g) ?? []).length;
	const headings = extractHeadings(source).length;
	const readingTimeMinutes = Math.max(1, Math.ceil(words / wordsPerMinute));

	return {
		words,
		characters,
		paragraphs,
		sentences,
		headings,
		readingTimeMinutes,
	};
}
