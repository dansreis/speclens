import type { PaletteMode } from "@mui/material";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cacheDelete, cacheGet, cacheSet } from "../lib/repoCache";
import {
	getRepoSignature,
	loadRepoFromPath,
	type Repo,
} from "../lib/repoLoader";

export type TabKey = string;

export interface RepoSource {
	path: string;
	missing: boolean;
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

interface AppState {
	repoSources: RepoSource[];
	repos: Repo[];
	reposLoading: boolean;
	// Distinguishes a user-initiated single-repo load (modal Backdrop) from a
	// silent background reload of all sources at app start (LinearProgress only).
	blockingLoad: boolean;
	addRepoSource: (path: string) => Promise<void>;
	removeRepoSource: (path: string) => void;
	reloadAllSources: () => Promise<void>;
	reloadRepo: (path: string) => Promise<void>;

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
}

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;

const clampZoom = (z: number) =>
	Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 100) / 100;

export const useAppStore = create<AppState>()(
	persist(
		(set, get) => ({
			repoSources: [],
			repos: [],
			reposLoading: false,
			blockingLoad: false,
			addRepoSource: async (path) => {
				if (get().repoSources.some((s) => s.path === path)) return;
				set((state) => ({
					repoSources: [...state.repoSources, { path, missing: false }],
					reposLoading: true,
					blockingLoad: true,
				}));
				try {
					const { repo, signature } = await loadRepoFromPath(path);
					cacheSet(path, signature, repo);
					set((state) => ({
						repos: [...state.repos.filter((r) => r.id !== path), repo].sort(
							(a, b) => a.name.localeCompare(b.name),
						),
						repoSources: state.repoSources.map((s) =>
							s.path === path ? { path, missing: false } : s,
						),
						selectedRepoId: state.selectedRepoId ?? path,
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
				const { selectedRepoId } = get();
				cacheDelete(path);
				set({
					repoSources: get().repoSources.filter((s) => s.path !== path),
					repos: get().repos.filter((r) => r.id !== path),
					selectedRepoId: selectedRepoId === path ? null : selectedRepoId,
				});
			},
			reloadAllSources: async () => {
				const sources = get().repoSources;
				set({ reposLoading: true });
				const updatedSources: RepoSource[] = [];
				const loadedRepos: Repo[] = [];
				for (const source of sources) {
					try {
						const currentSig = await getRepoSignature(source.path);
						const cached = cacheGet(source.path);
						if (cached && cached.signature === currentSig) {
							loadedRepos.push(cached.repo);
							updatedSources.push({ path: source.path, missing: false });
							continue;
						}
						const { repo, signature } = await loadRepoFromPath(source.path);
						cacheSet(source.path, signature, repo);
						loadedRepos.push(repo);
						updatedSources.push({ path: source.path, missing: false });
					} catch {
						updatedSources.push({ path: source.path, missing: true });
					}
				}
				set({
					repoSources: updatedSources,
					repos: loadedRepos.sort((a, b) => a.name.localeCompare(b.name)),
					reposLoading: false,
				});
			},
			reloadRepo: async (path) => {
				if (!get().repoSources.some((s) => s.path === path)) return;
				set({ reposLoading: true, blockingLoad: true });
				try {
					const { repo, signature } = await loadRepoFromPath(path);
					cacheSet(path, signature, repo);
					set((state) => ({
						repos: [...state.repos.filter((r) => r.id !== path), repo].sort(
							(a, b) => a.name.localeCompare(b.name),
						),
						repoSources: state.repoSources.map((s) =>
							s.path === path ? { path, missing: false } : s,
						),
						reposLoading: false,
						blockingLoad: false,
					}));
				} catch {
					set((state) => ({
						repos: state.repos.filter((r) => r.id !== path),
						repoSources: state.repoSources.map((s) =>
							s.path === path ? { path, missing: true } : s,
						),
						reposLoading: false,
						blockingLoad: false,
					}));
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
		}),
		{
			name: "speclens.app-state",
			partialize: (state) => ({
				themeMode: state.themeMode,
				sidebarCollapsed: state.sidebarCollapsed,
				selectedRepoId: state.selectedRepoId,
				markdownZoom: state.markdownZoom,
				view: state.view,
				highlightEars: state.highlightEars,
				// Persist source paths only; reset `missing` on cold start so we
				// re-probe — a folder may have been re-mounted since last session.
				repoSources: state.repoSources.map((s) => ({
					path: s.path,
					missing: false,
				})),
			}),
		},
	),
);
