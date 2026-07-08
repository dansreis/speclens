import type { PaletteMode } from "@mui/material";
import {
	commentsAll,
	kvGetAll,
	kvSet,
	pruneOrphanedRepoData,
	sourcesAll,
	sourcesReplaceAll,
} from "../lib/db";
import { type AppSettings, sanitizeSettings, useAppStore } from "./useAppStore";
import { hydrateCommentsFromRows, useCommentsStore } from "./useCommentsStore";

let bootstrapPromise: Promise<void> | null = null;

const KV_KEYS = [
	"themeMode",
	"sidebarCollapsed",
	"selectedRepoId",
	"markdownZoom",
	"highlightEars",
	"tutorialSeen",
	"settings",
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
			tutorialSeen: boolean;
			settings: AppSettings;
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
		if (typeof kv.tutorialSeen === "boolean") {
			patch.tutorialSeen = kv.tutorialSeen;
		}
		if (kv.settings !== undefined) {
			patch.settings = sanitizeSettings(kv.settings);
		}

		useAppStore.setState({
			...patch,
			repoSources: sources.map((s) => ({ path: s.path, missing: false })),
			// Enter the loading state up front (before the App effect kicks off
			// reloadAllSources) so the splash covers the gap with no flash of the
			// empty "no project" state. No sources → nothing to load.
			reposLoading: sources.length > 0,
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
	// Per-key debounce instances: sharing one timer across keys would let a
	// later key's write cancel an earlier key's pending write within the window.
	const writeZoomDebounced = debounce(
		(v: unknown) => writeKv("markdownZoom", v),
		200,
	);
	const writeSettingsDebounced = debounce(
		(v: unknown) => writeKv("settings", v),
		200,
	);

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
		(v) => writeZoomDebounced(v),
	);
	useAppStore.subscribe(
		(s) => s.highlightEars,
		(v) => writeKv("highlightEars", v),
	);
	useAppStore.subscribe(
		(s) => s.tutorialSeen,
		(v) => writeKv("tutorialSeen", v),
	);
	useAppStore.subscribe(
		(s) => s.settings,
		(v) => writeSettingsDebounced(v),
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
