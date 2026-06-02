import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import { Box, Typography } from "@mui/material";

export function GraphView() {
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
			<HubOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
			<Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
				Graph
			</Typography>
			<Typography variant="body2" color="text.secondary">
				Coming soon — a visual map of specs and the changes that touch them.
			</Typography>
		</Box>
	);
}
