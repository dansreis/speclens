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
	IconButton,
	Tab,
	Tabs,
	Tooltip,
	Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef } from "react";
import { getCurrentSource } from "../lib/documentSource";
import type { Change } from "../lib/exampleLoader";
import { extractHeadings } from "../lib/extractHeadings";
import {
	type Artifact,
	artifactLabel,
	isChecklistArtifact,
	type OpenSpecSchema,
} from "../lib/schema";
import { countTaskCompletion } from "../lib/tasksCompletion";
import { type TabKey, useAppStore } from "../store/useAppStore";
import { MarkdownView } from "./MarkdownView";
import { Minimap } from "./Minimap";

interface Props {
	change: Change;
	schema: OpenSpecSchema;
	commentsOpen: boolean;
	onToggleComments: () => void;
	onOpenStats: () => void;
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
	onOpenStats,
}: Props) {
	const tab = useAppStore((s) => s.activeTab);
	const setTab = useAppStore((s) => s.setActiveTab);
	const markdownZoom = useAppStore((s) => s.markdownZoom);
	const zoomIn = useAppStore((s) => s.zoomIn);
	const zoomOut = useAppStore((s) => s.zoomOut);
	const resetZoom = useAppStore((s) => s.resetZoom);
	const contentRef = useRef<HTMLDivElement | null>(null);

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

	const currentSource = useMemo(
		() => getCurrentSource(change, tab),
		[change, tab],
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

	const readyToArchive = useMemo(() => {
		if (change.archived || !change.tasks) return false;
		const { total, done } = countTaskCompletion(change.tasks);
		return total > 0 && done === total;
	}, [change.archived, change.tasks]);

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
						alignItems: "center",
						gap: 1.5,
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
					<Tooltip title="Document statistics">
						<IconButton
							onClick={onOpenStats}
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
					All tasks are complete — this change is ready to archive.
				</Alert>
			)}
			<Tabs
				value={tabValue}
				onChange={(_, v) => handleTabChange(v as TabKey)}
				sx={{ px: 4, borderBottom: 1, borderColor: "divider" }}
			>
				{availableDocs.map((artifact) => (
					<Tab
						key={artifact.id}
						value={artifact.id}
						label={tabLabel(artifact, schema, change.documents[artifact.id])}
					/>
				))}
			</Tabs>
			<Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
				<Minimap headings={headings} containerRef={contentRef} />
				<Box ref={contentRef} sx={{ flex: 1, overflowY: "auto", px: 4, py: 2 }}>
					<Box>
						{activeDoc && currentSource ? (
							<MarkdownView
								source={currentSource}
								documentId={`${change.slug}/${activeDoc.id}`}
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
