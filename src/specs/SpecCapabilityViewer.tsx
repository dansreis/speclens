import BarChartIcon from "@mui/icons-material/BarChart";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import {
	Box,
	Button,
	Chip,
	FormControl,
	IconButton,
	MenuItem,
	Select,
	Tooltip,
	Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef } from "react";
import { extractHeadings } from "../lib/extractHeadings";
import { formatRelativeTime } from "../lib/relativeTime";
import type { Change, RepoSpecDoc } from "../lib/repoLoader";
import { artifactLabel } from "../lib/schema";
import { useAppStore } from "../store/useAppStore";
import { AttributionLine } from "./AttributionLine";
import { DocumentStatsTooltipContent } from "./DocumentStatsTooltip";
import { MarkdownView } from "./MarkdownView";
import { Minimap } from "./Minimap";

interface Props {
	capability: string;
	repoSpec: RepoSpecDoc | null;
	referencingChanges: Change[];
	onOpenChange: (change: Change) => void;
	commentsOpen: boolean;
	onToggleComments: () => void;
}

type TabValue = "canonical" | string; // "canonical" or `change:${slug}`

function changeTabValue(change: Change): string {
	return `change:${change.archived ? "archive/" : ""}${change.slug}`;
}

export function SpecCapabilityViewer({
	capability,
	repoSpec,
	referencingChanges,
	onOpenChange,
	commentsOpen,
	onToggleComments,
}: Props) {
	const markdownZoom = useAppStore((s) => s.markdownZoom);
	const zoomIn = useAppStore((s) => s.zoomIn);
	const zoomOut = useAppStore((s) => s.zoomOut);
	const resetZoom = useAppStore((s) => s.resetZoom);
	const storedTab = useAppStore((s) => s.specViewerTab);
	const setStoredTab = useAppStore((s) => s.setSpecViewerTab);
	const contentRef = useRef<HTMLDivElement | null>(null);

	const defaultTab: TabValue = repoSpec
		? "canonical"
		: referencingChanges[0]
			? changeTabValue(referencingChanges[0])
			: "canonical";
	const tab: TabValue = storedTab ?? defaultTab;
	const setTab = (v: TabValue) => setStoredTab(v);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset stored tab when capability switches so we don't carry over a stale tab from another capability
	useEffect(() => {
		setStoredTab(null);
	}, [capability]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll resets when tab/capability changes
	useEffect(() => {
		if (useAppStore.getState().scrollTarget) return;
		contentRef.current?.scrollTo({ top: 0 });
	}, [tab, capability]);

	const sortedChanges = useMemo(
		() =>
			[...referencingChanges].sort((a, b) => {
				const aT = a.createdAt?.getTime() ?? 0;
				const bT = b.createdAt?.getTime() ?? 0;
				return bT - aT;
			}),
		[referencingChanges],
	);

	const canonicalDate = useMemo(() => {
		if (!repoSpec?.authorship?.lastEditedAt) return null;
		const d = new Date(repoSpec.authorship.lastEditedAt);
		return Number.isNaN(d.getTime()) ? null : d;
	}, [repoSpec]);

	const activeChange = useMemo(() => {
		if (tab === "canonical") return null;
		const slug = tab.replace(/^change:/, "");
		return (
			referencingChanges.find(
				(c) => `${c.archived ? "archive/" : ""}${c.slug}` === slug,
			) ?? null
		);
	}, [tab, referencingChanges]);

	const source: string =
		tab === "canonical"
			? (repoSpec?.content ?? "")
			: (activeChange?.specs[capability] ?? "");

	const documentId =
		tab === "canonical"
			? `spec:${capability}`
			: activeChange
				? `spec:${capability}:${activeChange.archived ? "archive/" : ""}${activeChange.slug}`
				: `spec:${capability}`;

	const documentKind = tab === "canonical" ? "repo-spec" : "change";

	const headings = useMemo(
		() => (source ? extractHeadings(source) : []),
		[source],
	);

	const headerAuthorship =
		tab === "canonical"
			? repoSpec?.authorship
			: (activeChange?.authorship?.rolled ?? null);

	const statsLabel =
		tab === "canonical"
			? artifactLabel("specs")
			: `${activeChange?.name ?? "Change"} delta`;

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
					<Typography variant="h4" component="h2">
						{capability}
					</Typography>
					{headerAuthorship && (
						<AttributionLine authorship={headerAuthorship} size="sm" />
					)}
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ minHeight: "1.25rem" }}
					>
						{tab === "canonical"
							? (repoSpec?.path ?? " ")
							: activeChange
								? `Proposed in ${activeChange.name}`
								: " "}
					</Typography>
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
					<Tooltip
						title={
							<DocumentStatsTooltipContent
								sections={source ? [{ label: statsLabel, source }] : []}
							/>
						}
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
			{(repoSpec || referencingChanges.length > 0) && (
				<Box
					sx={{
						px: 4,
						py: 1.5,
						borderBottom: 1,
						borderColor: "divider",
						display: "flex",
						alignItems: "center",
						gap: 1.5,
					}}
				>
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ fontWeight: 500 }}
					>
						Viewing:
					</Typography>
					<FormControl size="small" sx={{ minWidth: 320 }}>
						<Select
							value={tab}
							onChange={(e) => setTab(e.target.value as TabValue)}
							sx={{
								fontSize: "0.8125rem",
								"& .MuiSelect-select": { py: 0.75 },
							}}
						>
							{repoSpec && (
								<MenuItem value="canonical" sx={{ fontSize: "0.8125rem" }}>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: 2,
											width: "100%",
										}}
									>
										<Box
											sx={{
												display: "flex",
												alignItems: "center",
												gap: 1,
												minWidth: 0,
											}}
										>
											<Chip
												label="Spec"
												size="small"
												variant="outlined"
												sx={{
													height: 18,
													width: 64,
													fontSize: "0.6875rem",
													fontWeight: 500,
													borderWidth: 1.5,
													color: "primary.main",
													borderColor: "primary.main",
													"& .MuiChip-label": { px: 0.75 },
												}}
											/>
											<Box component="span">{capability}</Box>
										</Box>
										{canonicalDate && (
											<Typography
												variant="caption"
												color="text.disabled"
												sx={{ flexShrink: 0 }}
											>
												{formatRelativeTime(canonicalDate)}
											</Typography>
										)}
									</Box>
								</MenuItem>
							)}
							{sortedChanges.map((c) => (
								<MenuItem
									key={changeTabValue(c)}
									value={changeTabValue(c)}
									sx={{ fontSize: "0.8125rem" }}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: 2,
											width: "100%",
										}}
									>
										<Box
											sx={{
												display: "flex",
												alignItems: "center",
												gap: 1,
												minWidth: 0,
											}}
										>
											<Chip
												label={c.archived ? "Archived" : "Active"}
												size="small"
												variant="outlined"
												sx={{
													height: 18,
													width: 64,
													fontSize: "0.6875rem",
													fontWeight: 500,
													borderWidth: 1.5,
													color: c.archived ? "#d97706" : "success.main",
													borderColor: c.archived ? "#d97706" : "success.main",
													"& .MuiChip-label": { px: 0.75 },
												}}
											/>
											<Box
												component="span"
												sx={{
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{c.name}
											</Box>
										</Box>
										{c.createdAt && (
											<Typography
												variant="caption"
												color="text.disabled"
												sx={{ flexShrink: 0 }}
											>
												{formatRelativeTime(c.createdAt)}
											</Typography>
										)}
									</Box>
								</MenuItem>
							))}
						</Select>
					</FormControl>
					{activeChange && (
						<Button
							size="small"
							onClick={() => onOpenChange(activeChange)}
							sx={{ textTransform: "none", flexShrink: 0 }}
						>
							Open change →
						</Button>
					)}
				</Box>
			)}
			<Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
				<Minimap headings={headings} containerRef={contentRef} />
				<Box ref={contentRef} sx={{ flex: 1, overflowY: "auto", px: 4, py: 2 }}>
					{source ? (
						<MarkdownView
							source={source}
							documentId={documentId}
							documentKind={documentKind}
						/>
					) : (
						<Typography color="text.secondary">
							No spec content for this capability.
						</Typography>
					)}
				</Box>
			</Box>
		</Box>
	);
}
