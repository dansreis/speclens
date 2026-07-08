import type { PaletteMode } from "@mui/material";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { sourcesDelete } from "../lib/db";
import { cacheDelete, cacheGet, cacheSet } from "../lib/repoCache";
import {
	getRepoSignature,
	loadRepoFromPath,
	type Repo,
} from "../lib/repoLoader";
import { useCommentsStore } from "./useCommentsStore";

export type TabKey = string;

export interface RepoSource {
	path: string;
	missing: boolean;
}

/**
 * User-configurable reader preferences. Persisted as a single JSON blob under
 * the `"settings"` kv key (see store/bootstrap.ts) rather than one field each,
 * so adding a new preference only means extending this type + DEFAULT_SETTINGS
 * and reading it where the value is consumed - no new subscription/hydration.
 */
export interface AppSettings {
	/** Words-per-minute used for the reading-time stat. */
	readingWpm: number;
	/** Base color for user-comment highlights (hex); alphas derived at render. */
	highlightColor: string;
	/** Width of the comments panel in px. */
	commentsPanelWidth: number;
	/** Width of the left navigation sidebar in px (expanded mode only). */
	sidebarWidth: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
	readingWpm: 200,
	highlightColor: "#fde047",
	commentsPanelWidth: 340,
	sidebarWidth: 240,
};

/** Preset highlight colors offered in the settings dialog. */
export const HIGHLIGHT_COLORS = [
	"#fde047", // yellow (default)
	"#86efac", // green
	"#7dd3fc", // blue
	"#f9a8d4", // pink
	"#fdba74", // orange
	"#c4b5fd", // purple
] as const;

/** Merge stored settings over defaults, keeping only well-typed known fields. */
export function sanitizeSettings(raw: unknown): AppSettings {
	if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
	const r = raw as Record<string, unknown>;
	return {
		readingWpm:
			typeof r.readingWpm === "number" &&
			r.readingWpm >= 50 &&
			r.readingWpm <= 1000
				? r.readingWpm
				: DEFAULT_SETTINGS.readingWpm,
		highlightColor:
			typeof r.highlightColor === "string" &&
			/^#[0-9a-fA-F]{6}$/.test(r.highlightColor)
				? r.highlightColor
				: DEFAULT_SETTINGS.highlightColor,
		commentsPanelWidth:
			typeof r.commentsPanelWidth === "number" &&
			r.commentsPanelWidth >= 240 &&
			r.commentsPanelWidth <= 640
				? r.commentsPanelWidth
				: DEFAULT_SETTINGS.commentsPanelWidth,
		sidebarWidth:
			typeof r.sidebarWidth === "number" &&
			r.sidebarWidth >= 180 &&
			r.sidebarWidth <= 400
				? r.sidebarWidth
				: DEFAULT_SETTINGS.sidebarWidth,
	};
}

export type AppView =
	| "overview"
	| "specs"
	| "changes"
	| "flow"
	| "graph"
	| "timeline"
	| "schemas"
	| "folder";

export interface ScrollTarget {
	documentId: string;
	text: string;
	occurrence: number;
}

export interface FlowViewport {
	x: number;
	y: number;
	zoom: number;
}

export interface NavSnapshot {
	view: AppView;
	selectedRepoId: string | null;
	selectedChangeKey: string | null;
	selectedSpec: string | null;
	selectedSchema: string | null;
	selectedFolder: string | null;
	selectedFolderDoc: string | null;
	activeTab: TabKey;
}

interface AppState {
	repoSources: RepoSource[];
	repos: Repo[];
	reposLoading: boolean;
	blockingLoad: boolean;
	staleRepos: Record<string, true>;
	loadedSignatures: Record<string, string>;
	addRepoSource: (path: string) => Promise<void>;
	removeRepoSource: (path: string) => void;
	reloadAllSources: () => Promise<void>;
	reloadRepo: (path: string) => Promise<void>;
	markRepoStale: (path: string) => void;
	clearRepoStale: (path: string) => void;

	themeMode: PaletteMode;
	setThemeMode: (mode: PaletteMode) => void;
	toggleThemeMode: () => void;

	selectedRepoId: string | null;
	setSelectedRepoId: (id: string | null) => void;

	view: AppView;
	setView: (v: AppView) => void;

	selectedChangeKey: string | null;
	setSelectedChangeKey: (key: string | null) => void;

	selectedSpec: string | null;
	setSelectedSpec: (slug: string | null) => void;

	/** SpecCapabilityViewer's dropdown selection: "canonical" or `change:<changeKey>`. */
	specViewerTab: string | null;
	setSpecViewerTab: (tab: string | null) => void;

	selectedSchema: string | null;
	setSelectedSchema: (name: string | null) => void;

	selectedFolder: string | null;
	selectedFolderDoc: string | null;
	openFolder: (folder: string, doc?: string | null) => void;
	setSelectedFolderDoc: (doc: string | null) => void;

	activeTab: TabKey;
	setActiveTab: (tab: TabKey) => void;

	selectedFiles: Record<string, string>;
	setSelectedFile: (
		changeSlug: string,
		artifactId: string,
		name: string,
	) => void;

	scrollTarget: ScrollTarget | null;
	setScrollTarget: (target: ScrollTarget | null) => void;

	currentDocumentId: string | null;
	setCurrentDocument: (id: string | null) => void;

	flowViewport: FlowViewport | null;
	setFlowViewport: (v: FlowViewport | null) => void;

	sidebarCollapsed: boolean;
	toggleSidebarCollapsed: () => void;

	markdownZoom: number;
	zoomIn: () => void;
	zoomOut: () => void;
	resetZoom: () => void;

	highlightEars: boolean;
	toggleHighlightEars: () => void;

	/** Whether the onboarding tutorial has been shown at least once (persisted). */
	tutorialSeen: boolean;
	/** Whether the tutorial dialog is currently open (not persisted). */
	tutorialOpen: boolean;
	openTutorial: () => void;
	closeTutorial: () => void;

	settings: AppSettings;
	setSetting: <K extends keyof AppSettings>(
		key: K,
		value: AppSettings[K],
	) => void;
	resetSettings: () => void;

	navPast: NavSnapshot[];
	navFuture: NavSnapshot[];
	_navRestoring: boolean;
	pushNavSnapshot: (prev: NavSnapshot) => void;
	goBack: () => void;
	goForward: () => void;
}

export function getNavSnapshot(state: AppState): NavSnapshot {
	return {
		view: state.view,
		selectedRepoId: state.selectedRepoId,
		selectedChangeKey: state.selectedChangeKey,
		selectedSpec: state.selectedSpec,
		selectedSchema: state.selectedSchema,
		selectedFolder: state.selectedFolder,
		selectedFolderDoc: state.selectedFolderDoc,
		activeTab: state.activeTab,
	};
}

export function navSnapshotsEqual(a: NavSnapshot, b: NavSnapshot): boolean {
	return (
		a.view === b.view &&
		a.selectedRepoId === b.selectedRepoId &&
		a.selectedChangeKey === b.selectedChangeKey &&
		a.selectedSpec === b.selectedSpec &&
		a.selectedSchema === b.selectedSchema &&
		a.selectedFolder === b.selectedFolder &&
		a.selectedFolderDoc === b.selectedFolderDoc &&
		a.activeTab === b.activeTab
	);
}

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;

const clampZoom = (z: number) =>
	Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 100) / 100;

export const useAppStore = create<AppState>()(
	subscribeWithSelector((set, get) => ({
		repoSources: [],
		repos: [],
		reposLoading: false,
		blockingLoad: false,
		staleRepos: {},
		loadedSignatures: {},
		markRepoStale: (path) =>
			set((state) =>
				state.staleRepos[path]
					? state
					: { staleRepos: { ...state.staleRepos, [path]: true } },
			),
		clearRepoStale: (path) =>
			set((state) => {
				if (!state.staleRepos[path]) return state;
				const { [path]: _removed, ...rest } = state.staleRepos;
				return { staleRepos: rest };
			}),
		addRepoSource: async (path) => {
			if (get().repoSources.some((s) => s.path === path)) return;
			set((state) => ({
				repoSources: [...state.repoSources, { path, missing: false }],
				reposLoading: true,
				blockingLoad: true,
			}));
			try {
				const { repo, signature } = await loadRepoFromPath(path);
				await cacheSet(path, signature, repo);
				set((state) => ({
					repos: [...state.repos.filter((r) => r.id !== path), repo].sort(
						(a, b) => a.name.localeCompare(b.name),
					),
					repoSources: state.repoSources.map((s) =>
						s.path === path ? { path, missing: false } : s,
					),
					selectedRepoId: path,
					view: "overview",
					selectedChangeKey: null,
					selectedSpec: null,
					selectedSchema: null,
					selectedFolder: null,
					selectedFolderDoc: null,
					activeTab: "proposal",
					flowViewport: null,
					loadedSignatures: {
						...state.loadedSignatures,
						[path]: signature,
					},
					reposLoading: false,
					blockingLoad: false,
				}));
			} catch {
				set((state) => ({
					repoSources: state.repoSources.map((s) =>
						s.path === path ? { path, missing: true } : s,
					),
					reposLoading: false,
					blockingLoad: false,
				}));
			}
		},
		removeRepoSource: (path) => {
			const { selectedRepoId, staleRepos, loadedSignatures } = get();
			// Removing a repo tears down all of its persisted state together, so
			// no orphaned cache or comments can be left behind regardless of caller.
			// sourcesDelete is explicit because the write-through subscription skips
			// empty lists (so removing the very last repo still commits).
			void sourcesDelete(path);
			void cacheDelete(path);
			void useCommentsStore.getState().deleteCommentsForRepo(path);
			const { [path]: _removedStale, ...restStale } = staleRepos;
			const { [path]: _removedSig, ...restSigs } = loadedSignatures;
			set({
				repoSources: get().repoSources.filter((s) => s.path !== path),
				repos: get().repos.filter((r) => r.id !== path),
				selectedRepoId: selectedRepoId === path ? null : selectedRepoId,
				staleRepos: restStale,
				loadedSignatures: restSigs,
			});
		},
		reloadAllSources: async () => {
			const sources = get().repoSources;
			set({ reposLoading: true });
			const updatedSources: RepoSource[] = [];
			const loadedRepos: Repo[] = [];
			const sigs: Record<string, string> = {};
			for (const source of sources) {
				try {
					const currentSig = await getRepoSignature(source.path);
					const cached = await cacheGet(source.path);
					if (cached && cached.signature === currentSig) {
						loadedRepos.push(cached.repo);
						updatedSources.push({ path: source.path, missing: false });
						sigs[source.path] = currentSig;
						continue;
					}
					const { repo, signature } = await loadRepoFromPath(source.path);
					await cacheSet(source.path, signature, repo);
					loadedRepos.push(repo);
					updatedSources.push({ path: source.path, missing: false });
					sigs[source.path] = signature;
				} catch {
					updatedSources.push({ path: source.path, missing: true });
				}
			}
			// Never leave selectedRepoId pointing at a repo that isn't loaded: a
			// stale selection (e.g. persisted from a repo that was later removed)
			// would let new comments be created against a ghost repo id. Reset to
			// the first loaded repo, mirroring setSelectedRepoId's atomic reset.
			const loadedIds = new Set(loadedRepos.map((r) => r.id));
			const currentSel = get().selectedRepoId;
			const selectionValid = currentSel !== null && loadedIds.has(currentSel);
			const nextSel = selectionValid
				? currentSel
				: (loadedRepos[0]?.id ?? null);
			set({
				repoSources: updatedSources,
				repos: loadedRepos.sort((a, b) => a.name.localeCompare(b.name)),
				reposLoading: false,
				staleRepos: {},
				loadedSignatures: sigs,
				...(selectionValid
					? {}
					: {
							selectedRepoId: nextSel,
							selectedChangeKey: null,
							selectedSpec: null,
							selectedSchema: null,
							selectedFolder: null,
							selectedFolderDoc: null,
							activeTab: "proposal",
						}),
			});
		},
		reloadRepo: async (path) => {
			if (!get().repoSources.some((s) => s.path === path)) return;
			set({ reposLoading: true, blockingLoad: true });
			try {
				const { repo, signature } = await loadRepoFromPath(path);
				await cacheSet(path, signature, repo);
				set((state) => {
					const { [path]: _removedStale, ...restStale } = state.staleRepos;
					return {
						repos: [...state.repos.filter((r) => r.id !== path), repo].sort(
							(a, b) => a.name.localeCompare(b.name),
						),
						repoSources: state.repoSources.map((s) =>
							s.path === path ? { path, missing: false } : s,
						),
						reposLoading: false,
						blockingLoad: false,
						staleRepos: restStale,
						loadedSignatures: {
							...state.loadedSignatures,
							[path]: signature,
						},
					};
				});
			} catch {
				set((state) => {
					const { [path]: _removedStale, ...restStale } = state.staleRepos;
					const { [path]: _removedSig, ...restSigs } = state.loadedSignatures;
					return {
						repos: state.repos.filter((r) => r.id !== path),
						repoSources: state.repoSources.map((s) =>
							s.path === path ? { path, missing: true } : s,
						),
						reposLoading: false,
						blockingLoad: false,
						staleRepos: restStale,
						loadedSignatures: restSigs,
					};
				});
			}
		},

		themeMode: window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light",
		setThemeMode: (mode) => set({ themeMode: mode }),
		toggleThemeMode: () =>
			set((state) => ({
				themeMode: state.themeMode === "light" ? "dark" : "light",
			})),

		selectedRepoId: null,
		setSelectedRepoId: (id) =>
			set({
				selectedRepoId: id,
				view: "overview",
				selectedChangeKey: null,
				selectedSpec: null,
				selectedSchema: null,
				selectedFolder: null,
				selectedFolderDoc: null,
				activeTab: "proposal",
				flowViewport: null,
			}),

		view: "overview",
		setView: (v) =>
			set((state) => ({
				view: v,
				selectedChangeKey: v === "changes" ? state.selectedChangeKey : null,
				selectedSpec: v === "specs" ? state.selectedSpec : null,
				selectedSchema: v === "schemas" ? state.selectedSchema : null,
				selectedFolder: v === "folder" ? state.selectedFolder : null,
				selectedFolderDoc: v === "folder" ? state.selectedFolderDoc : null,
			})),

		selectedChangeKey: null,
		setSelectedChangeKey: (key) => set({ selectedChangeKey: key }),

		selectedSpec: null,
		setSelectedSpec: (slug) => set({ selectedSpec: slug }),

		specViewerTab: null,
		setSpecViewerTab: (tab) => set({ specViewerTab: tab }),

		selectedSchema: null,
		setSelectedSchema: (name) => set({ selectedSchema: name }),

		selectedFolder: null,
		selectedFolderDoc: null,
		openFolder: (folder, doc = null) =>
			set({
				view: "folder",
				selectedFolder: folder,
				selectedFolderDoc: doc,
			}),
		setSelectedFolderDoc: (doc) => set({ selectedFolderDoc: doc }),

		activeTab: "proposal",
		setActiveTab: (tab) => set({ activeTab: tab }),

		selectedFiles: {},
		setSelectedFile: (changeSlug, artifactId, name) =>
			set((state) => ({
				selectedFiles: {
					...state.selectedFiles,
					[`${changeSlug}::${artifactId}`]: name,
				},
			})),

		scrollTarget: null,
		setScrollTarget: (target) => set({ scrollTarget: target }),

		currentDocumentId: null,
		setCurrentDocument: (id) => set({ currentDocumentId: id }),

		flowViewport: null,
		setFlowViewport: (v) => set({ flowViewport: v }),

		sidebarCollapsed: false,
		toggleSidebarCollapsed: () =>
			set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

		markdownZoom: 1,
		zoomIn: () =>
			set((state) => ({
				markdownZoom: clampZoom(state.markdownZoom + ZOOM_STEP),
			})),
		zoomOut: () =>
			set((state) => ({
				markdownZoom: clampZoom(state.markdownZoom - ZOOM_STEP),
			})),
		resetZoom: () => set({ markdownZoom: 1 }),

		highlightEars: true,
		toggleHighlightEars: () =>
			set((state) => ({ highlightEars: !state.highlightEars })),

		tutorialSeen: false,
		tutorialOpen: false,
		openTutorial: () => set({ tutorialOpen: true }),
		// Closing always marks the tutorial as seen so it never auto-opens again,
		// whether the user finished it or dismissed it early.
		closeTutorial: () => set({ tutorialOpen: false, tutorialSeen: true }),

		settings: DEFAULT_SETTINGS,
		setSetting: (key, value) =>
			set((state) => ({ settings: { ...state.settings, [key]: value } })),
		resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

		navPast: [],
		navFuture: [],
		_navRestoring: false,
		pushNavSnapshot: (prev) =>
			set((state) => ({
				navPast: [...state.navPast, prev],
				navFuture: [],
			})),
		goBack: () => {
			const state = get();
			if (state.navPast.length === 0) return;
			const target = state.navPast[state.navPast.length - 1];
			const current = getNavSnapshot(state);
			set({
				navPast: state.navPast.slice(0, -1),
				navFuture: [current, ...state.navFuture],
				_navRestoring: true,
				...target,
			});
			queueMicrotask(() => set({ _navRestoring: false }));
		},
		goForward: () => {
			const state = get();
			if (state.navFuture.length === 0) return;
			const target = state.navFuture[0];
			const current = getNavSnapshot(state);
			set({
				navPast: [...state.navPast, current],
				navFuture: state.navFuture.slice(1),
				_navRestoring: true,
				...target,
			});
			queueMicrotask(() => set({ _navRestoring: false }));
		},
	})),
);
