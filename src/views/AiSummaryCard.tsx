import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Link,
	Typography,
} from "@mui/material";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { aiCancelGenerate, aiGenerate, aiModelInfo } from "../lib/ai";
import {
	aiSummaryGet,
	aiSummarySet,
	type CachedAiSummary,
} from "../lib/aiSummaries";
import {
	buildSummaryPrompt,
	parseSpecLink,
	SPEC_LINK_SCHEME,
} from "../lib/aiSummary";
import { formatCompactDateTime } from "../lib/relativeTime";
import type { Repo } from "../lib/repoLoader";
import { useAiStore } from "../store/useAiStore";
import { useAppStore } from "../store/useAppStore";

interface Props {
	repo: Repo;
}

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
 * Local-AI project summary on the Overview page. Rendered only when the
 * `aiEnabled` setting is on (see OverviewView). Summaries are cached in
 * SQLite keyed by repo path; the repo signature captured at generation time
 * marks cached summaries as outdated when the project changes on disk.
 *
 * Mount this with `key={repo.id}` so all generation state resets per repo.
 */
export function AiSummaryCard({ repo }: Props) {
	const aiModel = useAppStore((s) => s.settings.aiModel);
	const signature = useAppStore((s) => s.loadedSignatures[repo.id] ?? null);
	const setView = useAppStore((s) => s.setView);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const models = useAiStore((s) => s.models);
	const modelsError = useAiStore((s) => s.modelsError);
	const refreshModels = useAiStore((s) => s.refreshModels);

	// undefined = still loading from SQLite; null = no cached summary.
	const [cached, setCached] = useState<CachedAiSummary | null | undefined>(
		undefined,
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

	useEffect(() => {
		let stale = false;
		void aiSummaryGet(repo.id).then((entry) => {
			if (!stale) setCached(entry);
		});
		return () => {
			stale = true;
		};
	}, [repo.id]);

	const handleGenerate = useCallback(async () => {
		const prompt = buildSummaryPrompt({
			repoName: repo.name,
			capabilities: repo.repoSpecs.map((s) => ({
				name: s.capability,
				content: s.content,
			})),
			activeChangeTitles: repo.changes
				.filter((c) => !c.archived)
				.map((c) => c.name),
		});
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
			if (reason !== "cancelled" && acc.trim().length > 0) {
				const summary: CachedAiSummary = {
					signature: signature ?? "",
					modelId: aiModel,
					summary: acc.trim(),
					createdAt: new Date(),
				};
				await aiSummarySet(
					repo.id,
					summary.signature,
					aiModel,
					summary.summary,
				);
				if (aliveRef.current) setCached(summary);
			}
		} catch (e) {
			generatingRef.current = false;
			if (aliveRef.current) setError(String(e));
		}
		if (aliveRef.current) {
			setGenerating(false);
			setStreamText("");
		}
	}, [repo, aiModel, signature]);

	const renderMarkdown = (text: string) => (
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
				{text}
			</ReactMarkdown>
		</Box>
	);

	const modelStatus = models?.find((m) => m.id === aiModel) ?? null;
	const modelReady = modelStatus?.downloaded ?? false;
	const modelName = aiModelInfo(aiModel)?.displayName ?? aiModel;
	const isStale =
		!!cached &&
		!!signature &&
		cached.signature !== "" &&
		cached.signature !== signature;

	let body: React.ReactNode;
	if (models === null && modelsError) {
		body = <Alert severity="error">{modelsError}</Alert>;
	} else if (models !== null && !modelReady) {
		body = (
			<Typography variant="body2" color="text.secondary">
				The selected model isn't downloaded yet. Open Settings → AI (local) to
				download it.
			</Typography>
		);
	} else if (generating) {
		body = (
			<>
				{streamText ? (
					renderMarkdown(streamText)
				) : (
					<Typography variant="body2" color="text.secondary">
						Loading the model and generating…
					</Typography>
				)}
				<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
					<CircularProgress size={14} />
					<Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
						Generating with {modelName}
					</Typography>
					<Button size="small" onClick={() => void aiCancelGenerate()}>
						Cancel
					</Button>
				</Box>
			</>
		);
	} else if (models === null || cached === undefined) {
		body = (
			<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
				<CircularProgress size={14} />
				<Typography variant="caption" color="text.secondary">
					Loading…
				</Typography>
			</Box>
		);
	} else if (cached) {
		body = (
			<>
				{error && (
					<Alert severity="error" sx={{ mb: 1.5 }}>
						{error}
					</Alert>
				)}
				{renderMarkdown(cached.summary)}
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1,
						mt: 1.5,
						flexWrap: "wrap",
					}}
				>
					<Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
						{aiModelInfo(cached.modelId)?.displayName ?? cached.modelId} ·{" "}
						{formatCompactDateTime(cached.createdAt)}
						{isStale &&
							" · outdated - the project changed since this was generated"}
					</Typography>
					<Button
						size="small"
						startIcon={<RefreshIcon />}
						onClick={() => void handleGenerate()}
					>
						Regenerate
					</Button>
				</Box>
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
					Generate an on-device summary of this project's capabilities. Nothing
					leaves your machine.
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
		<Box sx={{ mb: 4 }}>
			<Typography
				variant="overline"
				sx={{
					color: "text.disabled",
					fontWeight: 600,
					letterSpacing: 0.6,
					display: "block",
					mb: 1.5,
				}}
			>
				AI summary
			</Typography>
			<Box
				sx={{
					p: 2,
					border: 1,
					borderColor: isStale && !generating ? "warning.main" : "divider",
					borderRadius: 1,
					bgcolor: "background.paper",
				}}
			>
				{body}
			</Box>
		</Box>
	);
}
