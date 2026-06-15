import { cacheDeleteRaw, cacheGetRaw, cacheSetRaw } from "./db";
import type { Repo } from "./repoLoader";

interface CachedEntry {
	signature: string;
	repo: Repo;
}

/**
 * Reads a cached repo by its source path. Returns null on miss or parse error.
 * Dates (createdAt/archivedAt) are revived here since JSON round-trip drops them.
 */
export async function cacheGet(path: string): Promise<CachedEntry | null> {
	const raw = await cacheGetRaw(path);
	if (!raw) return null;
	return { signature: raw.signature, repo: reviveRepoDates(raw.repo) };
}

export async function cacheSet(
	path: string,
	signature: string,
	repo: Repo,
): Promise<void> {
	try {
		await cacheSetRaw(path, signature, repo);
	} catch {
		// SQLite write failed - next cold start pays the full load cost again.
	}
}

export async function cacheDelete(path: string): Promise<void> {
	try {
		await cacheDeleteRaw(path);
	} catch {
		// no-op
	}
}

function reviveRepoDates(repo: Repo): Repo {
	return {
		...repo,
		changes: repo.changes.map((c) => ({
			...c,
			createdAt: c.createdAt ? new Date(c.createdAt) : null,
			archivedAt: c.archivedAt ? new Date(c.archivedAt) : null,
		})),
	};
}
