import { Box, Typography } from "@mui/material";
import type { Repo } from "../lib/exampleLoader";

interface Props {
	repo: Repo | null;
}

export function OverviewView({ repo }: Props) {
	const totalChanges = repo?.changes.length ?? 0;
	const activeChanges = repo?.changes.filter((c) => !c.archived).length ?? 0;
	const archivedChanges = totalChanges - activeChanges;
	const totalSpecs = repo
		? new Set(repo.changes.flatMap((c) => Object.keys(c.specs))).size
		: 0;

	return (
		<Box sx={{ p: 4, maxWidth: 1000, mx: "auto" }}>
			<Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
				Overview
			</Typography>
			<Typography color="text.secondary" sx={{ mb: 4 }}>
				{repo
					? `Summary of ${repo.name} (${repo.type})`
					: "No repository selected"}
			</Typography>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
					gap: 2,
				}}
			>
				<StatBlock label="Total changes" value={totalChanges} />
				<StatBlock label="Active" value={activeChanges} />
				<StatBlock label="Archived" value={archivedChanges} />
				<StatBlock label="Unique specs" value={totalSpecs} />
			</Box>
		</Box>
	);
}

function StatBlock({ label, value }: { label: string; value: number }) {
	return (
		<Box
			sx={{
				p: 3,
				border: 1,
				borderColor: "divider",
				borderRadius: 1,
				bgcolor: "background.paper",
			}}
		>
			<Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
				{value}
			</Typography>
			<Typography variant="caption" color="text.secondary">
				{label}
			</Typography>
		</Box>
	);
}
