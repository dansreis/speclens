import ClearIcon from "@mui/icons-material/Clear";
import {
	Box,
	ButtonBase,
	IconButton,
	InputAdornment,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Tooltip,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { firstParagraphPreview } from "../lib/markdownPreview";
import {
	formatAbsoluteDateTime,
	formatRelativeTime,
} from "../lib/relativeTime";
import type { Change, Repo, RepoSpecDoc } from "../lib/repoLoader";
import { SpecCapabilityViewer } from "../specs/SpecCapabilityViewer";
import { useAppStore } from "../store/useAppStore";

type SortMode = "name" | "changes" | "recent";

interface SpecRow {
	capability: string;
	repoSpec: RepoSpecDoc | null;
	referencingChanges: Change[];
	preview: string;
	latestDate: Date | null;
}

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function buildSpecRows(repo: Repo | null): SpecRow[] {
	if (!repo) return [];
	const map = new Map<string, SpecRow>();
	for (const change of repo.changes) {
		const content = change.specs;
		for (const [capability, body] of Object.entries(content)) {
			const existing = map.get(capability);
			if (existing) {
				existing.referencingChanges.push(change);
				if (
					change.createdAt &&
					(!existing.latestDate || change.createdAt > existing.latestDate)
				) {
					existing.latestDate = change.createdAt;
				}
			} else {
				map.set(capability, {
					capability,
					repoSpec: null,
					referencingChanges: [change],
					preview: firstParagraphPreview(body),
					latestDate: change.createdAt,
				});
			}
		}
	}
	for (const repoSpec of repo.repoSpecs) {
		const existing = map.get(repoSpec.capability);
		if (existing) {
			existing.repoSpec = repoSpec;
			if (!existing.preview) {
				existing.preview = firstParagraphPreview(repoSpec.content);
			}
		} else {
			map.set(repoSpec.capability, {
				capability: repoSpec.capability,
				repoSpec,
				referencingChanges: [],
				preview: firstParagraphPreview(repoSpec.content),
				latestDate: null,
			});
		}
	}
	return [...map.values()];
}

interface Props {
	repo: Repo | null;
	commentsOpen: boolean;
	onToggleComments: () => void;
}

export function SpecsView({ repo, commentsOpen, onToggleComments }: Props) {
	const selectedSpec = useAppStore((s) => s.selectedSpec);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const setView = useAppStore((s) => s.setView);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const [filter, setFilter] = useState("");
	const [sort, setSort] = useState<SortMode>("name");

	const openChange = (change: Change) => {
		setSelectedChangeKey(changeKey(change));
		setActiveTab("specs");
		setView("changes");
	};

	const rows = useMemo(() => buildSpecRows(repo), [repo]);

	const filtered = useMemo(() => {
		const q = filter.trim().toLowerCase();
		const base = q
			? rows.filter((r) => r.capability.toLowerCase().includes(q))
			: rows;
		const sorted = [...base];
		if (sort === "name") {
			sorted.sort((a, b) => a.capability.localeCompare(b.capability));
		} else if (sort === "changes") {
			sorted.sort(
				(a, b) =>
					b.referencingChanges.length - a.referencingChanges.length ||
					a.capability.localeCompare(b.capability),
			);
		} else {
			sorted.sort((a, b) => {
				const aT = a.latestDate?.getTime() ?? 0;
				const bT = b.latestDate?.getTime() ?? 0;
				return bT - aT || a.capability.localeCompare(b.capability);
			});
		}
		return sorted;
	}, [rows, filter, sort]);

	if (selectedSpec) {
		const row = rows.find((r) => r.capability === selectedSpec);
		if (!row) {
			return (
				<Box sx={{ p: 4 }}>
					<Typography color="text.secondary">
						Spec “{selectedSpec}” not found in the current repository.
					</Typography>
				</Box>
			);
		}
		return (
			<SpecCapabilityViewer
				capability={row.capability}
				repoSpec={row.repoSpec}
				referencingChanges={row.referencingChanges}
				onOpenChange={openChange}
				commentsOpen={commentsOpen}
				onToggleComments={onToggleComments}
			/>
		);
	}

	const handleSelect = (capability: string) => {
		setSelectedSpec(capability);
		setActiveTab("specs");
	};

	return (
		<Box sx={{ p: 4, width: "100%" }}>
			<Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 2 }}>
				<TextField
					placeholder="Filter specs..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					size="small"
					sx={{ flex: 1 }}
					slotProps={{
						input: {
							endAdornment: filter ? (
								<InputAdornment position="end">
									<IconButton
										size="small"
										onClick={() => setFilter("")}
										aria-label="Clear filter"
										edge="end"
									>
										<ClearIcon fontSize="small" />
									</IconButton>
								</InputAdornment>
							) : null,
						},
					}}
				/>
				<ToggleButtonGroup
					size="small"
					value={sort}
					exclusive
					onChange={(_, v) => v && setSort(v as SortMode)}
				>
					<ToggleButton value="name" sx={{ textTransform: "none" }}>
						A→Z
					</ToggleButton>
					<ToggleButton value="changes" sx={{ textTransform: "none" }}>
						By changes
					</ToggleButton>
					<ToggleButton value="recent" sx={{ textTransform: "none" }}>
						Recent
					</ToggleButton>
				</ToggleButtonGroup>
			</Box>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
				{filtered.length === 0 ? (
					<Typography
						color="text.secondary"
						sx={{ py: 4, textAlign: "center" }}
					>
						No specs match this filter.
					</Typography>
				) : (
					filtered.map((row) => (
						<ButtonBase
							key={row.capability}
							onClick={() => handleSelect(row.capability)}
							sx={{
								display: "flex",
								alignItems: "stretch",
								gap: 2,
								textAlign: "left",
								px: 2,
								py: 1.5,
								border: 1,
								borderColor: "divider",
								borderRadius: 1,
								bgcolor: "background.paper",
								transition: "border-color 150ms, background-color 150ms",
								"&:hover": {
									borderColor: "primary.main",
									bgcolor: "action.hover",
								},
							}}
						>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<Typography
									variant="body2"
									sx={{ fontWeight: 600, mb: row.preview ? 0.25 : 0 }}
								>
									{row.capability}
								</Typography>
								{row.preview && (
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{
											display: "-webkit-box",
											WebkitLineClamp: 1,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
										}}
									>
										{row.preview}
									</Typography>
								)}
							</Box>
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-end",
									gap: 0.25,
									flexShrink: 0,
									minWidth: 100,
								}}
							>
								<Typography variant="caption" color="text.secondary">
									{row.referencingChanges.length} change
									{row.referencingChanges.length === 1 ? "" : "s"}
								</Typography>
								{row.latestDate && (
									<Tooltip
										title={formatAbsoluteDateTime(row.latestDate)}
										arrow
										placement="left"
									>
										<Typography
											variant="caption"
											color="text.disabled"
											sx={{ cursor: "default" }}
										>
											{formatRelativeTime(row.latestDate)}
										</Typography>
									</Tooltip>
								)}
							</Box>
						</ButtonBase>
					))
				)}
			</Box>
		</Box>
	);
}
