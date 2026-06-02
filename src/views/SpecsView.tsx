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
import { ChangeViewer } from "../specs/ChangeViewer";
import { useAppStore } from "../store/useAppStore";

type SortMode = "name" | "changes";

interface SpecRow {
	capability: string;
	changes: Change[];
}

function buildSpecRows(repo: Repo | null): SpecRow[] {
	if (!repo) return [];
	const map = new Map<string, SpecRow>();
	for (const change of repo.changes) {
		for (const capability of Object.keys(change.specs)) {
			const row = map.get(capability);
			if (row) row.changes.push(change);
			else map.set(capability, { capability, changes: [change] });
		}
	}
	return [...map.values()];
}

interface Props {
	repo: Repo | null;
	commentsOpen: boolean;
	onToggleComments: () => void;
	onOpenStats: () => void;
}

export function SpecsView({
	repo,
	commentsOpen,
	onToggleComments,
	onOpenStats,
}: Props) {
	const selectedSpec = useAppStore((s) => s.selectedSpec);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const [filter, setFilter] = useState("");
	const [sort, setSort] = useState<SortMode>("name");

	const rows = useMemo(() => buildSpecRows(repo), [repo]);

	const filtered = useMemo(() => {
		const q = filter.trim().toLowerCase();
		const base = q
			? rows.filter((r) => r.capability.toLowerCase().includes(q))
			: rows;
		const sorted = [...base];
		if (sort === "name") {
			sorted.sort((a, b) => a.capability.localeCompare(b.capability));
		} else {
			sorted.sort(
				(a, b) =>
					b.changes.length - a.changes.length ||
					a.capability.localeCompare(b.capability),
			);
		}
		return sorted;
	}, [rows, filter, sort]);

	if (selectedSpec) {
		const row = rows.find((r) => r.capability === selectedSpec);
		const change = row?.changes[0] ?? null;
		if (!change) {
			return (
				<Box sx={{ p: 4 }}>
					<Typography color="text.secondary">
						Spec “{selectedSpec}” not found in the current repository.
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

	const handleSelect = (capability: string) => {
		setSelectedSpec(capability);
		setActiveTab("specs");
	};

	return (
		<Box sx={{ p: 4, maxWidth: 1000, mx: "auto", width: "100%" }}>
			<Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 2 }}>
				<TextField
					placeholder="Filter specs..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					size="small"
					sx={{ flex: 1 }}
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
								display: "block",
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
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
								}}
							>
								<Typography variant="body2" sx={{ fontWeight: 600 }}>
									{row.capability}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{row.changes.length} change
									{row.changes.length === 1 ? "" : "s"}
								</Typography>
							</Box>
						</ButtonBase>
					))
				)}
			</Box>
		</Box>
	);
}
