import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	IconButton,
	Tooltip,
	Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { aiModelInfo } from "../lib/ai";
import { aiErrorSeverity } from "../lib/aiSummary";
import { useAiStore } from "../store/useAiStore";
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
	const [resizing, setResizing] = useState(false);
	const docSummary = useAiStore((s) => s.docSummary);
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

	const { title, kind, text, receivedTokens, generating, error } = docSummary;
	const modelReady =
		models?.some((m) => m.id === aiModel && m.downloaded) ?? false;
	const modelName = aiModelInfo(aiModel)?.displayName ?? aiModel;

	const renderMarkdown = (markdown: string) => (
		<Box sx={markdownSx}>
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
		</Box>
	);

	let body: React.ReactNode;
	if (generating) {
		body = (
			<>
				{text ? (
					renderMarkdown(text)
				) : (
					<Typography variant="body2" color="text.secondary">
						{receivedTokens ? "Thinking…" : "Loading the model and generating…"}
					</Typography>
				)}
				<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
					<CircularProgress size={14} />
					<Typography variant="caption" color="text.secondary">
						Generating with {modelName}
					</Typography>
				</Box>
			</>
		);
	} else if (text) {
		body = (
			<>
				{error && (
					<Alert severity={aiErrorSeverity(error)} sx={{ mb: 1.5 }}>
						{error}
					</Alert>
				)}
				{renderMarkdown(text)}
			</>
		);
	} else if (error) {
		body = <Alert severity={aiErrorSeverity(error)}>{error}</Alert>;
	} else if (models === null && modelsError) {
		body = <Alert severity="error">{modelsError}</Alert>;
	} else if (models !== null && !modelReady) {
		body = (
			<Typography variant="body2" color="text.secondary">
				The selected model isn't downloaded yet. Open Settings → AI to download
				it.
			</Typography>
		);
	} else if (models === null) {
		body = (
			<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
				<CircularProgress size={14} />
				<Typography variant="caption" color="text.secondary">
					Loading…
				</Typography>
			</Box>
		);
	} else {
		// Idle with a ready model and nothing to show (e.g. cancelled before any
		// output): offer a manual start.
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
					onClick={() => void regenerateDocSummary()}
				>
					Generate summary
				</Button>
			</>
		);
	}

	const showFooter = generating || (modelReady && (text || error));

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
					{title && (
						<Typography
							variant="caption"
							color="text.secondary"
							noWrap
							component="div"
						>
							{title} · {kind}
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
			<Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>{body}</Box>
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
							onClick={() => void regenerateDocSummary()}
						>
							Regenerate
						</Button>
					)}
				</Box>
			)}
		</Box>
	);
}
