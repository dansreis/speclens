import type { PaletteMode } from "@mui/material";
import {
	commentsAll,
	kvGetAll,
	kvSet,
	pruneOrphanedRepoData,
	sourcesAll,
	sourcesReplaceAll,
} from "../lib/db";
import { useAppStore } from "./useAppStore";
import { hydrateCommentsFromRows, useCommentsStore } from "./useCommentsStore";

let bootstrapPromise: Promise<void> | null = null;

const KV_KEYS = [
	"themeMode",
	"sidebarCollapsed",
	"selectedRepoId",
	"markdownZoom",
	"highlightEars",
] as const;
type KvKey = (typeof KV_KEYS)[number];

function debounce<T extends unknown[]>(
	fn: (...args: T) => void,
	ms: number,
): (...args: T) => void {
	let timer: number | null = null;
	return (...args: T) => {
		if (timer !== null) clearTimeout(timer);
		timer = window.setTimeout(() => fn(...args), ms);
	};
}

export function bootstrap(): Promise<void> {
	if (bootstrapPromise) return bootstrapPromise;
	bootstrapPromise = (async () => {
		const [kv, sources, commentRows] = await Promise.all([
			kvGetAll(),
			sourcesAll(),
			commentsAll(),
		]);

		const patch: Partial<{
			themeMode: PaletteMode;
			sidebarCollapsed: boolean;
			selectedRepoId: string | null;
			markdownZoom: number;
			highlightEars: boolean;
		}> = {};
		if (kv.themeMode === "light" || kv.themeMode === "dark") {
			patch.themeMode = kv.themeMode;
		}
		if (typeof kv.sidebarCollapsed === "boolean") {
			patch.sidebarCollapsed = kv.sidebarCollapsed;
		}
		if (typeof kv.selectedRepoId === "string" || kv.selectedRepoId === null) {
			patch.selectedRepoId = kv.selectedRepoId as string | null;
		}
		if (typeof kv.markdownZoom === "number") {
			patch.markdownZoom = kv.markdownZoom;
		}
		if (typeof kv.highlightEars === "boolean") {
			patch.highlightEars = kv.highlightEars;
		}

		useAppStore.setState({
			...patch,
			repoSources: sources.map((s) => ({ path: s.path, missing: false })),
		});

		// Reconcile: a comment/cache row whose repo is no longer a source can only
		// exist from an incomplete removal. Drop those from the UI immediately and
		// prune the DB in the background so the tables stay self-consistent. A repo
		// that's merely unreachable stays in repo_sources (missing: true), so its
		// comments are preserved.
		const validPaths = new Set(sources.map((s) => s.path));
		const liveComments = commentRows.filter((c) => validPaths.has(c.repo_id));
		hydrateCommentsFromRows(liveComments);
		useCommentsStore.setState({ loaded: true });
		void pruneOrphanedRepoData(sources.map((s) => s.path));

		attachWriteThrough();
	})();
	return bootstrapPromise;
}

function attachWriteThrough(): void {
	const writeKv = (key: KvKey, value: unknown) => {
		void kvSet(key, value);
	};
	const writeKvDebounced = debounce(writeKv, 200);

	useAppStore.subscribe(
		(s) => s.themeMode,
		(v) => writeKv("themeMode", v),
	);
	useAppStore.subscribe(
		(s) => s.sidebarCollapsed,
		(v) => writeKv("sidebarCollapsed", v),
	);
	useAppStore.subscribe(
		(s) => s.selectedRepoId,
		(v) => writeKv("selectedRepoId", v),
	);
	useAppStore.subscribe(
		(s) => s.markdownZoom,
		(v) => writeKvDebounced("markdownZoom", v),
	);
	useAppStore.subscribe(
		(s) => s.highlightEars,
		(v) => writeKv("highlightEars", v),
	);

	useAppStore.subscribe(
		(s) => s.repoSources,
		(sources) => {
			// Guard against catastrophic wipes: an empty in-memory list can appear
			// transiently (store recreated by HMR, a mid-load reset) and must never
			// bulk-overwrite a populated source list. Removing the last repo persists
			// via removeRepoSource's explicit sourcesDelete instead.
			if (sources.length === 0) return;
			void sourcesReplaceAll(
				sources.map((s, i) => ({
					path: s.path,
					missing: s.missing,
					position: i,
				})),
			);
		},
	);
}
