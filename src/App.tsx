import type { PaletteMode } from "@mui/material";
import {
	Box,
	CssBaseline,
	IconButton,
	ThemeProvider,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { createAppTheme } from "./theme/theme";

function App() {
	const [mode, setMode] = useState<PaletteMode>("light");
	const theme = useMemo(() => createAppTheme(mode), [mode]);
	const toggleMode = () => setMode((m) => (m === "light" ? "dark" : "light"));

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
					onClick={toggleMode}
					aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
					sx={{
						position: "fixed",
						top: 16,
						right: 16,
						fontSize: "1.25rem",
					}}
				>
					{mode === "light" ? "🌙" : "☀️"}
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
