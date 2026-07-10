import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	Tooltip,
	Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { aiCancelGenerate, aiGenerate, aiModelInfo } from "../lib/ai";
import { buildDocSummaryPrompt, docSummaryCacheKey } from "../lib/aiDocSummary";
import { stripThinkBlocks } from "../lib/aiSummary";
import { useAiStore } from "../store/useAiStore";
import { useAppStore } from "../store/useAppStore";

interface Props {
	/** Human document title, e.g. the change or capability name. */
	title: string;
	/** What kind of document this is: "proposal", "tasks", "spec delta", ... */
	kind: string;
	/** Markdown source of the document currently shown; null hides the button. */
	source: string | null;
}

/**
 * Session-level summary cache keyed by model + source hash: reopening the
 * dialog for an unchanged document reuses the summary; any edit or model
 * switch produces a new key. Intentionally not persisted to SQLite.
 */
const summaryCache = new Map<string, string>();

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
 * "AI summary" IconButton for document viewers: opens a dialog that streams a
 * reviewer-oriented summary of the current document. Rendered only when the
 * `aiEnabled` setting is on and a document source exists.
 */
export function AiDocSummaryButton({ title, kind, source }: Props) {
	const aiEnabled = useAppStore((s) => s.settings.aiEnabled);
	const [open, setOpen] = useState(false);

	if (!aiEnabled || !source) return null;

	return (
		<>
			<Tooltip title="AI summary">
				<IconButton
					onClick={() => setOpen(true)}
					aria-label="AI summary"
					sx={{ color: "text.secondary" }}
				>
					<AutoAwesomeIcon fontSize="small" />
				</IconButton>
			</Tooltip>
			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				{/* Body is a separate component so closing the dialog unmounts it,
				    and the unmount cleanup cancels any in-flight generation. */}
				<SummaryDialogBody
					title={title}
					kind={kind}
					source={source}
					onClose={() => setOpen(false)}
				/>
			</Dialog>
		</>
	);
}

function SummaryDialogBody({
	title,
	kind,
	source,
	onClose,
}: {
	title: string;
	kind: string;
	source: string;
	onClose: () => void;
}) {
	const aiModel = useAppStore((s) => s.settings.aiModel);
	const models = useAiStore((s) => s.models);
	const modelsError = useAiStore((s) => s.modelsError);
	const refreshModels = useAiStore((s) => s.refreshModels);

	const cacheKey = docSummaryCacheKey(aiModel, source);
	const [summary, setSummary] = useState<string | null>(
		() => summaryCache.get(cacheKey) ?? null,
	);
	const [generating, setGenerating] = useState(false);
	const [streamText, setStreamText] = useState("");
	const [error, setError] = useState<string | null>(null);
	// Tracks unmount so late channel events / promise settlement are ignored,
	// and lets cleanup cancel a still-running generation.
	const aliveRef = useRef(true);
	const generatingRef = useRef(false);

	useEffect(() => {
		aliveRef.current = true;
		return () => {
			aliveRef.current = false;
			if (generatingRef.current) void aiCancelGenerate();
		};
	}, []);

	useEffect(() => {
		if (models === null) void refreshModels();
	}, [models, refreshModels]);

	const modelStatus = models?.find((m) => m.id === aiModel) ?? null;
	const modelReady = modelStatus?.downloaded ?? false;
	const modelName = aiModelInfo(aiModel)?.displayName ?? aiModel;

	const handleGenerate = useCallback(async () => {
		const prompt = buildDocSummaryPrompt({ title, kind, source });
		setError(null);
		setStreamText("");
		setGenerating(true);
		generatingRef.current = true;
		let acc = "";
		let reason = "";
		try {
			await aiGenerate(aiModel, prompt, (event) => {
				if (!aliveRef.current) return;
				if (event.event === "token") {
					acc += event.text;
					setStreamText(acc);
				} else {
					reason = event.reason;
				}
			});
			generatingRef.current = false;
			const finalText = stripThinkBlocks(acc).trim();
			if (reason !== "cancelled" && finalText.length > 0) {
				summaryCache.set(cacheKey, finalText);
				if (aliveRef.current) setSummary(finalText);
			}
		} catch (e) {
			generatingRef.current = false;
			if (aliveRef.current) setError(String(e));
		}
		if (aliveRef.current) {
			setGenerating(false);
			setStreamText("");
		}
	}, [title, kind, source, aiModel, cacheKey]);

	// Auto-generate once when the dialog opens with no cached summary and a
	// ready model. Cancel/error drop back to the manual "Generate" state.
	const startedRef = useRef(false);
	useEffect(() => {
		if (startedRef.current || summary !== null || !modelReady) return;
		startedRef.current = true;
		void handleGenerate();
	}, [summary, modelReady, handleGenerate]);

	const renderMarkdown = (raw: string) => (
		<Box sx={markdownSx}>
			<ReactMarkdown remarkPlugins={[remarkGfm]}>
				{stripThinkBlocks(raw)}
			</ReactMarkdown>
		</Box>
	);

	let body: React.ReactNode;
	if (models === null && modelsError) {
		body = <Alert severity="error">{modelsError}</Alert>;
	} else if (models !== null && !modelReady) {
		body = (
			<Typography variant="body2" color="text.secondary">
				The selected model isn't downloaded yet. Open Settings → AI to download
				it.
			</Typography>
		);
	} else if (generating) {
		body = (
			<>
				{stripThinkBlocks(streamText) ? (
					renderMarkdown(streamText)
				) : (
					<Typography variant="body2" color="text.secondary">
						{streamText ? "Thinking…" : "Loading the model and generating…"}
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
	} else if (models === null) {
		body = (
			<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
				<CircularProgress size={14} />
				<Typography variant="caption" color="text.secondary">
					Loading…
				</Typography>
			</Box>
		);
	} else if (summary) {
		body = (
			<>
				{error && (
					<Alert severity="error" sx={{ mb: 1.5 }}>
						{error}
					</Alert>
				)}
				{renderMarkdown(summary)}
			</>
		);
	} else {
		body = (
			<>
				{error && (
					<Alert severity="error" sx={{ mb: 1.5 }}>
						{error}
					</Alert>
				)}
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
					Generate an on-device summary of this document. Nothing leaves your
					machine.
				</Typography>
				<Button
					size="small"
					variant="outlined"
					startIcon={<AutoAwesomeIcon />}
					onClick={() => void handleGenerate()}
				>
					Generate summary
				</Button>
			</>
		);
	}

	return (
		<>
			<DialogTitle sx={{ pb: 1 }}>
				AI summary
				<Typography variant="body2" color="text.secondary" component="div">
					{title} · {kind}
				</Typography>
			</DialogTitle>
			<DialogContent dividers>{body}</DialogContent>
			<DialogActions sx={{ justifyContent: "space-between", px: 3 }}>
				<Box>
					{generating ? (
						<Button size="small" onClick={() => void aiCancelGenerate()}>
							Cancel
						</Button>
					) : (
						summary && (
							<Button
								size="small"
								startIcon={<RefreshIcon />}
								onClick={() => void handleGenerate()}
							>
								Regenerate
							</Button>
						)
					)}
				</Box>
				<Button onClick={onClose}>Close</Button>
			</DialogActions>
		</>
	);
}
