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

	selectedChangeKey: string | null;
	setSelectedChangeKey: (key: string | null) => void;

	activeTab: TabKey;
	setActiveTab: (tab: TabKey) => void;

	scrollTarget: ScrollTarget | null;
	setScrollTarget: (target: ScrollTarget | null) => void;

	sidebarCollapsed: boolean;
	toggleSidebarCollapsed: () => void;
}

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

			selectedChangeKey: null,
			setSelectedChangeKey: (key) => set({ selectedChangeKey: key }),

			activeTab: "proposal",
			setActiveTab: (tab) => set({ activeTab: tab }),

			scrollTarget: null,
			setScrollTarget: (target) => set({ scrollTarget: target }),

			sidebarCollapsed: false,
			toggleSidebarCollapsed: () =>
				set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
		}),
		{
			name: "speclens.app-state",
			partialize: (state) => ({
				themeMode: state.themeMode,
				sidebarCollapsed: state.sidebarCollapsed,
			}),
		},
	),
);
