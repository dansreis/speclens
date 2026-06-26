import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import {
	Box,
	CircularProgress,
	FormControlLabel,
	Switch,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from "@mui/material";
import { lazy, Suspense, useState } from "react";
import type { Repo } from "../lib/repoLoader";
import type { GraphLayout } from "./graph/GraphCanvasView";

const GraphCanvasView = lazy(() => import("./graph/GraphCanvasView"));

interface Props {
	repo: Repo;
}

interface LegendItem {
	color: string;
	label: string;
}

function Legend({ items }: { items: LegendItem[] }) {
	return (
		<Box
			sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}
		>
			{items.map((item) => (
				<Box
					key={item.label}
					sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
				>
					<Box
						sx={{
							width: 10,
							height: 10,
							borderRadius: "50%",
							bgcolor: item.color,
							flexShrink: 0,
						}}
					/>
					<Typography variant="caption" color="text.secondary">
						{item.label}
					</Typography>
				</Box>
			))}
		</Box>
	);
}

export function GraphView({ repo }: Props) {
	const [showPeople, setShowPeople] = useState(false);
	const [layout, setLayout] = useState<GraphLayout>("spread");

	const hasData =
		repo.repoSpecs.length > 0 ||
		repo.changes.some((c) => Object.keys(c.specs).length > 0);

	if (!hasData) {
		return (
			<Box
				sx={{
					p: 4,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					minHeight: 400,
					gap: 2,
				}}
			>
				<HubOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
				<Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
					Graph
				</Typography>
				<Typography variant="body2" color="text.secondary">
					No capabilities or spec changes to map yet.
				</Typography>
			</Box>
		);
	}

	const legend: LegendItem[] = [
		{ color: "#2563eb", label: "Capability" },
		{ color: "#f59e0b", label: "Proposed" },
		{ color: "#16a34a", label: "Active change" },
		{ color: "#9ca3af", label: "Archived" },
	];
	if (showPeople) legend.push({ color: "#a855f7", label: "Contributor" });

	return (
		<Box
			sx={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				minHeight: 0,
				height: "100%",
			}}
		>
			<Box
				sx={{
					px: 3,
					py: 1.5,
					display: "flex",
					alignItems: "center",
					gap: 2,
					borderBottom: 1,
					borderColor: "divider",
				}}
			>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Legend items={legend} />
				</Box>
				<ToggleButtonGroup
					size="small"
					exclusive
					value={layout}
					onChange={(_, next: GraphLayout | null) => {
						if (next) setLayout(next);
					}}
					sx={{ flexShrink: 0, "& .MuiToggleButton-root": { py: 0.25, px: 1 } }}
				>
					<ToggleButton value="spread">Non-grouped</ToggleButton>
					<ToggleButton value="grouped">Grouped</ToggleButton>
				</ToggleButtonGroup>
				<FormControlLabel
					sx={{ flexShrink: 0, mr: 0 }}
					control={
						<Switch
							size="small"
							checked={showPeople}
							onChange={(e) => setShowPeople(e.target.checked)}
						/>
					}
					label={<Typography variant="body2">Contributors</Typography>}
				/>
			</Box>
			<Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
				<Suspense
					fallback={
						<Box
							sx={{
								position: "absolute",
								inset: 0,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<CircularProgress size={28} />
						</Box>
					}
				>
					<GraphCanvasView
						repo={repo}
						showPeople={showPeople}
						layout={layout}
					/>
				</Suspense>
			</Box>
		</Box>
	);
}
