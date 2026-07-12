import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
	Alert,
	Box,
	Button,
	FormControlLabel,
	LinearProgress,
	MenuItem,
	Select,
	Stack,
	Switch,
	Typography,
} from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { AI_MODELS, aiImportModel, DEFAULT_AI_MODEL_ID } from "../lib/ai";

const MODELS_ALPHABETICAL = [...AI_MODELS].sort((a, b) =>
	a.displayName.localeCompare(b.displayName),
);

import { formatBytes } from "../lib/aiSummary";
import { useAiStore } from "../store/useAiStore";
import { useAppStore } from "../store/useAppStore";

/**
 * "AI (local)" section of the settings dialog: opt-in switch, model picker,
 * and per-model download/delete management. Download progress lives in
 * useAiStore so closing the dialog doesn't lose track of an in-flight
 * multi-GB download.
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

	const status = models?.find((m) => m.id === aiModel) ?? null;
	const download = downloads[aiModel];
	const downloadError = downloadErrors[aiModel];

	/** User-imported models, listed after the registry entries. */
	const customModels = (models ?? [])
		.filter((m) => m.custom)
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

	const handleDelete = () => {
		const wasCustom = status?.custom === true;
		void removeModel(aiModel).then(() => {
			// A deleted custom model vanishes from the list entirely (unlike
			// registry entries), so fall back to the default selection.
			const stillExists = useAiStore
				.getState()
				.models?.some((m) => m.id === aiModel);
			if (wasCustom && !stillExists) {
				setSetting("aiModel", DEFAULT_AI_MODEL_ID);
			}
		});
	};

	const totalOnDisk = (models ?? [])
		.filter((m) => m.downloaded)
		.reduce((sum, m) => sum + (m.downloadedBytes ?? m.sizeBytes), 0);

	return (
		<Box>
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
							your machine; requires a one-time model download; nothing ever
							leaves your disk.
						</Typography>
					</Box>
				}
			/>
			{aiEnabled && (
				<Stack spacing={1.5} sx={{ mt: 1.5 }}>
					<Select
						value={aiModel}
						onChange={(e) => setSetting("aiModel", e.target.value)}
						size="small"
						fullWidth
						aria-label="AI model"
						renderValue={(id) => {
							const m = MODELS_ALPHABETICAL.find((x) => x.id === id);
							if (m) return `${m.displayName} · ~${formatBytes(m.sizeBytes)}`;
							const custom = customModels.find((x) => x.id === id);
							return custom
								? `${custom.displayName} · ${formatBytes(custom.downloadedBytes ?? custom.sizeBytes)}`
								: id;
						}}
					>
						{MODELS_ALPHABETICAL.map((m) => {
							const downloaded = models?.some(
								(s) => s.id === m.id && s.downloaded,
							);
							return (
								<MenuItem key={m.id} value={m.id}>
									<Box>
										<Typography variant="body2">
											{m.displayName} · ~{formatBytes(m.sizeBytes)}
											{downloaded ? " · downloaded" : ""}
										</Typography>
										<Typography
											variant="caption"
											color="text.secondary"
											component="div"
										>
											{m.description}
										</Typography>
									</Box>
								</MenuItem>
							);
						})}
						{customModels.map((m) => (
							<MenuItem key={m.id} value={m.id}>
								<Box>
									<Typography variant="body2">
										{m.displayName} ·{" "}
										{formatBytes(m.downloadedBytes ?? m.sizeBytes)}
									</Typography>
									<Typography
										variant="caption"
										color="text.secondary"
										component="div"
									>
										Imported model
									</Typography>
								</Box>
							</MenuItem>
						))}
					</Select>
					{modelsError && <Alert severity="error">{modelsError}</Alert>}
					{downloadError && <Alert severity="error">{downloadError}</Alert>}
					{download ? (
						<Box>
							<LinearProgress
								variant={download.bytesTotal ? "determinate" : "indeterminate"}
								value={
									download.bytesTotal
										? (download.bytesDone / download.bytesTotal) * 100
										: undefined
								}
								sx={{ mb: 0.5, borderRadius: 1 }}
							/>
							<Typography variant="caption" color="text.secondary">
								Downloading… {formatBytes(download.bytesDone)}
								{download.bytesTotal
									? ` / ${formatBytes(download.bytesTotal)}`
									: ""}
							</Typography>
						</Box>
					) : status?.downloaded ? (
						<Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
							<Typography variant="caption" color="text.secondary">
								Downloaded ·{" "}
								{formatBytes(status.downloadedBytes ?? status.sizeBytes)} on
								disk
							</Typography>
							<Button
								onClick={handleDelete}
								startIcon={<DeleteOutlinedIcon />}
								color="error"
								variant="text"
								size="small"
							>
								Delete
							</Button>
						</Stack>
					) : (
						<Box>
							<Button
								onClick={() => startDownload(aiModel)}
								startIcon={<DownloadIcon />}
								variant="outlined"
								size="small"
								disabled={!models}
							>
								Download{status ? ` (~${formatBytes(status.sizeBytes)})` : ""}
							</Button>
							{status?.partialBytes != null && (
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{ display: "block", mt: 0.5 }}
								>
									A previous download was interrupted; downloading restarts it
									from scratch.
								</Typography>
							)}
						</Box>
					)}
					<Box>
						<Button
							onClick={() => void handleImport()}
							startIcon={<UploadFileIcon />}
							variant="outlined"
							size="small"
							disabled={importing}
						>
							{importing ? "Importing…" : "Import model…"}
						</Button>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ display: "block", mt: 0.5 }}
						>
							Any llama.cpp-compatible GGUF works. Imported models use their
							built-in chat template; very new architectures may not be
							supported by the bundled engine.
						</Typography>
					</Box>
					{importError && <Alert severity="error">{importError}</Alert>}
					{totalOnDisk > 0 && (
						<Typography variant="caption" color="text.secondary">
							Total on disk: {formatBytes(totalOnDisk)}
						</Typography>
					)}
				</Stack>
			)}
		</Box>
	);
}
