import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
	Box,
	Link,
	Breadcrumbs as MuiBreadcrumbs,
	Tooltip,
	Typography,
} from "@mui/material";
import type { Change } from "../lib/repoLoader";
import { type AppView, useAppStore } from "../store/useAppStore";

const titles: Record<AppView, string> = {
	overview: "Overview",
	specs: "Specs",
	changes: "Changes",
	checks: "Checks",
	flow: "Flow",
	graph: "Graph",
	timeline: "Timeline",
	schemas: "Schemas",
	folder: "Library",
};

function folderTitle(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

interface Props {
	activeChange: Change | null;
}

export function Breadcrumbs({ activeChange }: Props) {
	const view = useAppStore((s) => s.view);
	const selectedSpec = useAppStore((s) => s.selectedSpec);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const selectedSchema = useAppStore((s) => s.selectedSchema);
	const setSelectedSchema = useAppStore((s) => s.setSelectedSchema);
	const selectedFolder = useAppStore((s) => s.selectedFolder);
	const selectedFolderDoc = useAppStore((s) => s.selectedFolderDoc);
	const setSelectedFolderDoc = useAppStore((s) => s.setSelectedFolderDoc);

	const rootTitle =
		view === "folder" && selectedFolder
			? folderTitle(selectedFolder)
			: titles[view];

	const detailLabel =
		view === "specs" && selectedSpec
			? selectedSpec
			: view === "changes" && activeChange
				? activeChange.name
				: view === "schemas" && selectedSchema
					? selectedSchema
					: view === "folder" && selectedFolderDoc
						? selectedFolderDoc
						: null;

	const goRoot = () => {
		if (view === "specs") setSelectedSpec(null);
		if (view === "changes") setSelectedChangeKey(null);
		if (view === "schemas") setSelectedSchema(null);
		if (view === "folder") setSelectedFolderDoc(null);
	};

	return (
		<MuiBreadcrumbs
			separator={<NavigateNextIcon fontSize="small" />}
			sx={{ fontSize: "0.875rem" }}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
				{detailLabel ? (
					<Link
						component="button"
						onClick={goRoot}
						underline="hover"
						color="text.secondary"
						sx={{
							fontSize: "0.875rem",
							fontFamily: "inherit",
							background: "none",
							border: "none",
							p: 0,
							cursor: "pointer",
						}}
					>
						{rootTitle}
					</Link>
				) : (
					<Typography variant="body2" sx={{ fontWeight: 600 }}>
						{rootTitle}
					</Typography>
				)}
				{view === "flow" && (
					<Tooltip
						title={<FlowInfo />}
						placement="bottom-start"
						arrow
						enterDelay={150}
						slotProps={{
							tooltip: {
								sx: {
									maxWidth: 360,
									bgcolor: "background.paper",
									color: "text.primary",
									border: 1,
									borderColor: "divider",
									boxShadow: 4,
									p: 1.5,
								},
							},
							arrow: {
								sx: {
									color: "background.paper",
									"&::before": {
										border: 1,
										borderColor: "divider",
									},
								},
							},
						}}
					>
						<InfoOutlinedIcon
							sx={{
								fontSize: 15,
								color: "text.secondary",
								cursor: "help",
								"&:hover": { color: "text.primary" },
							}}
						/>
					</Tooltip>
				)}
			</Box>
			{detailLabel && (
				<Typography variant="body2" sx={{ fontWeight: 600 }}>
					{detailLabel}
				</Typography>
			)}
		</MuiBreadcrumbs>
	);
}

function FlowInfo() {
	return (
		<Box sx={{ py: 0.25 }}>
			<Box sx={{ fontWeight: 600, mb: 0.75, fontSize: "0.8rem" }}>
				What is the Flow view?
			</Box>
			<Box sx={{ fontSize: "0.75rem", lineHeight: 1.55 }}>
				A timeline of how this repo's specs have evolved. Each horizontal lane
				is a <strong>capability</strong> - a named slice of the spec like "auth"
				or "billing", defined by its own{" "}
				<Box
					component="code"
					sx={{
						fontFamily: "ui-monospace, monospace",
						fontSize: "0.72rem",
					}}
				>
					specs/&lt;name&gt;/spec.md
				</Box>{" "}
				file.
			</Box>
			<Box sx={{ fontSize: "0.75rem", lineHeight: 1.55, mt: 0.75 }}>
				Changes are pills along the top, connected by lines to the lanes they
				touched. Dot color shows the kind of delta (added · modified · removed ·
				renamed); pill style shows the lifecycle (archived · in progress ·
				draft).
			</Box>
			<Box sx={{ fontSize: "0.75rem", lineHeight: 1.55, mt: 0.75 }}>
				Useful for spotting cross-cutting changes (wide vertical spines),
				high-churn capabilities (dense lanes), and what work is currently in
				flight.
			</Box>
		</Box>
	);
}
