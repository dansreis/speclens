import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import { Box, Typography } from "@mui/material";

export function TimelineView() {
	return (
		<Box
			sx={{
				p: 4,
				maxWidth: 1000,
				mx: "auto",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: 400,
				gap: 2,
			}}
		>
			<TimelineOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
			<Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
				Timeline
			</Typography>
			<Typography variant="body2" color="text.secondary">
				Coming soon — a chronological view of change lifecycles.
			</Typography>
		</Box>
	);
}
