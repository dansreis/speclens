import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import BarChartIcon from "@mui/icons-material/BarChart";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import {
	Alert,
	Box,
	Button,
	Chip,
	FormControl,
	IconButton,
	LinearProgress,
	MenuItem,
	Select,
	Tab,
	Tabs,
	Tooltip,
	Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef } from "react";
import { getStatsSections } from "../lib/documentSource";
import { extractHeadings } from "../lib/extractHeadings";
import type { Change } from "../lib/repoLoader";
import {
	type Artifact,
	artifactLabel,
	isChecklistArtifact,
	type OpenSpecSchema,
} from "../lib/schema";
import type { SpecCheckResult } from "../lib/specChecks";
import { countTaskCompletion } from "../lib/tasksCompletion";
import { type TabKey, useAppStore } from "../store/useAppStore";
import { AiDocSummaryButton } from "./AiDocSummaryButton";
import { AttributionLine } from "./AttributionLine";
import { DocumentStatsTooltipContent } from "./DocumentStatsTooltip";
import { MarkdownView } from "./MarkdownView";
import { Minimap } from "./Minimap";
import { SpecChecksBadge } from "./SpecChecksBadge";

interface Props {
	change: Change;
	schema: OpenSpecSchema;
	commentsOpen: boolean;
	onToggleComments: () => void;
	checkResults?: SpecCheckResult[];
}

function tabLabel(
	artifact: Artifact,
	schema: OpenSpecSchema,
	source: string,
): string {
	const base = artifactLabel(artifact.id);
	if (isChecklistArtifact(artifact, schema)) {
		const { done, total } = countTaskCompletion(source);
		if (total > 0) return `${base} (${done}/${total})`;
	}
	return base;
}

export function ChangeViewer({
	change,
	schema,
	commentsOpen,
	onToggleComments,
	checkResults = [],
}: Props) {
	const tab = useAppStore((s) => s.activeTab);
	const setTab = useAppStore((s) => s.setActiveTab);
	const selectedFiles = useAppStore((s) => s.selectedFiles);
	const setSelectedFile = useAppStore((s) => s.setSelectedFile);
	const markdownZoom = useAppStore((s) => s.markdownZoom);
	const zoomIn = useAppStore((s) => s.zoomIn);
	const zoomOut = useAppStore((s) => s.zoomOut);
	const resetZoom = useAppStore((s) => s.resetZoom);
	const setView = useAppStore((s) => s.setView);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const contentRef = useRef<HTMLDivElement | null>(null);

	const linkedCapabilities = useMemo(
		() => Object.keys(change.specs),
		[change.specs],
	);

	const openCapability = (capability: string) => {
		setSelectedSpec(capability);
		setView("specs");
	};

	const availableDocs = useMemo(
		() => schema.artifacts.filter((a) => change.documents[a.id] !== undefined),
		[schema, change.documents],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: resets viewer when the selected change changes
	useEffect(() => {
		if (useAppStore.getState().scrollTarget) return;
		contentRef.current?.scrollTo({ top: 0 });
	}, [change]);

	useEffect(() => {
		if (availableDocs.length === 0) return;
		if (!availableDocs.some((d) => d.id === tab)) {
			setTab(availableDocs[0].id);
		}
	}, [availableDocs, tab, setTab]);

	const tabFiles = useMemo(
		() => change.documentFiles[tab] ?? [],
		[change.documentFiles, tab],
	);

	const selectionKey = `${change.slug}::${tab}`;
	const storedFile = selectedFiles[selectionKey];
	const activeFile = useMemo(() => {
		if (tabFiles.length === 0) return null;
		if (storedFile) {
			const match = tabFiles.find((f) => f.name === storedFile);
			if (match) return match;
		}
		return tabFiles[0];
	}, [tabFiles, storedFile]);

	const currentSource = activeFile?.content ?? change.documents[tab] ?? null;

	const statsSections = useMemo(
		() => getStatsSections(change, tab, selectedFiles),
		[change, tab, selectedFiles],
	);

	const headings = useMemo(
		() => (currentSource ? extractHeadings(currentSource) : []),
		[currentSource],
	);

	const handleTabChange = (v: TabKey) => {
		setTab(v);
	};

	const activeDoc = availableDocs.find((d) => d.id === tab) ?? availableDocs[0];
	const tabValue = activeDoc?.id ?? false;
	const isChecklistTab = activeDoc
		? isChecklistArtifact(activeDoc, schema)
		: false;

	const taskProgress = useMemo(() => {
		if (!activeDoc || !currentSource) return null;
		if (!isChecklistArtifact(activeDoc, schema)) return null;
		const { done, total } = countTaskCompletion(currentSource);
		if (total === 0) return null;
		return { done, total, percent: Math.round((done / total) * 100) };
	}, [activeDoc, currentSource, schema]);

	const readyToArchive = useMemo(() => {
		if (change.archived || !change.tasks) return false;
		const { total, done } = countTaskCompletion(change.tasks);
		return total > 0 && done === total;
	}, [change.archived, change.tasks]);

	const fileAuthorship = useMemo(() => {
		if (!change.authorship) return null;
		if (!activeFile) return null;
		return change.authorship.files[activeFile.path] ?? null;
	}, [change.authorship, activeFile]);

	return (
		<Box
			sx={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				minWidth: 0,
				minHeight: 0,
				height: "100%",
			}}
		>
			<Box
				sx={{
					px: 4,
					pt: 3,
					display: "flex",
					alignItems: "center",
					gap: 2,
				}}
			>
				<Box
					sx={{
						flex: 1,
						minWidth: 0,
						display: "flex",
						flexDirection: "column",
						gap: 0.5,
					}}
				>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1.5,
							minWidth: 0,
						}}
					>
						<Typography variant="h4" component="h2">
							{change.name}
						</Typography>
						<Chip
							label={change.archived ? "Archived" : "Active"}
							size="small"
							variant="outlined"
							sx={{
								height: 22,
								fontSize: "0.75rem",
								fontWeight: 500,
								borderWidth: 1.5,
								color: change.archived ? "#d97706" : "success.main",
								borderColor: change.archived ? "#d97706" : "success.main",
							}}
						/>
					</Box>
					{change.authorship && (
						<AttributionLine authorship={change.authorship.rolled} />
					)}
					{linkedCapabilities.length > 0 && (
						<Box
							sx={{
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								gap: 0.5,
								mt: 0.25,
							}}
						>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ mr: 0.5 }}
							>
								Specs:
							</Typography>
							{linkedCapabilities.map((cap) => (
								<Chip
									key={cap}
									label={cap}
									size="small"
									variant="outlined"
									clickable
									onClick={() => openCapability(cap)}
									sx={{
										height: 20,
										fontSize: "0.6875rem",
										fontWeight: 500,
										borderColor: "divider",
										color: "text.secondary",
										"&:hover": {
											borderColor: "primary.main",
											color: "primary.main",
											bgcolor: "action.hover",
										},
									}}
								/>
							))}
						</Box>
					)}
				</Box>
				<Box
					sx={{
						display: "flex",
						gap: 0.5,
						flexShrink: 0,
						alignItems: "center",
					}}
				>
					<Tooltip title="Zoom out (⌘−)">
						<IconButton
							onClick={zoomOut}
							aria-label="Zoom out"
							size="small"
							sx={{ color: "text.secondary" }}
						>
							<ZoomOutIcon fontSize="small" />
						</IconButton>
					</Tooltip>
					<Tooltip title="Reset zoom (⌘0)">
						<Button
							onClick={resetZoom}
							size="small"
							sx={{
								minWidth: 44,
								px: 0.5,
								color: "text.secondary",
								fontFamily: "ui-monospace, monospace",
								fontSize: "0.75rem",
								textTransform: "none",
							}}
						>
							{Math.round(markdownZoom * 100)}%
						</Button>
					</Tooltip>
					<Tooltip title="Zoom in (⌘+)">
						<IconButton
							onClick={zoomIn}
							aria-label="Zoom in"
							size="small"
							sx={{ color: "text.secondary" }}
						>
							<ZoomInIcon fontSize="small" />
						</IconButton>
					</Tooltip>
					<SpecChecksBadge results={checkResults} />
					<AiDocSummaryButton
						title={change.name}
						kind={
							activeDoc ? artifactLabel(activeDoc.id).toLowerCase() : "document"
						}
						source={currentSource}
					/>
					<Tooltip
						title={<DocumentStatsTooltipContent sections={statsSections} />}
						placement="bottom-end"
						slotProps={{
							tooltip: {
								sx: {
									maxWidth: "none",
									bgcolor: "background.paper",
									color: "text.primary",
									p: 1.5,
									border: 1,
									borderColor: "divider",
									boxShadow: 4,
									marginTop: "6px !important",
								},
							},
						}}
					>
						<IconButton
							aria-label="Document statistics"
							sx={{ color: "text.secondary" }}
						>
							<BarChartIcon fontSize="small" />
						</IconButton>
					</Tooltip>
					<Tooltip title="Comments">
						<IconButton
							onClick={onToggleComments}
							aria-label="Toggle comments"
							sx={{
								color: commentsOpen ? "primary.main" : "text.secondary",
							}}
						>
							<ChatBubbleOutlinedIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Box>
			</Box>
			{readyToArchive && (
				<Alert
					severity="warning"
					variant="outlined"
					icon={<ArchiveOutlinedIcon fontSize="small" />}
					sx={{
						mx: 4,
						mt: 2,
						py: 0.25,
						alignItems: "center",
						"& .MuiAlert-message": { py: 0.5 },
					}}
				>
					All tasks are complete - this change is ready to archive.
				</Alert>
			)}
			<Box
				sx={{
					px: 4,
					borderBottom: 1,
					borderColor: "divider",
					display: "flex",
					alignItems: "center",
					gap: 2,
				}}
			>
				<Tabs
					value={tabValue}
					onChange={(_, v) => handleTabChange(v as TabKey)}
					sx={{ flex: 1, minHeight: 48 }}
				>
					{availableDocs.map((artifact) => (
						<Tab
							key={artifact.id}
							value={artifact.id}
							label={tabLabel(artifact, schema, change.documents[artifact.id])}
						/>
					))}
				</Tabs>
				{activeDoc && tabFiles.length > 1 && activeFile && (
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1,
							flexShrink: 0,
						}}
					>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ fontWeight: 500 }}
						>
							{artifactLabel(activeDoc.id)}:
						</Typography>
						<FormControl size="small" sx={{ minWidth: 180 }}>
							<Select
								value={activeFile.name}
								onChange={(e) =>
									setSelectedFile(change.slug, activeDoc.id, e.target.value)
								}
								sx={{
									fontSize: "0.8125rem",
									"& .MuiSelect-select": { py: 0.5 },
								}}
							>
								{tabFiles.map((f) => (
									<MenuItem
										key={f.name}
										value={f.name}
										sx={{ fontSize: "0.8125rem" }}
									>
										{f.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Box>
				)}
			</Box>
			<Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
				<Minimap headings={headings} containerRef={contentRef} />
				<Box ref={contentRef} sx={{ flex: 1, overflowY: "auto", px: 4, py: 2 }}>
					{taskProgress && (
						<Box sx={{ mb: 2 }}>
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									mb: 0.75,
								}}
							>
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{ fontWeight: 500 }}
								>
									{taskProgress.done} of {taskProgress.total} tasks complete
								</Typography>
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{ fontFamily: "ui-monospace, monospace" }}
								>
									{taskProgress.percent}%
								</Typography>
							</Box>
							<LinearProgress
								variant="determinate"
								value={taskProgress.percent}
								sx={{
									height: 6,
									borderRadius: 3,
									bgcolor: "action.hover",
									"& .MuiLinearProgress-bar": {
										borderRadius: 3,
										bgcolor:
											taskProgress.percent === 100
												? "success.main"
												: "primary.main",
									},
								}}
							/>
						</Box>
					)}
					{fileAuthorship && !isChecklistTab && (
						<Box sx={{ mb: 1.5 }}>
							<AttributionLine authorship={fileAuthorship} size="sm" />
						</Box>
					)}
					<Box>
						{activeDoc && currentSource ? (
							<MarkdownView
								source={currentSource}
								documentId={
									tabFiles.length > 1 && activeFile
										? `${change.slug}/${activeDoc.id}/${activeFile.name}`
										: `${change.slug}/${activeDoc.id}`
								}
							/>
						) : (
							<Typography color="text.secondary">
								No content for this tab
							</Typography>
						)}
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
