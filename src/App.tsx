import {
	Box,
	CssBaseline,
	IconButton,
	ThemeProvider,
	Typography,
} from "@mui/material";
import { useMemo } from "react";
import { useAppStore } from "./store/useAppStore";
import { createAppTheme } from "./theme/theme";

function App() {
	const themeMode = useAppStore((s) => s.themeMode);
	const toggleThemeMode = useAppStore((s) => s.toggleThemeMode);
	const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box
				sx={{
					minHeight: "100vh",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 3,
				}}
			>
				<IconButton
					onClick={toggleThemeMode}
					aria-label={`Switch to ${themeMode === "light" ? "dark" : "light"} mode`}
					sx={{
						position: "fixed",
						top: 16,
						right: 16,
						fontSize: "1.25rem",
					}}
				>
					{themeMode === "light" ? "🌙" : "☀️"}
				</IconButton>
				<Box
					component="img"
					src="/speclens.png"
					alt="SpecLens"
					sx={{ width: 128, height: 128 }}
				/>
				<Typography variant="h3" component="h1">
					SpecLens
				</Typography>
			</Box>
		</ThemeProvider>
	);
}

export default App;
