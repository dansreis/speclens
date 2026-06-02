import BarChartIcon from "@mui/icons-material/BarChart";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import {
	Box,
	Button,
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
import { countTaskCompletion } from "../lib/tasksCompletion";
import { type TabKey, useAppStore } from "../store/useAppStore";
import { MarkdownView } from "./MarkdownView";
import { Minimap } from "./Minimap";

interface Props {
	change: Change;
	commentsOpen: boolean;
	onToggleComments: () => void;
	onOpenStats: () => void;
}

export function ChangeViewer({
	change,
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
	const capabilities = Object.keys(change.specs);
	const contentRef = useRef<HTMLDivElement | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: resets viewer when the selected change changes
	useEffect(() => {
		if (useAppStore.getState().scrollTarget) return;
		contentRef.current?.scrollTo({ top: 0 });
	}, [change]);

	const specsSource = useMemo(
		() => capabilities.map((cap) => change.specs[cap]).join("\n\n"),
		[capabilities, change.specs],
	);

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

	const taskCount = change.tasks ? countTaskCompletion(change.tasks) : null;
	const tasksLabel =
		taskCount && taskCount.total > 0
			? `Tasks (${taskCount.done}/${taskCount.total})`
			: "Tasks";

	return (
		<Box
			sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
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
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography variant="h4" component="h2">
						{change.name}
					</Typography>
					{change.archived && (
						<Typography variant="caption" color="text.secondary">
							archived
						</Typography>
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
				value={tab}
				onChange={(_, v) => handleTabChange(v as TabKey)}
				sx={{ px: 4, borderBottom: 1, borderColor: "divider" }}
			>
				<Tab value="proposal" label="Proposal" />
				<Tab value="tasks" label={tasksLabel} />
				<Tab
					value="specs"
					label={`Specs${capabilities.length ? ` (${capabilities.length})` : ""}`}
				/>
			</Tabs>
			<Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
				<Minimap headings={headings} containerRef={contentRef} />
				<Box ref={contentRef} sx={{ flex: 1, overflowY: "auto", px: 4, py: 2 }}>
					<Box sx={{ maxWidth: 1000, mx: "auto" }}>
						{tab === "proposal" &&
							(change.proposal ? (
								<MarkdownView
									source={change.proposal}
									documentId={`${change.slug}/proposal`}
								/>
							) : (
								<Typography color="text.secondary">No proposal.md</Typography>
							))}
						{tab === "tasks" &&
							(change.tasks ? (
								<MarkdownView
									source={change.tasks}
									documentId={`${change.slug}/tasks`}
								/>
							) : (
								<Typography color="text.secondary">No tasks.md</Typography>
							))}
						{tab === "specs" &&
							(capabilities.length === 0 ? (
								<Typography color="text.secondary">No specs</Typography>
							) : (
								<MarkdownView
									source={specsSource}
									documentId={`${change.slug}/specs`}
								/>
							))}
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
