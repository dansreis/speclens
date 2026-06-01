import type { PaletteMode } from "@mui/material";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
	themeMode: PaletteMode;
	setThemeMode: (mode: PaletteMode) => void;
	toggleThemeMode: () => void;
}

export const useAppStore = create<AppState>()(
	persist(
		(set) => ({
			themeMode: "light",
			setThemeMode: (mode) => set({ themeMode: mode }),
			toggleThemeMode: () =>
				set((state) => ({
					themeMode: state.themeMode === "light" ? "dark" : "light",
				})),
		}),
		{
			name: "speclens.app-state",
			partialize: (state) => ({ themeMode: state.themeMode }),
		},
	),
);
