import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	IconButton,
	Link,
	Tooltip,
	Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { aiModelInfo } from "../lib/ai";
import { docSummaryCacheKey } from "../lib/aiDocSummary";
import {
	aiErrorSeverity,
	collectCapabilities,
	formatTokenCount,
	linkifyCapabilities,
	parseSpecLink,
	SPEC_LINK_SCHEME,
} from "../lib/aiSummary";
import { getCachedDocSummary, useAiStore } from "../store/useAiStore";
import { useAppStore } from "../store/useAppStore";

/** Views where the panel stays hidden - full-canvas visualizations. */
const CANVAS_VIEWS = new Set(["flow", "graph", "timeline"]);
const MIN_WIDTH = 300;
const MAX_WIDTH = 640;

const markdownSx = {
	color: "text.primary",
	fontSize: "0.875rem",
	"& p": { mt: 0, mb: 1 },
	"& p:last-of-type": { mb: 0 },
	"& ul": { pl: 3, my: 0.5 },
	"& li": { mb: 0.5 },
	"& code": {
		fontFamily: "ui-monospace, monospace",
		fontSize: "0.875em",
		bgcolor: "action.hover",
		px: 0.5,
		borderRadius: 0.5,
	},
} as const;

/**
 * Non-modal right-side panel for the per-document AI summary. Always mounted
 * (in App.tsx, inside the content row next to CommentsPanel) and animated
 * open/closed by width, like the pinned CommentsPanel. Closing it does NOT
 * cancel generation - that keeps streaming in useAiStore and announces
 * completion via the "AI summary ready" snackbar.
 */
export function AiSummaryPanel() {
	const aiEnabled = useAppStore((s) => s.settings.aiEnabled);
	const aiModel = useAppStore((s) => s.settings.aiModel);
	const panelWidth = useAppStore((s) => s.settings.aiPanelWidth);
	const setSetting = useAppStore((s) => s.setSetting);
	const view = useAppStore((s) => s.view);
	const repos = useAppStore((s) => s.repos);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const setView = useAppStore((s) => s.setView);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const [resizing, setResizing] = useState(false);

	// Capability names of the active repo: bullet heads matching them get
	// rewritten into speclens-spec:// links (project overview summaries; also
	// upgrades doc summaries that happen to lead bullets with a capability).
	const capabilityNames = useMemo(() => {
		const repo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];
		return repo
			? collectCapabilities(repo.repoSpecs, repo.changes).map((c) => c.name)
			: [];
	}, [repos, selectedRepoId]);
	const docSummary = useAiStore((s) => s.docSummary);
	const currentDoc = useAiStore((s) => s.currentDoc);
	const models = useAiStore((s) => s.models);
	const modelsError = useAiStore((s) => s.modelsError);
	const refreshModels = useAiStore((s) => s.refreshModels);
	const cancelDocSummary = useAiStore((s) => s.cancelDocSummary);
	const regenerateDocSummary = useAiStore((s) => s.regenerateDocSummary);
	const closeDocSummaryPanel = useAiStore((s) => s.closeDocSummaryPanel);

	// Hidden on full-canvas views (flow/graph/timeline) - generation continues
	// and the panel reappears when returning to a document view.
	const open = docSummary.open && aiEnabled && !CANVAS_VIEWS.has(view);

	// Same drag idiom as the sidebar (AppSidebar): pointer capture, width
	// written straight to the persisted setting, no transition while dragging.
	const handleResizeStart = (e: React.PointerEvent<HTMLElement>) => {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = useAppStore.getState().settings.aiPanelWidth;
		const handle = e.currentTarget;
		handle.setPointerCapture(e.pointerId);
		setResizing(true);
		const onMove = (ev: PointerEvent) => {
			// Panel sits on the right, so dragging left grows it.
			const w = Math.round(
				Math.min(
					MAX_WIDTH,
					Math.max(MIN_WIDTH, startWidth + startX - ev.clientX),
				),
			);
			useAppStore.getState().setSetting("aiPanelWidth", w);
		};
		const onUp = () => {
			setResizing(false);
			handle.removeEventListener("pointermove", onMove);
			handle.removeEventListener("pointerup", onUp);
			handle.removeEventListener("pointercancel", onUp);
		};
		handle.addEventListener("pointermove", onMove);
		handle.addEventListener("pointerup", onUp);
		handle.addEventListener("pointercancel", onUp);
	};

	useEffect(() => {
		if (open && models === null) void refreshModels();
	}, [open, models, refreshModels]);

	// Navigating in the left sidebar closes the panel - it belongs to what you
	// were reading. Generation keeps running; the ready toast announces it.
	const prevViewRef = useRef(view);
	useEffect(() => {
		if (prevViewRef.current === view) return;
		prevViewRef.current = view;
		if (useAiStore.getState().docSummary.open) closeDocSummaryPanel();
	}, [view, closeDocSummaryPanel]);

	const { text, tokens, generating, error } = docSummary;

	// Tail the stream: while generating, the body stays pinned to the bottom
	// as tokens arrive. Scrolling up pauses the follow (so reading back never
	// fights the scrollbar); returning near the bottom - or a new generation
	// starting - re-engages it.
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const followRef = useRef(true);
	useEffect(() => {
		if (generating) followRef.current = true;
	}, [generating]);
	useEffect(() => {
		// `text` is read only as the effect trigger (each streamed chunk).
		void text;
		const el = bodyRef.current;
		if (el && generating && followRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [text, generating]);
	const modelReady =
		models?.some((m) => m.id === aiModel && m.downloaded) ?? false;
	const modelName = aiModelInfo(aiModel)?.displayName ?? aiModel;

	// The panel reflects the document currently on screen. The in-flight run
	// and its error only show when they belong to that document; otherwise the
	// current document's cached summary (or a generate prompt) shows instead.
	const currentKey = currentDoc
		? docSummaryCacheKey(aiModel, currentDoc.source)
		: null;
	const isCurrentRun = currentKey !== null && docSummary.docKey === currentKey;
	const cachedForCurrent =
		currentDoc && currentKey
			? getCachedDocSummary(aiModel, currentDoc.source)
			: undefined;
	const headerTitle = currentDoc?.title ?? docSummary.title;
	const headerKind = currentDoc?.kind ?? docSummary.kind;

	const renderMarkdown = (markdown: string) => (
		<Box sx={markdownSx}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				urlTransform={(url) =>
					url.startsWith(SPEC_LINK_SCHEME) ? url : defaultUrlTransform(url)
				}
				components={{
					a: ({ href, children }) => {
						const capability = parseSpecLink(href);
						if (capability) {
							return (
								<Link
									component="button"
									type="button"
									onClick={() => {
										setView("specs");
										setSelectedSpec(capability);
									}}
									sx={{ verticalAlign: "baseline" }}
								>
									{children}
								</Link>
							);
						}
						return (
							<Link
								href={href}
								onClick={(e) => {
									e.preventDefault();
									if (href) void openUrl(href).catch(console.error);
								}}
							>
								{children}
							</Link>
						);
					},
				}}
			>
				{linkifyCapabilities(markdown, capabilityNames)}
			</ReactMarkdown>
		</Box>
	);

	let body: React.ReactNode;
	if (!currentDoc) {
		body = (
			<Typography variant="body2" color="text.secondary">
				Open a document to summarize it.
			</Typography>
		);
	} else if (models === null && modelsError) {
		body = <Alert severity="error">{modelsError}</Alert>;
	} else if (models !== null && !modelReady) {
		body = (
			<Typography variant="body2" color="text.secondary">
				The selected model isn't downloaded yet. Open Settings → AI to download
				it.
			</Typography>
		);
	} else if (generating && isCurrentRun) {
		body = (
			<>
				{text ? (
					renderMarkdown(text)
				) : (
					<Typography variant="body2" color="text.secondary">
						{tokens > 0
							? `Thinking… · ${formatTokenCount(tokens)} tokens`
							: "Loading the model and generating…"}
					</Typography>
				)}
				<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
					<CircularProgress size={14} />
					<Typography variant="caption" color="text.secondary">
						Generating with {modelName}
						{tokens > 0 ? ` · ${formatTokenCount(tokens)} tokens` : ""}
					</Typography>
				</Box>
			</>
		);
	} else if (cachedForCurrent) {
		body = (
			<>
				{error && isCurrentRun && (
					<Alert severity={aiErrorSeverity(error)} sx={{ mb: 1.5 }}>
						{error}
					</Alert>
				)}
				{renderMarkdown(cachedForCurrent)}
			</>
		);
	} else if (error && isCurrentRun) {
		body = <Alert severity={aiErrorSeverity(error)}>{error}</Alert>;
	} else {
		body = (
			<>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
					Generate an on-device summary of this document. Nothing leaves your
					machine.
				</Typography>
				<Button
					size="small"
					variant="outlined"
					startIcon={<AutoAwesomeIcon />}
					onClick={() => void useAiStore.getState().summarizeDoc(currentDoc)}
				>
					Generate summary
				</Button>
				{generating && (
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ display: "block", mt: 1.5 }}
					>
						Still generating for “{docSummary.title}”
						{tokens > 0 ? ` · ${formatTokenCount(tokens)} tokens` : ""}…
					</Typography>
				)}
			</>
		);
	}

	const showFooter =
		(generating && isCurrentRun) ||
		(modelReady &&
			!!currentDoc &&
			(!!cachedForCurrent || (!!error && isCurrentRun)));

	return (
		<Box
			sx={{
				position: "relative",
				width: open ? panelWidth : 0,
				flexShrink: 0,
				transition: resizing ? "none" : "width 200ms ease-in-out",
				borderLeft: 1,
				borderColor: "divider",
				bgcolor: "background.paper",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				pointerEvents: open ? "auto" : "none",
			}}
		>
			{open && (
				<Box
					onPointerDown={handleResizeStart}
					onDoubleClick={() => setSetting("aiPanelWidth", 380)}
					aria-label="Resize AI summary panel"
					sx={{
						position: "absolute",
						top: 0,
						left: 0,
						bottom: 0,
						width: 5,
						cursor: "col-resize",
						zIndex: 1,
						bgcolor: resizing
							? (t) => alpha(t.palette.primary.main, 0.3)
							: "transparent",
						transition: "background-color 150ms",
						"&:hover": {
							bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
						},
					}}
				/>
			)}
			<Box
				sx={{
					display: "flex",
					alignItems: "flex-start",
					px: 1.5,
					py: 1,
					borderBottom: 1,
					borderColor: "divider",
					flexShrink: 0,
					gap: 0.5,
				}}
			>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
						AI summary
					</Typography>
					{headerTitle && (
						<Typography
							variant="caption"
							color="text.secondary"
							noWrap
							component="div"
						>
							{headerTitle} · {headerKind}
						</Typography>
					)}
				</Box>
				<Tooltip title="Close">
					<IconButton
						size="small"
						onClick={closeDocSummaryPanel}
						aria-label="Close AI summary"
						sx={{ color: "text.secondary" }}
					>
						<CloseIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			</Box>
			<Box
				ref={bodyRef}
				onScroll={() => {
					const el = bodyRef.current;
					if (!el) return;
					followRef.current =
						el.scrollHeight - el.scrollTop - el.clientHeight < 80;
				}}
				sx={{ flex: 1, overflowY: "auto", p: 2 }}
			>
				{body}
			</Box>
			{showFooter && (
				<Box
					sx={{
						px: 1.5,
						py: 1,
						borderTop: 1,
						borderColor: "divider",
						flexShrink: 0,
						display: "flex",
					}}
				>
					{generating ? (
						<Button size="small" onClick={cancelDocSummary}>
							Cancel
						</Button>
					) : (
						<Button
							size="small"
							startIcon={<RefreshIcon />}
							onClick={() => void regenerateDocSummary(currentDoc ?? undefined)}
						>
							Regenerate
						</Button>
					)}
				</Box>
			)}
		</Box>
	);
}
