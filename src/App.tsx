import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import SearchIcon from "@mui/icons-material/Search";
import {
	Backdrop,
	Box,
	Button,
	ButtonBase,
	CircularProgress,
	CssBaseline,
	IconButton,
	LinearProgress,
	ThemeProvider,
	Tooltip,
	Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { CommentsPanel } from "./comments/CommentsPanel";
import { useDocumentOrphans } from "./lib/orphanDetection";
import { useMinDelay } from "./lib/useMinDelay";
import { useRepoSyncWatcher } from "./lib/useRepoSyncWatcher";
import { pickAndAddRepoSource } from "./repos/addRepo";
import { SplashScreen } from "./SplashScreen";
import { SearchPalette } from "./search/SearchPalette";
import { AppSidebar } from "./sidebar/AppSidebar";
import { bootstrap } from "./store/bootstrap";
import {
	getNavSnapshot,
	type NavSnapshot,
	navSnapshotsEqual,
	useAppStore,
} from "./store/useAppStore";
import { useCommentsStore } from "./store/useCommentsStore";
import { createAppTheme } from "./theme/theme";
import { Breadcrumbs } from "./views/Breadcrumbs";
import { ChangesView } from "./views/ChangesView";
import { ErrorBoundary } from "./views/ErrorBoundary";
import { FlowView } from "./views/FlowView";
import { FolderView } from "./views/FolderView";
import { GraphView } from "./views/GraphView";
import { OverviewView } from "./views/OverviewView";
import { SchemasView } from "./views/SchemasView";
import { SpecsView } from "./views/SpecsView";
import { TimelineView } from "./views/TimelineView";

function changeKey(c: { slug: string; archived: boolean }): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

export function HydrationGate({ children }: { children: React.ReactNode }) {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let cancelled = false;
		bootstrap()
			.then(() => {
				if (!cancelled) setReady(true);
			})
			.catch((err) => {
				console.error("bootstrap failed", err);
				if (!cancelled) setReady(true);
			});
		return () => {
			cancelled = true;
		};
	}, []);
	if (!ready) {
		return <SplashScreen />;
	}
	return <>{children}</>;
}

function App() {
	const themeMode = useAppStore((s) => s.themeMode);
	const view = useAppStore((s) => s.view);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const selectedChangeKey = useAppStore((s) => s.selectedChangeKey);
	const selectedSpec = useAppStore((s) => s.selectedSpec);
	const selectedFolderDoc = useAppStore((s) => s.selectedFolderDoc);
	const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
	const toggleSidebarCollapsed = useAppStore((s) => s.toggleSidebarCollapsed);
	const canGoBack = useAppStore((s) => s.navPast.length > 0);
	const canGoForward = useAppStore((s) => s.navFuture.length > 0);
	const zoomIn = useAppStore((s) => s.zoomIn);
	const zoomOut = useAppStore((s) => s.zoomOut);
	const resetZoom = useAppStore((s) => s.resetZoom);
	const repos = useAppStore((s) => s.repos);
	const repoSources = useAppStore((s) => s.repoSources);
	const reloadAllSources = useAppStore((s) => s.reloadAllSources);
	const reposLoading = useAppStore((s) => s.reposLoading);
	const blockingLoad = useAppStore((s) => s.blockingLoad);
	const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);
	const allComments = useCommentsStore((s) => s.comments);

	// Show the branded splash for at least 2s on cold start, even if loading is
	// instant. Measured from launch, so a slow load doesn't stack extra delay.
	const minSplashElapsed = useMinDelay(2000);

	useRepoSyncWatcher();
	useDocumentOrphans(allComments, repos);

	useEffect(() => {
		if (repoSources.length > 0 && repos.length === 0) {
			reloadAllSources();
		}
	}, [repoSources.length, repos.length, reloadAllSources]);

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
			} else if (e.key === "[") {
				e.preventDefault();
				useAppStore.getState().goBack();
			} else if (e.key === "]") {
				e.preventDefault();
				useAppStore.getState().goForward();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [zoomIn, zoomOut, resetZoom]);

	// Mouse buttons 4 (back) and 5 (forward).
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (e.button === 3) {
				e.preventDefault();
				useAppStore.getState().goBack();
			} else if (e.button === 4) {
				e.preventDefault();
				useAppStore.getState().goForward();
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	// Track navigation history: push the prior snapshot to the past whenever a
	// nav field changes (unless the change came from goBack/goForward). Writes
	// landing in the same microtask are coalesced into ONE entry holding the
	// state before the first write: click handlers navigate in several store
	// writes (e.g. setView + setSelectedChangeKey), and pushing each one would
	// make "back" restore the intermediate write — the half-navigated state —
	// instead of the view the user actually came from.
	useEffect(() => {
		let pending: NavSnapshot | null = null;
		return useAppStore.subscribe(
			getNavSnapshot,
			(_next, prev) => {
				if (useAppStore.getState()._navRestoring) return;
				if (pending) return;
				pending = prev;
				queueMicrotask(() => {
					const snapshot = pending;
					pending = null;
					// Skip no-ops (state churned but settled back where it started).
					if (
						snapshot &&
						!navSnapshotsEqual(snapshot, getNavSnapshot(useAppStore.getState()))
					) {
						useAppStore.getState().pushNavSnapshot(snapshot);
					}
				});
			},
			{ equalityFn: navSnapshotsEqual },
		);
	}, []);

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
	const [searchOpen, setSearchOpen] = useState(false);

	const hasActiveDocument =
		!!activeChange ||
		(view === "specs" && !!selectedSpec) ||
		(view === "folder" && !!selectedFolderDoc);

	useEffect(() => {
		if (!hasActiveDocument) setCommentsOpen(false);
	}, [hasActiveDocument]);

	const sharedDetailProps = {
		commentsOpen,
		onToggleComments: () => setCommentsOpen((o) => !o),
	};

	// Keep the branded splash up through the initial repository load (repos not
	// yet populated) so the empty "no project" state never flashes before content,
	// and for a minimum duration so it doesn't flash by on fast starts. Subsequent
	// reloads keep repos populated, so this only triggers on cold start.
	if (!minSplashElapsed || (reposLoading && repos.length === 0)) {
		return (
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<SplashScreen />
			</ThemeProvider>
		);
	}

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			{reposLoading && (
				<LinearProgress
					aria-label="Loading repositories"
					sx={{
						position: "fixed",
						top: 0,
						left: 0,
						right: 0,
						height: 3,
						zIndex: (t) => t.zIndex.tooltip + 1,
					}}
				/>
			)}
			<Backdrop
				open={blockingLoad}
				sx={{
					bgcolor: "background.default",
					color: "text.primary",
					zIndex: (t) => t.zIndex.modal + 1,
					flexDirection: "column",
					gap: 2,
				}}
			>
				<CircularProgress color="primary" />
				<Box sx={{ textAlign: "center", maxWidth: 360 }}>
					<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
						Loading repository
					</Typography>
					<Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
						Reading files and walking git history. This can take a few seconds
						for repos with long histories.
					</Typography>
				</Box>
			</Backdrop>
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
							height: 48,
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
						<Box sx={{ display: "flex", alignItems: "center" }}>
							<Tooltip title="Back (⌘[)">
								<span>
									<IconButton
										onClick={() => useAppStore.getState().goBack()}
										disabled={!canGoBack}
										aria-label="Go back"
										size="small"
										sx={{ color: "text.secondary" }}
									>
										<ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
									</IconButton>
								</span>
							</Tooltip>
							<Tooltip title="Forward (⌘])">
								<span>
									<IconButton
										onClick={() => useAppStore.getState().goForward()}
										disabled={!canGoForward}
										aria-label="Go forward"
										size="small"
										sx={{ color: "text.secondary" }}
									>
										<ArrowForwardIosIcon sx={{ fontSize: 16 }} />
									</IconButton>
								</span>
							</Tooltip>
						</Box>
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
								minHeight: 0,
							}}
						>
							<ErrorBoundary
								key={`${view}:${selectedSpec ?? ""}:${selectedChangeKey ?? ""}`}
							>
								{!activeRepo ? (
									reposLoading && repoSources.length > 0 ? (
										<Box
											sx={{
												flex: 1,
												display: "flex",
												flexDirection: "column",
												alignItems: "center",
												justifyContent: "center",
												gap: 1.5,
												p: 4,
												textAlign: "center",
											}}
										>
											<CircularProgress size={28} />
											<Typography variant="body2" color="text.secondary">
												Loading {repoSources.length} repositor
												{repoSources.length === 1 ? "y" : "ies"}…
											</Typography>
										</Box>
									) : (
										<Box
											sx={{
												flex: 1,
												display: "flex",
												flexDirection: "column",
												alignItems: "center",
												justifyContent: "center",
												gap: 2,
												p: 4,
												textAlign: "center",
											}}
										>
											<Typography variant="h6" color="text.secondary">
												{repos.length === 0 && repoSources.length === 0
													? "No repositories yet"
													: "No repository selected"}
											</Typography>
											<Typography
												variant="body2"
												color="text.secondary"
												sx={{ maxWidth: 420 }}
											>
												Add a folder containing an{" "}
												<Box component="code">openspec/</Box> directory to start
												browsing its proposals, tasks, and specs.
											</Typography>
											<Button
												variant="contained"
												startIcon={<CreateNewFolderOutlinedIcon />}
												onClick={() => pickAndAddRepoSource()}
											>
												Add repository
											</Button>
										</Box>
									)
								) : view === "overview" ? (
									<OverviewView repo={activeRepo} />
								) : view === "specs" ? (
									<SpecsView repo={activeRepo} {...sharedDetailProps} />
								) : view === "changes" ? (
									<ChangesView repo={activeRepo} {...sharedDetailProps} />
								) : view === "schemas" ? (
									<SchemasView repo={activeRepo} />
								) : view === "folder" ? (
									<FolderView repo={activeRepo} {...sharedDetailProps} />
								) : view === "flow" ? (
									<FlowView />
								) : view === "graph" ? (
									<GraphView repo={activeRepo} />
								) : (
									<TimelineView repo={activeRepo} />
								)}
							</ErrorBoundary>
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
			<SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
		</ThemeProvider>
	);
}

export default App;
