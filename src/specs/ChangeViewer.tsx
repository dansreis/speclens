import BarChartIcon from "@mui/icons-material/BarChart";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import {
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
import type { ChangeSchema, DocumentDef } from "../lib/schema";
import { countTaskCompletion } from "../lib/tasksCompletion";
import { type TabKey, useAppStore } from "../store/useAppStore";
import { MarkdownView } from "./MarkdownView";
import { Minimap } from "./Minimap";

interface Props {
	change: Change;
	schema: ChangeSchema;
	commentsOpen: boolean;
	onToggleComments: () => void;
	onOpenStats: () => void;
}

function tabLabel(doc: DocumentDef, source: string): string {
	if (doc.completion === "checklist") {
		const { done, total } = countTaskCompletion(source);
		if (total > 0) return `${doc.label} (${done}/${total})`;
	}
	if (doc.directory && doc.join) {
		const count = source.split(/\n\s*\n/).filter((s) => s.trim()).length;
		if (count > 1) return `${doc.label} (${count})`;
	}
	return doc.label;
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
		() => schema.documents.filter((d) => change.documents[d.id] !== undefined),
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
			<Tabs
				value={tabValue}
				onChange={(_, v) => handleTabChange(v as TabKey)}
				sx={{ px: 4, borderBottom: 1, borderColor: "divider" }}
			>
				{availableDocs.map((doc) => (
					<Tab
						key={doc.id}
						value={doc.id}
						label={tabLabel(doc, change.documents[doc.id])}
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
