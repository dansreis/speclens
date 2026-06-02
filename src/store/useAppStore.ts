import type { PaletteMode } from "@mui/material";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TabKey = "proposal" | "tasks" | "specs";

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

	selectedChangeKey: string | null;
	setSelectedChangeKey: (key: string | null) => void;

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
					activeTab: "proposal",
				}),

			selectedChangeKey: null,
			setSelectedChangeKey: (key) => set({ selectedChangeKey: key }),

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
		}),
		{
			name: "speclens.app-state",
			partialize: (state) => ({
				themeMode: state.themeMode,
				sidebarCollapsed: state.sidebarCollapsed,
				selectedRepoId: state.selectedRepoId,
				markdownZoom: state.markdownZoom,
			}),
		},
	),
);
