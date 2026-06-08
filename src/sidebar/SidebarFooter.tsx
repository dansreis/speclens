import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import SettingsIcon from "@mui/icons-material/Settings";
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	FormControlLabel,
	IconButton,
	Stack,
	Switch,
	Tooltip,
	Typography,
} from "@mui/material";
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

interface Props {
	collapsed?: boolean;
}

export function SidebarFooter({ collapsed = false }: Props) {
	const themeMode = useAppStore((s) => s.themeMode);
	const toggleThemeMode = useAppStore((s) => s.toggleThemeMode);
	const highlightEars = useAppStore((s) => s.highlightEars);
	const toggleHighlightEars = useAppStore((s) => s.toggleHighlightEars);
	const [settingsOpen, setSettingsOpen] = useState(false);

	const settingsBtn = (
		<Tooltip title="Settings" placement={collapsed ? "right" : "top"} arrow>
			<IconButton
				onClick={() => setSettingsOpen(true)}
				aria-label="Settings"
				size="small"
				sx={{ color: "text.secondary" }}
			>
				<SettingsIcon fontSize="small" />
			</IconButton>
		</Tooltip>
	);

	const themeBtn = (
		<Tooltip
			title={`Switch to ${themeMode === "light" ? "dark" : "light"} mode`}
			placement={collapsed ? "right" : "top"}
			arrow
		>
			<IconButton
				onClick={toggleThemeMode}
				aria-label="Toggle theme"
				size="small"
				sx={{ color: "text.secondary" }}
			>
				{themeMode === "light" ? (
					<DarkModeIcon fontSize="small" />
				) : (
					<LightModeIcon fontSize="small" />
				)}
			</IconButton>
		</Tooltip>
	);

	return (
		<>
			<Box
				sx={{
					display: "flex",
					flexDirection: collapsed ? "column" : "row",
					justifyContent: collapsed ? "center" : "space-between",
					alignItems: "center",
					gap: 0.5,
					px: collapsed ? 0 : 1,
				}}
			>
				{settingsBtn}
				{themeBtn}
			</Box>
			<Dialog
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Settings</DialogTitle>
				<DialogContent dividers>
					<Stack spacing={2}>
						<FormControlLabel
							control={
								<Switch
									checked={highlightEars}
									onChange={toggleHighlightEars}
								/>
							}
							label={
								<Box>
									<Typography variant="body2">
										Highlight EARS keywords
									</Typography>
									<Typography variant="caption" color="text.secondary">
										Colors SHALL, MUST, SHOULD, MAY, WHEN, WHILE, WHERE, IF,
										THEN, GIVEN, AND in spec prose.
									</Typography>
								</Box>
							}
						/>
						<Typography variant="caption" color="text.secondary">
							More options planned — see <code>TODO.md</code>.
						</Typography>
					</Stack>
				</DialogContent>
			</Dialog>
		</>
	);
}
