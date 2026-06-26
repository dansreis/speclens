import {
	Box,
	ButtonBase,
	Chip,
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
import type { Change, Repo } from "../lib/repoLoader";
import { DEFAULT_SCHEMA } from "../lib/schema";
import { countTaskCompletion } from "../lib/tasksCompletion";
import { ChangeViewer } from "../specs/ChangeViewer";
import { useAppStore } from "../store/useAppStore";

type StatusFilter = "all" | "active" | "archived" | "archived-incomplete";

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function progressLabel(change: Change): string | null {
	if (!change.tasks) return null;
	const { total, done } = countTaskCompletion(change.tasks);
	if (total === 0) return null;
	return `${done}/${total} tasks`;
}

function hasIncompleteTasks(change: Change): boolean {
	if (!change.tasks) return false;
	const { total, done } = countTaskCompletion(change.tasks);
	return total > 0 && done < total;
}

interface Props {
	repo: Repo | null;
	commentsOpen: boolean;
	onToggleComments: () => void;
}

export function ChangesView({ repo, commentsOpen, onToggleComments }: Props) {
	const selectedChangeKey = useAppStore((s) => s.selectedChangeKey);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const [filter, setFilter] = useState("");
	const [status, setStatus] = useState<StatusFilter>("all");

	const allChanges = repo?.changes ?? [];

	const filtered = useMemo(() => {
		const q = filter.trim().toLowerCase();
		const base = allChanges.filter((c) => {
			if (status === "active" && c.archived) return false;
			if (status === "archived" && !c.archived) return false;
			if (
				status === "archived-incomplete" &&
				(!c.archived || !hasIncompleteTasks(c))
			)
				return false;
			if (q && !c.name.toLowerCase().includes(q)) return false;
			return true;
		});
		return base.sort((a, b) => {
			const aT = a.createdAt?.getTime() ?? 0;
			const bT = b.createdAt?.getTime() ?? 0;
			return bT - aT || a.name.localeCompare(b.name);
		});
	}, [allChanges, filter, status]);

	if (selectedChangeKey) {
		const change = allChanges.find((c) => changeKey(c) === selectedChangeKey);
		if (!change) {
			return (
				<Box sx={{ p: 4 }}>
					<Typography color="text.secondary">
						Change not found in the current repository.
					</Typography>
				</Box>
			);
		}
		return (
			<ChangeViewer
				change={change}
				schema={change.schema ?? repo?.schema ?? DEFAULT_SCHEMA}
				commentsOpen={commentsOpen}
				onToggleComments={onToggleComments}
			/>
		);
	}

	const handleSelect = (key: string) => {
		setSelectedChangeKey(key);
		setActiveTab("proposal");
	};

	return (
		<Box sx={{ p: 4, width: "100%" }}>
			<Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 2 }}>
				<TextField
					placeholder="Filter changes..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					size="small"
					sx={{ flex: 1 }}
				/>
				<ToggleButtonGroup
					size="small"
					value={status}
					exclusive
					onChange={(_, v) => v && setStatus(v as StatusFilter)}
				>
					<ToggleButton value="all" sx={{ textTransform: "none" }}>
						All
					</ToggleButton>
					<ToggleButton value="active" sx={{ textTransform: "none" }}>
						Active
					</ToggleButton>
					<ToggleButton value="archived" sx={{ textTransform: "none" }}>
						Archived
					</ToggleButton>
					<Tooltip title="Archived changes with incomplete tasks" arrow>
						<ToggleButton
							value="archived-incomplete"
							sx={{ textTransform: "none" }}
						>
							Incomplete
						</ToggleButton>
					</Tooltip>
				</ToggleButtonGroup>
			</Box>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
				{filtered.length === 0 ? (
					<Typography
						color="text.secondary"
						sx={{ py: 4, textAlign: "center" }}
					>
						No changes match this filter.
					</Typography>
				) : (
					filtered.map((change) => {
						const key = changeKey(change);
						const preview = firstParagraphPreview(change.proposal);
						const progress = progressLabel(change);
						return (
							<ButtonBase
								key={key}
								onClick={() => handleSelect(key)}
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
									<Typography variant="body2" sx={{ fontWeight: 600 }}>
										{change.name}
									</Typography>
									{Object.keys(change.specs).length > 0 && (
										<Box
											sx={{
												display: "flex",
												flexWrap: "wrap",
												gap: 0.5,
												mt: 0.5,
											}}
										>
											{Object.keys(change.specs).map((spec) => (
												<Chip
													key={spec}
													label={spec}
													size="small"
													variant="outlined"
													sx={{
														height: 18,
														fontSize: "0.6875rem",
														fontWeight: 500,
														borderWidth: 1.5,
														color: "text.secondary",
														borderColor: "divider",
														"& .MuiChip-label": { px: 0.75 },
													}}
												/>
											))}
										</Box>
									)}
									{preview && (
										<Typography
											variant="caption"
											color="text.secondary"
											sx={{
												display: "-webkit-box",
												WebkitLineClamp: 1,
												WebkitBoxOrient: "vertical",
												overflow: "hidden",
												mt: 0.5,
											}}
										>
											{preview}
										</Typography>
									)}
								</Box>
								<Box
									sx={{
										display: "flex",
										flexDirection: "column",
										alignItems: "flex-end",
										gap: 0.5,
										flexShrink: 0,
										minWidth: 110,
									}}
								>
									<Chip
										label={change.archived ? "Archived" : "Active"}
										size="small"
										variant="outlined"
										sx={{
											height: 20,
											fontSize: "0.6875rem",
											fontWeight: 500,
											borderWidth: 1.5,
											color: change.archived ? "#d97706" : "success.main",
											borderColor: change.archived ? "#d97706" : "success.main",
										}}
									/>
									{progress && (
										<Typography variant="caption" color="text.secondary">
											{progress}
										</Typography>
									)}
									{change.createdAt && (
										<Tooltip
											title={formatAbsoluteDateTime(change.createdAt)}
											arrow
											placement="left"
										>
											<Typography
												variant="caption"
												color="text.disabled"
												sx={{ cursor: "default" }}
											>
												{formatRelativeTime(change.createdAt)}
											</Typography>
										</Tooltip>
									)}
								</Box>
							</ButtonBase>
						);
					})
				)}
			</Box>
		</Box>
	);
}
