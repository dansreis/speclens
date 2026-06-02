import {
	Box,
	ButtonBase,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { Change, Repo } from "../lib/exampleLoader";
import { countTaskCompletion } from "../lib/tasksCompletion";
import { ChangeViewer } from "../specs/ChangeViewer";
import { useAppStore } from "../store/useAppStore";

type StatusFilter = "all" | "active" | "archived";

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function statusBadge(change: Change): string {
	if (change.archived) return "archived";
	if (!change.tasks) return "no tasks";
	const { total, done } = countTaskCompletion(change.tasks);
	if (total === 0) return "no tasks";
	return `${done}/${total} tasks`;
}

interface Props {
	repo: Repo | null;
	commentsOpen: boolean;
	onToggleComments: () => void;
	onOpenStats: () => void;
}

export function ChangesView({
	repo,
	commentsOpen,
	onToggleComments,
	onOpenStats,
}: Props) {
	const selectedChangeKey = useAppStore((s) => s.selectedChangeKey);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const [filter, setFilter] = useState("");
	const [status, setStatus] = useState<StatusFilter>("active");

	const allChanges = repo?.changes ?? [];

	const filtered = useMemo(() => {
		const q = filter.trim().toLowerCase();
		return allChanges.filter((c) => {
			if (status === "active" && c.archived) return false;
			if (status === "archived" && !c.archived) return false;
			if (q && !c.name.toLowerCase().includes(q)) return false;
			return true;
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
				commentsOpen={commentsOpen}
				onToggleComments={onToggleComments}
				onOpenStats={onOpenStats}
			/>
		);
	}

	const handleSelect = (key: string) => {
		setSelectedChangeKey(key);
		setActiveTab("proposal");
	};

	return (
		<Box sx={{ p: 4, maxWidth: 1000, mx: "auto", width: "100%" }}>
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
						return (
							<ButtonBase
								key={key}
								onClick={() => handleSelect(key)}
								sx={{
									display: "block",
									textAlign: "left",
									px: 2,
									py: 1.5,
									border: 1,
									borderColor: "divider",
									borderRadius: 1,
									bgcolor: "background.paper",
									opacity: change.archived ? 0.7 : 1,
									transition: "border-color 150ms, background-color 150ms",
									"&:hover": {
										borderColor: "primary.main",
										bgcolor: "action.hover",
									},
								}}
							>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
									}}
								>
									<Typography variant="body2" sx={{ fontWeight: 600 }}>
										{change.name}
									</Typography>
									<Typography variant="caption" color="text.secondary">
										{statusBadge(change)}
									</Typography>
								</Box>
							</ButtonBase>
						);
					})
				)}
			</Box>
		</Box>
	);
}
