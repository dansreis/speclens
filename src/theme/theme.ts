import type { PaletteMode } from "@mui/material";
import { createTheme } from "@mui/material/styles";

export const createAppTheme = (mode: PaletteMode) =>
	createTheme({
		palette: {
			mode,
			primary: {
				main: "#2563EB",
				light: "#60A5FA",
				dark: "#1E40AF",
			},
		},
	});
