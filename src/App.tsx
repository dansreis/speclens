import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import {
	Box,
	CssBaseline,
	IconButton,
	ThemeProvider,
	Tooltip,
	Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { CommentsPanel } from "./comments/CommentsPanel";
import { getCurrentSource } from "./lib/documentSource";
import { repos } from "./lib/exampleLoader";
import { AppSidebar } from "./sidebar/AppSidebar";
import { ChangeViewer } from "./specs/ChangeViewer";
import { DocumentStatsModal } from "./specs/DocumentStatsModal";
import { useAppStore } from "./store/useAppStore";
import { createAppTheme } from "./theme/theme";

function changeKey(c: { slug: string; archived: boolean }): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function App() {
	const themeMode = useAppStore((s) => s.themeMode);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const selectedKey = useAppStore((s) => s.selectedChangeKey);
	const setSelectedKey = useAppStore((s) => s.setSelectedChangeKey);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
	const toggleSidebarCollapsed = useAppStore((s) => s.toggleSidebarCollapsed);
	const zoomIn = useAppStore((s) => s.zoomIn);
	const zoomOut = useAppStore((s) => s.zoomOut);
	const resetZoom = useAppStore((s) => s.resetZoom);
	const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const modifier = e.metaKey || e.ctrlKey;
			if (!modifier || e.altKey) return;
			const target = e.target as HTMLElement | null;
			if (
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				target?.isContentEditable
			)
				return;
			if (e.key === "=" || e.key === "+") {
				e.preventDefault();
				zoomIn();
			} else if (e.key === "-") {
				e.preventDefault();
				zoomOut();
			} else if (e.key === "0") {
				e.preventDefault();
				resetZoom();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [zoomIn, zoomOut, resetZoom]);

	const activeRepo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];
	const changes = activeRepo?.changes ?? [];

	useEffect(() => {
		if (!selectedKey && changes[0]) {
			setSelectedKey(changeKey(changes[0]));
		}
	}, [selectedKey, setSelectedKey, changes]);

	const selectedChange =
		changes.find((c) => changeKey(c) === selectedKey) ?? null;

	const handleSelectChange = (key: string) => {
		setSelectedKey(key);
		setActiveTab("proposal");
	};

	const [commentsOpen, setCommentsOpen] = useState(false);
	const [commentsPinned, setCommentsPinned] = useState(false);
	const [statsOpen, setStatsOpen] = useState(false);
	const activeTab = useAppStore((s) => s.activeTab);
	const statsSource = useMemo(
		() => (statsOpen ? getCurrentSource(selectedChange, activeTab) : null),
		[statsOpen, selectedChange, activeTab],
	);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box
				sx={{
					height: "100vh",
					display: "flex",
					flexDirection: "row",
				}}
			>
				<AppSidebar
					changes={changes}
					selectedKey={selectedKey}
					onSelect={handleSelectChange}
				/>
				<Box
					sx={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						minWidth: 0,
					}}
				>
					<Box
						component="header"
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1,
							px: 1.5,
							py: 0.5,
							borderBottom: 1,
							borderColor: "divider",
						}}
					>
						<Tooltip
							title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						>
							<IconButton
								onClick={toggleSidebarCollapsed}
								aria-label="Toggle sidebar"
								size="small"
								sx={{
									color: "text.secondary",
									transform: sidebarCollapsed ? "rotate(180deg)" : "none",
									transition: "transform 200ms",
								}}
							>
								<MenuOpenIcon fontSize="small" />
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
						{selectedChange ? (
							<ChangeViewer
								change={selectedChange}
								commentsOpen={commentsOpen}
								onToggleComments={() => setCommentsOpen((o) => !o)}
								onOpenStats={() => setStatsOpen(true)}
							/>
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
			</Box>
			<DocumentStatsModal
				open={statsOpen}
				source={statsSource}
				onClose={() => setStatsOpen(false)}
			/>
		</ThemeProvider>
	);
}

export default App;
