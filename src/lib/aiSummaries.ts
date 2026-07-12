import { aiSummaryDeleteRaw, aiSummaryGetRaw, aiSummarySetRaw } from "./db";

export interface CachedAiSummary {
	/** Repo signature at generation time; drift means the summary is stale. */
	signature: string;
	modelId: string;
	/** The generated summary markdown. */
	summary: string;
	createdAt: Date;
}

/**
 * Reads the cached AI summary for a repo source path. Returns null on miss
 * or read error - the card just shows the "Generate" state again.
 */
export async function aiSummaryGet(
	path: string,
): Promise<CachedAiSummary | null> {
	try {
		const raw = await aiSummaryGetRaw(path);
		if (!raw) return null;
		return {
			signature: raw.signature,
			modelId: raw.model_id,
			summary: raw.summary,
			createdAt: new Date(raw.created_at),
		};
	} catch {
		return null;
	}
}

export async function aiSummarySet(
	path: string,
	signature: string,
	modelId: string,
	summary: string,
): Promise<void> {
	try {
		await aiSummarySetRaw(path, signature, modelId, summary);
	} catch {
		// SQLite write failed - the summary just isn't cached this time.
	}
}

export async function aiSummaryDelete(path: string): Promise<void> {
	try {
		await aiSummaryDeleteRaw(path);
	} catch {
		// no-op
	}
}
