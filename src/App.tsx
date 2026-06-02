import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import {
	Box,
	CssBaseline,
	IconButton,
	ThemeProvider,
	Tooltip,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { CommentsPanel } from "./comments/CommentsPanel";
import { changes } from "./lib/exampleLoader";
import { ChangesSidebar } from "./specs/ChangesSidebar";
import { ChangeViewer } from "./specs/ChangeViewer";
import { useAppStore } from "./store/useAppStore";
import { createAppTheme } from "./theme/theme";

function changeKey(c: { slug: string; archived: boolean }): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function App() {
	const themeMode = useAppStore((s) => s.themeMode);
	const toggleThemeMode = useAppStore((s) => s.toggleThemeMode);
	const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

	const [selectedKey, setSelectedKey] = useState<string | null>(
		changes[0] ? changeKey(changes[0]) : null,
	);
	const selectedChange =
		changes.find((c) => changeKey(c) === selectedKey) ?? null;

	const [commentsOpen, setCommentsOpen] = useState(false);
	const [commentsPinned, setCommentsPinned] = useState(false);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box
				sx={{
					height: "100vh",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<Box
					component="header"
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1.5,
						px: 2,
						py: 1,
						borderBottom: 1,
						borderColor: "divider",
					}}
				>
					<Box
						component="img"
						src="/speclens.png"
						alt=""
						sx={{ width: 28, height: 28 }}
					/>
					<Typography variant="h6" component="h1" sx={{ flex: 1 }}>
						SpecLens
					</Typography>
					<Tooltip title="Comments">
						<IconButton
							onClick={() => setCommentsOpen((o) => !o)}
							aria-label="Toggle comments"
							sx={{
								color: commentsOpen ? "primary.main" : "text.secondary",
							}}
						>
							<ChatBubbleOutlinedIcon fontSize="small" />
						</IconButton>
					</Tooltip>
					<Tooltip
						title={`Switch to ${themeMode === "light" ? "dark" : "light"} mode`}
					>
						<IconButton
							onClick={toggleThemeMode}
							aria-label={`Switch to ${themeMode === "light" ? "dark" : "light"} mode`}
							sx={{ color: "text.secondary" }}
						>
							{themeMode === "light" ? (
								<DarkModeIcon fontSize="small" />
							) : (
								<LightModeIcon fontSize="small" />
							)}
						</IconButton>
					</Tooltip>
				</Box>
				<Box
					sx={{
						flex: 1,
						display: "flex",
						minHeight: 0,
						position: "relative",
					}}
				>
					<ChangesSidebar
						changes={changes}
						selectedKey={selectedKey}
						onSelect={setSelectedKey}
					/>
					{selectedChange ? (
						<ChangeViewer change={selectedChange} />
					) : (
						<Box
							sx={{
								flex: 1,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Typography color="text.secondary">
								Select a change from the sidebar
							</Typography>
						</Box>
					)}
					<CommentsPanel
						open={commentsOpen}
						pinned={commentsPinned}
						onClose={() => setCommentsOpen(false)}
						onTogglePin={() => setCommentsPinned((p) => !p)}
					/>
				</Box>
			</Box>
		</ThemeProvider>
	);
}

export default App;
