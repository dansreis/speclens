import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import SearchIcon from "@mui/icons-material/Search";
import {
	Box,
	ButtonBase,
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
import { SearchPalette } from "./search/SearchPalette";
import { AppSidebar } from "./sidebar/AppSidebar";
import { DocumentStatsModal } from "./specs/DocumentStatsModal";
import { useAppStore } from "./store/useAppStore";
import { createAppTheme } from "./theme/theme";
import { Breadcrumbs } from "./views/Breadcrumbs";
import { ChangesView } from "./views/ChangesView";
import { GraphView } from "./views/GraphView";
import { OverviewView } from "./views/OverviewView";
import { SpecsView } from "./views/SpecsView";
import { TimelineView } from "./views/TimelineView";

function changeKey(c: { slug: string; archived: boolean }): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function App() {
	const themeMode = useAppStore((s) => s.themeMode);
	const view = useAppStore((s) => s.view);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const selectedChangeKey = useAppStore((s) => s.selectedChangeKey);
	const selectedSpec = useAppStore((s) => s.selectedSpec);
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
			} else if (e.key === "k" || e.key === "K") {
				e.preventDefault();
				setSearchOpen((o) => !o);
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [zoomIn, zoomOut, resetZoom]);

	const activeRepo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];

	const activeChange = useMemo(() => {
		if (!activeRepo) return null;
		if (view === "changes" && selectedChangeKey) {
			return (
				activeRepo.changes.find((c) => changeKey(c) === selectedChangeKey) ??
				null
			);
		}
		if (view === "specs" && selectedSpec) {
			return (
				activeRepo.changes.find((c) =>
					Object.keys(c.specs).includes(selectedSpec),
				) ?? null
			);
		}
		return null;
	}, [activeRepo, view, selectedChangeKey, selectedSpec]);

	const [commentsOpen, setCommentsOpen] = useState(false);
	const [commentsPinned, setCommentsPinned] = useState(false);
	const [statsOpen, setStatsOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const activeTab = useAppStore((s) => s.activeTab);
	const statsSource = useMemo(
		() => (statsOpen ? getCurrentSource(activeChange, activeTab) : null),
		[statsOpen, activeChange, activeTab],
	);

	const sharedDetailProps = {
		commentsOpen,
		onToggleComments: () => setCommentsOpen((o) => !o),
		onOpenStats: () => setStatsOpen(true),
	};

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
				<AppSidebar />
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
							gap: 1.5,
							px: 1.5,
							py: 0.5,
							borderBottom: 1,
							borderColor: "divider",
							minHeight: 44,
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
						<Breadcrumbs activeChange={activeChange} />
						<Box sx={{ flex: 1 }} />
						<ButtonBase
							onClick={() => setSearchOpen(true)}
							aria-label="Open search"
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 1,
								px: 2,
								py: 0.75,
								borderRadius: 1,
								bgcolor: "action.hover",
								color: "text.secondary",
								fontSize: "0.875rem",
								minWidth: 220,
								justifyContent: "flex-start",
								transition: "background-color 150ms, color 150ms",
								"&:hover": {
									bgcolor: "action.selected",
									color: "text.primary",
								},
							}}
						>
							<SearchIcon fontSize="small" />
							<Box sx={{ flex: 1, textAlign: "left" }}>Search…</Box>
							<Box
								component="kbd"
								sx={{
									fontSize: "0.6875rem",
									bgcolor: "background.default",
									px: 0.75,
									py: 0.25,
									borderRadius: 0.5,
									border: 1,
									borderColor: "divider",
									fontFamily: "ui-monospace, monospace",
								}}
							>
								⌘K
							</Box>
						</ButtonBase>
					</Box>
					<Box
						sx={{
							flex: 1,
							display: "flex",
							minHeight: 0,
							position: "relative",
							overflow: "hidden",
						}}
					>
						<Box
							sx={{
								flex: 1,
								display: "flex",
								flexDirection: "column",
								overflowY: activeChange ? "hidden" : "auto",
								minWidth: 0,
							}}
						>
							{!activeRepo ? (
								<Box
									sx={{
										flex: 1,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Typography color="text.secondary">
										No repository available
									</Typography>
								</Box>
							) : view === "overview" ? (
								<OverviewView repo={activeRepo} />
							) : view === "specs" ? (
								<SpecsView repo={activeRepo} {...sharedDetailProps} />
							) : view === "changes" ? (
								<ChangesView repo={activeRepo} {...sharedDetailProps} />
							) : view === "graph" ? (
								<GraphView />
							) : (
								<TimelineView />
							)}
						</Box>
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
			<SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
		</ThemeProvider>
	);
}

export default App;
