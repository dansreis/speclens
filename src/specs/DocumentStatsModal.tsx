import AbcIcon from "@mui/icons-material/Abc";
import BarChartIcon from "@mui/icons-material/BarChart";
import CloseIcon from "@mui/icons-material/Close";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ShortTextIcon from "@mui/icons-material/ShortText";
import SubjectIcon from "@mui/icons-material/Subject";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import TitleIcon from "@mui/icons-material/Title";
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton,
	Tooltip,
	Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { computeDocumentStats } from "../lib/documentStats";

interface Props {
	open: boolean;
	source: string | null;
	onClose: () => void;
}

function StatCard({
	icon,
	value,
	label,
}: {
	icon: ReactNode;
	value: string;
	label: string;
}) {
	return (
		<Box
			sx={{
				p: 2,
				border: 1,
				borderColor: "divider",
				borderRadius: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 0.5,
				bgcolor: "action.hover",
			}}
		>
			<Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
			<Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
				{value}
			</Typography>
			<Typography variant="caption" color="text.secondary">
				{label}
			</Typography>
		</Box>
	);
}

export function DocumentStatsModal({ open, source, onClose }: Props) {
	const stats = source ? computeDocumentStats(source) : null;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ pr: 6 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<BarChartIcon />
					Document Statistics
				</Box>
				<Tooltip title="Close (Esc)">
					<IconButton
						onClick={onClose}
						aria-label="Close"
						sx={{ position: "absolute", right: 8, top: 8 }}
					>
						<CloseIcon />
					</IconButton>
				</Tooltip>
			</DialogTitle>
			<DialogContent dividers>
				{stats ? (
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
							gap: 2,
						}}
					>
						<StatCard
							icon={<TextFieldsIcon />}
							value={stats.words.toLocaleString()}
							label="Words"
						/>
						<StatCard
							icon={<AbcIcon />}
							value={stats.characters.toLocaleString()}
							label="Characters"
						/>
						<StatCard
							icon={<SubjectIcon />}
							value={stats.paragraphs.toLocaleString()}
							label="Paragraphs"
						/>
						<StatCard
							icon={<ShortTextIcon />}
							value={stats.sentences.toLocaleString()}
							label="Sentences"
						/>
						<StatCard
							icon={<TitleIcon />}
							value={stats.headings.toLocaleString()}
							label="Headings"
						/>
						<StatCard
							icon={<ScheduleIcon />}
							value={`${stats.readingTimeMinutes} min`}
							label="Reading Time"
						/>
					</Box>
				) : (
					<Typography color="text.secondary">No content to analyze.</Typography>
				)}
			</DialogContent>
		</Dialog>
	);
}
