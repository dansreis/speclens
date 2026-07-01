import Database from "@tauri-apps/plugin-sql";
import type { Repo } from "./repoLoader";

const DB_PATH = "sqlite:speclens.sqlite";
const SCHEMA_VERSION = 1;

let dbPromise: Promise<Database> | null = null;

async function migrate(db: Database): Promise<void> {
	const rows = await db.select<{ user_version: number }[]>(
		"PRAGMA user_version",
	);
	const current = rows[0]?.user_version ?? 0;
	if (current >= SCHEMA_VERSION) return;

	if (current < 1) {
		await db.execute(`
			CREATE TABLE IF NOT EXISTS kv_state (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			);
		`);
		await db.execute(`
			CREATE TABLE IF NOT EXISTS repo_sources (
				path TEXT PRIMARY KEY,
				missing INTEGER NOT NULL DEFAULT 0,
				position INTEGER NOT NULL DEFAULT 0
			);
		`);
		await db.execute(`
			CREATE TABLE IF NOT EXISTS repo_cache (
				path TEXT PRIMARY KEY,
				signature TEXT NOT NULL,
				repo_json TEXT NOT NULL,
				cached_at TEXT NOT NULL
			);
		`);
		await db.execute(`
			CREATE TABLE IF NOT EXISTS comments (
				id TEXT PRIMARY KEY,
				repo_id TEXT NOT NULL,
				document_kind TEXT NOT NULL,
				document_id TEXT,
				body TEXT NOT NULL,
				quote TEXT,
				highlight_text TEXT,
				highlight_occurrence INTEGER,
				author TEXT NOT NULL,
				initials TEXT NOT NULL,
				created_at TEXT NOT NULL,
				resolved INTEGER NOT NULL DEFAULT 0
			);
		`);
		await db.execute(
			"CREATE INDEX IF NOT EXISTS comments_by_doc ON comments (repo_id, document_id);",
		);
		await db.execute(
			"CREATE INDEX IF NOT EXISTS comments_by_repo_resolved ON comments (repo_id, resolved);",
		);
	}

	await db.execute(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export async function getDb(): Promise<Database> {
	if (!dbPromise) {
		dbPromise = (async () => {
			const db = await Database.load(DB_PATH);
			await migrate(db);
			return db;
		})();
	}
	return dbPromise;
}

// ───── kv_state ─────

export async function kvGetAll(): Promise<Record<string, unknown>> {
	const db = await getDb();
	const rows = await db.select<{ key: string; value: string }[]>(
		"SELECT key, value FROM kv_state",
	);
	const out: Record<string, unknown> = {};
	for (const r of rows) {
		try {
			out[r.key] = JSON.parse(r.value);
		} catch {
			// Skip corrupted entries - they'll be overwritten on the next write.
		}
	}
	return out;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
	const db = await getDb();
	await db.execute(
		"INSERT INTO kv_state (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		[key, JSON.stringify(value)],
	);
}

// ponytail: serial chain so concurrent DELETE+INSERT batches can't interleave.
let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
	const result = writeChain.then(fn, fn);
	writeChain = result.catch(() => {});
	return result;
}

// ───── repo_sources ─────

export interface SourceRow {
	path: string;
	missing: boolean;
	position: number;
}

export async function sourcesAll(): Promise<SourceRow[]> {
	const db = await getDb();
	const rows = await db.select<
		{ path: string; missing: number; position: number }[]
	>("SELECT path, missing, position FROM repo_sources ORDER BY position ASC");
	return rows.map((r) => ({
		path: r.path,
		missing: !!r.missing,
		position: r.position,
	}));
}

export async function sourcesUpsert(
	path: string,
	missing: boolean,
	position: number,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT INTO repo_sources (path, missing, position) VALUES ($1, $2, $3)
		 ON CONFLICT(path) DO UPDATE SET missing = excluded.missing, position = excluded.position`,
		[path, missing ? 1 : 0, position],
	);
}

export async function sourcesDelete(path: string): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM repo_sources WHERE path = $1", [path]);
}

export async function sourcesReplaceAll(rows: SourceRow[]): Promise<void> {
	return serialize(async () => {
		const db = await getDb();
		await db.execute("BEGIN");
		try {
			await db.execute("DELETE FROM repo_sources");
			for (const r of rows) {
				await db.execute(
					"INSERT INTO repo_sources (path, missing, position) VALUES ($1, $2, $3)",
					[r.path, r.missing ? 1 : 0, r.position],
				);
			}
			await db.execute("COMMIT");
		} catch (e) {
			await db.execute("ROLLBACK").catch(() => {});
			throw e;
		}
	});
}

// ───── repo_cache ─────

interface CacheRow {
	signature: string;
	repo_json: string;
}

export async function cacheGetRaw(
	path: string,
): Promise<{ signature: string; repo: Repo } | null> {
	const db = await getDb();
	const rows = await db.select<CacheRow[]>(
		"SELECT signature, repo_json FROM repo_cache WHERE path = $1",
		[path],
	);
	if (!rows[0]) return null;
	try {
		const repo = JSON.parse(rows[0].repo_json) as Repo;
		return { signature: rows[0].signature, repo };
	} catch {
		return null;
	}
}

export async function cacheSetRaw(
	path: string,
	signature: string,
	repo: Repo,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT INTO repo_cache (path, signature, repo_json, cached_at) VALUES ($1, $2, $3, $4)
		 ON CONFLICT(path) DO UPDATE SET signature = excluded.signature, repo_json = excluded.repo_json, cached_at = excluded.cached_at`,
		[path, signature, JSON.stringify(repo), new Date().toISOString()],
	);
}

export async function cacheDeleteRaw(path: string): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM repo_cache WHERE path = $1", [path]);
}

// ───── comments ─────

export interface CommentRow {
	id: string;
	repo_id: string;
	document_kind: string;
	document_id: string | null;
	body: string;
	quote: string | null;
	highlight_text: string | null;
	highlight_occurrence: number | null;
	author: string;
	initials: string;
	created_at: string;
	resolved: number;
}

export async function commentsAll(): Promise<CommentRow[]> {
	const db = await getDb();
	return db.select<CommentRow[]>(
		"SELECT * FROM comments ORDER BY created_at DESC",
	);
}

export async function commentsInsert(row: CommentRow): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT INTO comments (
			id, repo_id, document_kind, document_id,
			body, quote, highlight_text, highlight_occurrence,
			author, initials, created_at, resolved
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		[
			row.id,
			row.repo_id,
			row.document_kind,
			row.document_id,
			row.body,
			row.quote,
			row.highlight_text,
			row.highlight_occurrence,
			row.author,
			row.initials,
			row.created_at,
			row.resolved,
		],
	);
}

export async function commentsSetResolved(
	id: string,
	resolved: boolean,
): Promise<void> {
	const db = await getDb();
	await db.execute("UPDATE comments SET resolved = $1 WHERE id = $2", [
		resolved ? 1 : 0,
		id,
	]);
}

export async function commentsDelete(id: string): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM comments WHERE id = $1", [id]);
}

export async function commentsDeleteByRepo(repoId: string): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM comments WHERE repo_id = $1", [repoId]);
}

export async function commentsCountByRepo(repoId: string): Promise<number> {
	const db = await getDb();
	const rows = await db.select<{ n: number }[]>(
		"SELECT COUNT(*) AS n FROM comments WHERE repo_id = $1",
		[repoId],
	);
	return rows[0]?.n ?? 0;
}

// ───── reconciliation / GC ─────

/**
 * Delete every `comments` and `repo_cache` row whose repo is not one of
 * `validPaths` (the current `repo_sources` list). Removing a repo already
 * cleans up its data, so anything else is dangling from an incomplete removal;
 * running this on startup keeps the three tables self-consistent. Returns how
 * many rows were pruned from each table.
 */
export async function pruneOrphanedRepoData(
	validPaths: string[],
): Promise<{ comments: number; cache: number }> {
	return serialize(async () => {
		const db = await getDb();
		const prune = async (table: string, column: string): Promise<number> => {
			let res: { rowsAffected: number };
			if (validPaths.length === 0) {
				res = await db.execute(`DELETE FROM ${table}`);
			} else {
				const placeholders = validPaths.map((_, i) => `$${i + 1}`).join(", ");
				res = await db.execute(
					`DELETE FROM ${table} WHERE ${column} NOT IN (${placeholders})`,
					validPaths,
				);
			}
			return res.rowsAffected;
		};
		const comments = await prune("comments", "repo_id");
		const cache = await prune("repo_cache", "path");
		return { comments, cache };
	});
}
