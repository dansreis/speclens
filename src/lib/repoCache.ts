import type { Repo } from "./exampleLoader";

const PREFIX = "speclens.repo-cache.";

interface CachedEntry {
	signature: string;
	repo: Repo;
}

/**
 * Reads a cached repo by its source path. Returns null if no cache entry
 * exists or the stored JSON can't be parsed (treated as a cold start).
 *
 * `Date` fields (`createdAt`/`archivedAt`) come back as strings after
 * JSON serialization round-trip; `reviveRepoDates` puts them back.
 */
export function cacheGet(path: string): CachedEntry | null {
	try {
		const raw = localStorage.getItem(PREFIX + path);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { signature: string; repo: Repo };
		return { signature: parsed.signature, repo: reviveRepoDates(parsed.repo) };
	} catch {
		return null;
	}
}

export function cacheSet(path: string, signature: string, repo: Repo): void {
	try {
		localStorage.setItem(PREFIX + path, JSON.stringify({ signature, repo }));
	} catch {
		// Quota exceeded, serialization failed, or storage disabled — silently
		// skip caching. The next cold start will pay the full load cost again,
		// but the app still works.
	}
}

export function cacheDelete(path: string): void {
	try {
		localStorage.removeItem(PREFIX + path);
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
