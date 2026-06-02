import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import SettingsIcon from "@mui/icons-material/Settings";
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton,
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
					<Typography variant="body2" color="text.secondary">
						Settings panel placeholder. See <code>TODO.md</code> for planned
						options (max markdown width, comments on/off, highlight color,
						etc.).
					</Typography>
				</DialogContent>
			</Dialog>
		</>
	);
}
