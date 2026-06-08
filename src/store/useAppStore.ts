import type { PaletteMode } from "@mui/material";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TabKey = "proposal" | "tasks" | "specs";

export type AppView = "overview" | "specs" | "changes" | "graph" | "timeline";

export interface ScrollTarget {
	documentId: string;
	text: string;
	occurrence: number;
}

interface AppState {
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

	activeTab: TabKey;
	setActiveTab: (tab: TabKey) => void;

	scrollTarget: ScrollTarget | null;
	setScrollTarget: (target: ScrollTarget | null) => void;

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
		(set) => ({
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
					activeTab: "proposal",
				}),

			view: "specs",
			setView: (v) =>
				set((state) => ({
					view: v,
					selectedChangeKey: v === "changes" ? state.selectedChangeKey : null,
					selectedSpec: v === "specs" ? state.selectedSpec : null,
				})),

			selectedChangeKey: null,
			setSelectedChangeKey: (key) => set({ selectedChangeKey: key }),

			selectedSpec: null,
			setSelectedSpec: (slug) => set({ selectedSpec: slug }),

			activeTab: "proposal",
			setActiveTab: (tab) => set({ activeTab: tab }),

			scrollTarget: null,
			setScrollTarget: (target) => set({ scrollTarget: target }),

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
			}),
		},
	),
);
