import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
	Box,
	Divider,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { RepositorySwitcher } from "../repos/RepositorySwitcher";
import { type AppView, useAppStore } from "../store/useAppStore";
import { SidebarFooter } from "./SidebarFooter";

interface NavItem {
	id: AppView;
	label: string;
	icon: ReactNode;
}

const navItems: NavItem[] = [
	{ id: "overview", label: "Overview", icon: <GridViewOutlinedIcon /> },
	{ id: "specs", label: "Specs", icon: <DescriptionOutlinedIcon /> },
	{ id: "changes", label: "Changes", icon: <TrendingUpIcon /> },
	{ id: "graph", label: "Graph", icon: <HubOutlinedIcon /> },
	{ id: "timeline", label: "Timeline", icon: <TimelineOutlinedIcon /> },
];

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

export function AppSidebar() {
	const collapsed = useAppStore((s) => s.sidebarCollapsed);
	const view = useAppStore((s) => s.view);
	const setView = useAppStore((s) => s.setView);
	const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

	return (
		<Box
			component="aside"
			sx={{
				width,
				flexShrink: 0,
				borderRight: 1,
				borderColor: "divider",
				display: "flex",
				flexDirection: "column",
				bgcolor: "background.paper",
				transition: "width 200ms ease-in-out",
				overflow: "hidden",
			}}
		>
			<Box sx={{ p: 1 }}>
				<RepositorySwitcher collapsed={collapsed} />
			</Box>
			<Divider />
			<Box sx={{ flex: 1, overflowY: "auto", p: collapsed ? 0.5 : 1 }}>
				<List
					disablePadding
					sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}
				>
					{navItems.map((item) => {
						const isActive = view === item.id;
						const button = (
							<ListItemButton
								selected={isActive}
								onClick={() => setView(item.id)}
								sx={{
									borderRadius: 1,
									py: 0.75,
									px: collapsed ? 1 : 1.5,
									justifyContent: collapsed ? "center" : "flex-start",
									minHeight: 0,
									color: isActive ? "primary.main" : "text.secondary",
									"& .MuiListItemIcon-root": {
										color: "inherit",
									},
									"&.Mui-selected": {
										bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
										"&:hover": {
											bgcolor: (theme) =>
												alpha(theme.palette.primary.main, 0.15),
										},
									},
									"&:hover": {
										color: "text.primary",
									},
								}}
							>
								<ListItemIcon
									sx={{
										minWidth: 0,
										mr: collapsed ? 0 : 1.5,
										fontSize: "1.125rem",
										"& svg": { fontSize: "1.125rem" },
									}}
								>
									{item.icon}
								</ListItemIcon>
								{!collapsed && (
									<ListItemText
										primary={item.label}
										slotProps={{
											primary: {
												variant: "body2",
												sx: { fontWeight: isActive ? 600 : 400 },
											},
										}}
									/>
								)}
							</ListItemButton>
						);
						return (
							<Box component="li" key={item.id} sx={{ listStyle: "none" }}>
								{collapsed ? (
									<Tooltip title={item.label} placement="right" arrow>
										{button}
									</Tooltip>
								) : (
									button
								)}
							</Box>
						);
					})}
				</List>
			</Box>
			<Divider />
			<Box sx={{ p: 1 }}>
				<SidebarFooter collapsed={collapsed} />
			</Box>
		</Box>
	);
}
