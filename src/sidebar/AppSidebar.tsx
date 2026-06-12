import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WaterfallChartOutlinedIcon from "@mui/icons-material/WaterfallChartOutlined";
import {
	Box,
	Chip,
	Divider,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { type ReactNode, useMemo, useState } from "react";
import type { Change } from "../lib/exampleLoader";
import { RepoConfigModal } from "../repos/RepoConfigModal";
import { RepositorySwitcher } from "../repos/RepositorySwitcher";
import { type AppView, useAppStore } from "../store/useAppStore";
import { SidebarFooter } from "./SidebarFooter";

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

interface NavItem {
	id: AppView;
	label: string;
	icon: ReactNode;
}

const navItems: NavItem[] = [
	{ id: "overview", label: "Overview", icon: <GridViewOutlinedIcon /> },
	{ id: "specs", label: "Specs", icon: <DescriptionOutlinedIcon /> },
	{ id: "changes", label: "Changes", icon: <TrendingUpIcon /> },
	{ id: "flow", label: "Flow", icon: <WaterfallChartOutlinedIcon /> },
	{ id: "graph", label: "Graph", icon: <HubOutlinedIcon /> },
	{ id: "timeline", label: "Timeline", icon: <TimelineOutlinedIcon /> },
];

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

export function AppSidebar() {
	const collapsed = useAppStore((s) => s.sidebarCollapsed);
	const view = useAppStore((s) => s.view);
	const setView = useAppStore((s) => s.setView);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const selectedChangeKey = useAppStore((s) => s.selectedChangeKey);
	const selectedSpec = useAppStore((s) => s.selectedSpec);
	const repos = useAppStore((s) => s.repos);
	const activeRepo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];
	const activeChange = useMemo(() => {
		if (!activeRepo) return null;
		if (view === "changes" && selectedChangeKey) {
			return (
				activeRepo.changes.find((c) => changeKey(c) === selectedChangeKey) ??
				null
			);
		}
		if (view === "specs" && selectedSpec) {
			return (
				activeRepo.changes.find((c) =>
					Object.keys(c.specs).includes(selectedSpec),
				) ?? null
			);
		}
		return null;
	}, [activeRepo, view, selectedChangeKey, selectedSpec]);
	const displaySchema = activeChange?.schema ?? activeRepo?.schema;
	const hasOverride = !!(
		activeChange?.configYaml &&
		activeRepo &&
		activeChange.schema.name !== activeRepo.schema.name
	);
	const [configOpen, setConfigOpen] = useState(false);
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
				{!collapsed && activeRepo && displaySchema && (
					<Box sx={{ mt: 0.5, px: 0.5 }}>
						<Tooltip
							title={
								hasOverride
									? `Change overrides repo schema (${activeRepo.schema.name})`
									: activeRepo.configYaml
										? "View openspec/config.yaml"
										: "Using built-in schema (no config.yaml)"
							}
							placement="right"
							arrow
						>
							<Chip
								icon={<SettingsApplicationsIcon sx={{ fontSize: 14 }} />}
								label={
									hasOverride
										? `${displaySchema.name} · override`
										: displaySchema.name
								}
								size="small"
								variant="outlined"
								onClick={() => setConfigOpen(true)}
								sx={{
									height: 22,
									fontSize: "0.6875rem",
									fontFamily: "ui-monospace, monospace",
									color: hasOverride ? "warning.main" : "text.secondary",
									borderColor: hasOverride ? "warning.main" : "divider",
									"& .MuiChip-icon": {
										ml: 0.5,
										color: hasOverride ? "warning.main" : "text.secondary",
									},
									"&:hover": {
										borderColor: "primary.main",
										color: "primary.main",
										"& .MuiChip-icon": { color: "primary.main" },
									},
								}}
							/>
						</Tooltip>
					</Box>
				)}
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
			<RepoConfigModal
				open={configOpen}
				repo={activeRepo ?? null}
				change={activeChange}
				onClose={() => setConfigOpen(false)}
			/>
		</Box>
	);
}
