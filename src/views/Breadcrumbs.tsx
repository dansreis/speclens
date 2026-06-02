import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Link, Breadcrumbs as MuiBreadcrumbs, Typography } from "@mui/material";
import type { Change } from "../lib/exampleLoader";
import { type AppView, useAppStore } from "../store/useAppStore";

const titles: Record<AppView, string> = {
	overview: "Overview",
	specs: "Specs",
	changes: "Changes",
	graph: "Graph",
	timeline: "Timeline",
};

interface Props {
	activeChange: Change | null;
}

export function Breadcrumbs({ activeChange }: Props) {
	const view = useAppStore((s) => s.view);
	const selectedSpec = useAppStore((s) => s.selectedSpec);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);

	const detailLabel =
		view === "specs" && selectedSpec
			? selectedSpec
			: view === "changes" && activeChange
				? activeChange.name
				: null;

	const goRoot = () => {
		if (view === "specs") setSelectedSpec(null);
		if (view === "changes") setSelectedChangeKey(null);
	};

	return (
		<MuiBreadcrumbs
			separator={<NavigateNextIcon fontSize="small" />}
			sx={{ fontSize: "0.875rem" }}
		>
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
					{titles[view]}
				</Link>
			) : (
				<Typography variant="body2" sx={{ fontWeight: 600 }}>
					{titles[view]}
				</Typography>
			)}
			{detailLabel && (
				<Typography variant="body2" sx={{ fontWeight: 600 }}>
					{detailLabel}
				</Typography>
			)}
		</MuiBreadcrumbs>
	);
}
