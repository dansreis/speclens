import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
	Alert,
	Box,
	Button,
	FormControlLabel,
	IconButton,
	LinearProgress,
	Link,
	Radio,
	Stack,
	Switch,
	Tooltip,
	Typography,
} from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import {
	AI_MODELS,
	type AiModelStatus,
	aiImportModel,
	aiRevealModelsDir,
	DEFAULT_AI_MODEL_ID,
} from "../lib/ai";
import { formatBytes } from "../lib/aiSummary";
import { type AiDownloadProgress, useAiStore } from "../store/useAiStore";
import { useAppStore } from "../store/useAppStore";

const MODELS_ALPHABETICAL = [...AI_MODELS].sort((a, b) =>
	a.displayName.localeCompare(b.displayName),
);

/** Small overline header separating model groups inside the list. */
function GroupHeader({ label }: { label: string }) {
	return (
		<Typography
			variant="overline"
			color="text.secondary"
			sx={{
				display: "block",
				px: 1.5,
				pt: 1,
				pb: 0.25,
				lineHeight: 1.5,
				fontSize: "0.65rem",
			}}
		>
			{label}
		</Typography>
	);
}

interface ModelRowProps {
	name: string;
	/** One-line context under the name: description / "Imported model" / ... */
	subtitle: string;
	sizeLabel: string;
	selected: boolean;
	onSelect: () => void;
	/** null while the first ai_model_status fetch is pending. */
	status: AiModelStatus | null;
	download: AiDownloadProgress | undefined;
	error: string | undefined;
	statusesLoaded: boolean;
	onDownload: () => void;
	onDelete: () => void;
}

/**
 * One selectable model row: radio + name/description on the left, a compact
 * status/action zone on the right (download / progress / downloaded + delete),
 * and optional progress bar, interrupted-download hint, or error underneath.
 * Ollama rows show no action zone - Ollama manages those models itself.
 */
function ModelRow({
	name,
	subtitle,
	sizeLabel,
	selected,
	onSelect,
	status,
	download,
	error,
	statusesLoaded,
	onDownload,
	onDelete,
}: ModelRowProps) {
	const isOllama = status?.ollama === true;
	const downloaded = status?.downloaded === true;
	const percent =
		download?.bytesTotal != null && download.bytesTotal > 0
			? Math.min(100, (download.bytesDone / download.bytesTotal) * 100)
			: null;

	let actionZone: React.ReactNode = null;
	if (!isOllama) {
		if (download) {
			actionZone = (
				<Typography variant="caption" color="text.secondary" noWrap>
					{percent != null
						? `${Math.round(percent)}%`
						: formatBytes(download.bytesDone)}
				</Typography>
			);
		} else if (downloaded) {
			actionZone = (
				<Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
					<CheckCircleOutlinedIcon
						sx={{ fontSize: 14, color: "success.main" }}
					/>
					<Typography variant="caption" color="text.secondary" noWrap>
						Downloaded
					</Typography>
					<Tooltip title={`Delete ${name}`} arrow>
						<IconButton
							size="small"
							aria-label={`Delete ${name}`}
							onClick={(e) => {
								e.stopPropagation();
								onDelete();
							}}
							sx={{ color: "text.secondary", p: 0.25 }}
						>
							<DeleteOutlinedIcon sx={{ fontSize: 16 }} />
						</IconButton>
					</Tooltip>
				</Stack>
			);
		} else {
			actionZone = (
				<Button
					size="small"
					variant="outlined"
					startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
					disabled={!statusesLoaded}
					onClick={(e) => {
						e.stopPropagation();
						onDownload();
					}}
					sx={{ py: 0, px: 1, minWidth: 0, whiteSpace: "nowrap" }}
				>
					Download
				</Button>
			);
		}
	}

	return (
		<Box>
			<Box
				role="radio"
				aria-checked={selected}
				tabIndex={0}
				onClick={onSelect}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onSelect();
					}
				}}
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 0.75,
					px: 1,
					py: 0.5,
					cursor: "pointer",
					bgcolor: selected ? "action.selected" : undefined,
					"&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
				}}
			>
				<Radio size="small" checked={selected} tabIndex={-1} sx={{ p: 0.5 }} />
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography variant="body2" noWrap title={name}>
						{name}
					</Typography>
					<Typography
						variant="caption"
						color="text.secondary"
						component="div"
						noWrap
						title={`${subtitle} · ${sizeLabel}`}
					>
						{subtitle} · {sizeLabel}
					</Typography>
				</Box>
				{actionZone}
			</Box>
			{download && (
				<LinearProgress
					variant={percent != null ? "determinate" : "indeterminate"}
					value={percent ?? undefined}
					sx={{ mx: 1.5, mb: 0.75, borderRadius: 1 }}
				/>
			)}
			{!download && !downloaded && status?.partialBytes != null && (
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ display: "block", px: 1.5, pb: 0.5, mt: -0.25 }}
				>
					A previous download was interrupted; downloading restarts it from
					scratch.
				</Typography>
			)}
			{error && (
				<Typography
					variant="caption"
					color="error"
					sx={{ display: "block", px: 1.5, pb: 0.5 }}
				>
					{error}
				</Typography>
			)}
		</Box>
	);
}

/**
 * "AI (local)" section of the settings dialog: opt-in switch, a grouped,
 * scannable model list (Curated / Imported / Ollama) where every model shows
 * its status and actions inline, and a compact import/reveal footer. Download
 * progress lives in useAiStore so closing the dialog doesn't lose track of an
 * in-flight multi-GB download.
 */
export function AiSettingsSection() {
	const aiEnabled = useAppStore((s) => s.settings.aiEnabled);
	const aiModel = useAppStore((s) => s.settings.aiModel);
	const setSetting = useAppStore((s) => s.setSetting);
	const models = useAiStore((s) => s.models);
	const modelsError = useAiStore((s) => s.modelsError);
	const downloads = useAiStore((s) => s.downloads);
	const downloadErrors = useAiStore((s) => s.downloadErrors);
	const refreshModels = useAiStore((s) => s.refreshModels);
	const startDownload = useAiStore((s) => s.startDownload);
	const removeModel = useAiStore((s) => s.removeModel);
	const [importing, setImporting] = useState(false);
	const [importError, setImportError] = useState<string | null>(null);

	useEffect(() => {
		void refreshModels();
	}, [refreshModels]);

	const statusById = new Map((models ?? []).map((m) => [m.id, m]));

	/** User-imported models, listed after the registry entries. */
	const customModels = (models ?? [])
		.filter((m) => m.custom)
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	/** Models served by a local Ollama instance, grouped at the bottom. */
	const ollamaModels = (models ?? [])
		.filter((m) => m.ollama)
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	const handleImport = async () => {
		setImportError(null);
		try {
			const picked = await open({
				multiple: false,
				filters: [{ name: "GGUF model", extensions: ["gguf"] }],
			});
			if (typeof picked !== "string") return;
			setImporting(true);
			const id = await aiImportModel(picked);
			await refreshModels();
			setSetting("aiModel", id);
		} catch (e) {
			setImportError(String(e));
		} finally {
			setImporting(false);
		}
	};

	const handleDelete = (id: string, wasCustom: boolean) => {
		void removeModel(id).then(() => {
			// A deleted custom model vanishes from the list entirely (unlike
			// registry entries), so fall back to the default selection when it
			// was the selected one.
			const stillExists = useAiStore
				.getState()
				.models?.some((m) => m.id === id);
			const selectedNow = useAppStore.getState().settings.aiModel;
			if (wasCustom && !stillExists && selectedNow === id) {
				setSetting("aiModel", DEFAULT_AI_MODEL_ID);
			}
		});
	};

	// Ollama models live in Ollama's own store, not the app's models folder.
	const totalOnDisk = (models ?? [])
		.filter((m) => m.downloaded && !m.ollama)
		.reduce((sum, m) => sum + (m.downloadedBytes ?? m.sizeBytes), 0);

	return (
		<Box
			sx={{
				flex: 1,
				minHeight: 0,
				display: "flex",
				flexDirection: "column",
			}}
		>
			<FormControlLabel
				sx={{ ml: 0, alignItems: "flex-start" }}
				control={
					<Switch
						checked={aiEnabled}
						onChange={(_, checked) => setSetting("aiEnabled", checked)}
						sx={{ mt: -0.5 }}
					/>
				}
				label={
					<Box>
						<Typography variant="body2" sx={{ fontWeight: 500 }}>
							AI (local)
						</Typography>
						<Typography variant="caption" color="text.secondary">
							Enables an on-device AI summary of each project. Runs fully on
							your machine; nothing ever leaves your disk. Works with downloaded
							models, imported GGUF files, and models from a local Ollama
							server.
						</Typography>
					</Box>
				}
			/>
			{aiEnabled && (
				<Stack spacing={1.5} sx={{ mt: 1.5, flex: 1, minHeight: 0 }}>
					{modelsError && <Alert severity="error">{modelsError}</Alert>}
					<Box
						role="radiogroup"
						aria-label="AI model"
						sx={{
							border: 1,
							borderColor: "divider",
							borderRadius: 1,
							flex: 1,
							minHeight: 0,
							overflowY: "auto",
							pb: 0.5,
						}}
					>
						<GroupHeader label="Curated" />
						{MODELS_ALPHABETICAL.map((m) => {
							const status = statusById.get(m.id) ?? null;
							return (
								<ModelRow
									key={m.id}
									name={m.displayName}
									subtitle={m.description}
									sizeLabel={
										status?.downloaded
											? formatBytes(status.downloadedBytes ?? m.sizeBytes)
											: `~${formatBytes(m.sizeBytes)}`
									}
									selected={aiModel === m.id}
									onSelect={() => setSetting("aiModel", m.id)}
									status={status}
									download={downloads[m.id]}
									error={downloadErrors[m.id]}
									statusesLoaded={models !== null}
									onDownload={() => startDownload(m.id)}
									onDelete={() => handleDelete(m.id, false)}
								/>
							);
						})}
						{customModels.length > 0 && <GroupHeader label="Imported" />}
						{customModels.map((m) => (
							<ModelRow
								key={m.id}
								name={m.displayName}
								subtitle="Imported model"
								sizeLabel={formatBytes(m.downloadedBytes ?? m.sizeBytes)}
								selected={aiModel === m.id}
								onSelect={() => setSetting("aiModel", m.id)}
								status={m}
								download={downloads[m.id]}
								error={downloadErrors[m.id]}
								statusesLoaded={models !== null}
								onDownload={() => startDownload(m.id)}
								onDelete={() => handleDelete(m.id, true)}
							/>
						))}
						{ollamaModels.length > 0 && <GroupHeader label="Ollama" />}
						{ollamaModels.map((m) => (
							<ModelRow
								key={m.id}
								name={m.displayName}
								subtitle="Ollama (local server)"
								sizeLabel={formatBytes(m.downloadedBytes ?? m.sizeBytes)}
								selected={aiModel === m.id}
								onSelect={() => setSetting("aiModel", m.id)}
								status={m}
								download={downloads[m.id]}
								error={downloadErrors[m.id]}
								statusesLoaded={models !== null}
								onDownload={() => startDownload(m.id)}
								onDelete={() => handleDelete(m.id, false)}
							/>
						))}
					</Box>
					{ollamaModels.length === 0 && (
						<Typography variant="caption" color="text.secondary">
							Running Ollama? Its models appear here automatically.
						</Typography>
					)}
					{importError && <Alert severity="error">{importError}</Alert>}
					<Box>
						<Stack
							direction="row"
							spacing={1}
							useFlexGap
							sx={{ alignItems: "center", flexWrap: "wrap" }}
						>
							<Button
								onClick={() => void handleImport()}
								startIcon={<UploadFileIcon />}
								variant="outlined"
								size="small"
								disabled={importing}
							>
								{importing ? "Importing…" : "Import model"}
							</Button>
							<Button
								onClick={() => void aiRevealModelsDir().catch(console.error)}
								startIcon={<FolderOpenIcon />}
								variant="outlined"
								size="small"
							>
								Reveal models folder
							</Button>
							<Box sx={{ flex: 1 }} />
							{totalOnDisk > 0 && (
								<Typography variant="caption" color="text.secondary" noWrap>
									Total on disk: {formatBytes(totalOnDisk)}
								</Typography>
							)}
						</Stack>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ display: "block", mt: 0.5 }}
						>
							Any llama.cpp-compatible GGUF works - browse{" "}
							<Link
								component="button"
								type="button"
								onClick={() =>
									void openUrl(
										"https://huggingface.co/models?library=gguf&sort=trending",
									).catch(console.error)
								}
								sx={{ verticalAlign: "baseline" }}
							>
								GGUF models on Hugging Face
							</Link>{" "}
							and download a <code>Q4_K_M</code> file for a good size/quality
							balance. Imported models use their built-in chat template; very
							new architectures may not be supported by the bundled engine.
						</Typography>
					</Box>
				</Stack>
			)}
		</Box>
	);
}
