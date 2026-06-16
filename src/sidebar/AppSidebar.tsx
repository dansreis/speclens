import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SchemaOutlinedIcon from "@mui/icons-material/SchemaOutlined";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WaterfallChartOutlinedIcon from "@mui/icons-material/WaterfallChartOutlined";
import {
	Box,
	Chip,
	Divider,
	IconButton,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Tooltip,
	Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { type ReactNode, useMemo, useState } from "react";
import type { Change } from "../lib/repoLoader";
import { RepoConfigModal } from "../repos/RepoConfigModal";
import { RepositorySwitcher } from "../repos/RepositorySwitcher";
import { type AppView, useAppStore } from "../store/useAppStore";
import { SidebarFooter } from "./SidebarFooter";

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

interface NavItem {
	key: string;
	id: AppView;
	label: string;
	icon: ReactNode;
	count?: number;
	folderName?: string;
}

const workflowNav: NavItem[] = [
	{
		key: "overview",
		id: "overview",
		label: "Overview",
		icon: <GridViewOutlinedIcon />,
	},
	{
		key: "changes",
		id: "changes",
		label: "Changes",
		icon: <TrendingUpIcon />,
	},
	{
		key: "flow",
		id: "flow",
		label: "Flow",
		icon: <WaterfallChartOutlinedIcon />,
	},
	{ key: "graph", id: "graph", label: "Graph", icon: <HubOutlinedIcon /> },
	{
		key: "timeline",
		id: "timeline",
		label: "Timeline",
		icon: <TimelineOutlinedIcon />,
	},
];

function folderLabel(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

interface ResolvedNavItem {
	key: string;
	label: string;
	icon: ReactNode;
	count?: number;
	active: boolean;
	onClick: () => void;
}

export function AppSidebar() {
	const collapsed = useAppStore((s) => s.sidebarCollapsed);
	const view = useAppStore((s) => s.view);
	const setView = useAppStore((s) => s.setView);
	const goBack = useAppStore((s) => s.goBack);
	const goForward = useAppStore((s) => s.goForward);
	const canGoBack = useAppStore((s) => s.navPast.length > 0);
	const canGoForward = useAppStore((s) => s.navFuture.length > 0);
	const openFolder = useAppStore((s) => s.openFolder);
	const selectedFolder = useAppStore((s) => s.selectedFolder);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const selectedChangeKey = useAppStore((s) => s.selectedChangeKey);
	const selectedSpec = useAppStore((s) => s.selectedSpec);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const setSelectedSchema = useAppStore((s) => s.setSelectedSchema);
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
	const resolvedWorkflow = useMemo<ResolvedNavItem[]>(() => {
		const counts: Partial<Record<AppView, number>> = {};
		if (activeRepo) {
			counts.changes = activeRepo.changes.filter((ch) => !ch.archived).length;
		}
		return workflowNav.map((item) => ({
			key: item.key,
			label: item.label,
			icon: item.icon,
			count: counts[item.id],
			active: view === item.id,
			onClick: () => {
				if (item.id === "changes") setSelectedChangeKey(null);
				setView(item.id);
			},
		}));
	}, [activeRepo, view, setView, setSelectedChangeKey]);
	// Library tabs: Specs and Schemas are special (their views render content
	// differently from generic markdown). Everything else under openspec/ - any
	// folder - is auto-discovered from repo.folders and surfaced as a tab.
	const resolvedLibrary = useMemo<ResolvedNavItem[]>(() => {
		if (!activeRepo) return [];
		const items: ResolvedNavItem[] = [];
		const specSet = new Set<string>();
		for (const ch of activeRepo.changes)
			for (const cap of Object.keys(ch.specs)) specSet.add(cap);
		for (const s of activeRepo.repoSpecs) specSet.add(s.capability);
		if (specSet.size > 0) {
			items.push({
				key: "specs",
				label: "Specs",
				icon: <DescriptionOutlinedIcon />,
				count: specSet.size,
				active: view === "specs",
				onClick: () => {
					setSelectedSpec(null);
					setView("specs");
				},
			});
		}
		if (activeRepo.schemas.length > 0) {
			items.push({
				key: "schemas",
				label: "Schemas",
				icon: <SchemaOutlinedIcon />,
				count: activeRepo.schemas.length,
				active: view === "schemas",
				onClick: () => {
					setSelectedSchema(null);
					setView("schemas");
				},
			});
		}
		for (const folder of activeRepo.folders) {
			items.push({
				key: `folder:${folder.name}`,
				label: folderLabel(folder.name),
				icon: <FolderOutlinedIcon />,
				count: folder.docs.length,
				active: view === "folder" && selectedFolder === folder.name,
				onClick: () => openFolder(folder.name, null),
			});
		}
		return items;
	}, [
		activeRepo,
		view,
		selectedFolder,
		setView,
		openFolder,
		setSelectedSpec,
		setSelectedSchema,
	]);
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
			<Box
				sx={{
					px: 1,
					pt: 1,
					pb: 0.5,
					display: "flex",
					gap: 0.5,
					justifyContent: collapsed ? "center" : "flex-start",
				}}
			>
				<Tooltip title="Back (⌘[)" placement="bottom" arrow>
					<span>
						<IconButton
							size="small"
							onClick={goBack}
							disabled={!canGoBack}
							aria-label="Go back"
							sx={{ color: "text.secondary" }}
						>
							<ArrowBackIosNewIcon sx={{ fontSize: 14 }} />
						</IconButton>
					</span>
				</Tooltip>
				<Tooltip title="Forward (⌘])" placement="bottom" arrow>
					<span>
						<IconButton
							size="small"
							onClick={goForward}
							disabled={!canGoForward}
							aria-label="Go forward"
							sx={{ color: "text.secondary" }}
						>
							<ArrowForwardIosIcon sx={{ fontSize: 14 }} />
						</IconButton>
					</span>
				</Tooltip>
			</Box>
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
				<NavList items={resolvedWorkflow} collapsed={collapsed} />
				{resolvedLibrary.length > 0 && (
					<>
						{collapsed ? (
							<Divider sx={{ my: 1, mx: 0.5 }} />
						) : (
							<Typography
								component="div"
								variant="caption"
								sx={{
									mt: 2,
									mb: 0.5,
									px: 1.5,
									color: "text.disabled",
									fontWeight: 600,
									letterSpacing: 0.6,
									fontSize: "0.6875rem",
									textTransform: "uppercase",
								}}
							>
								Library
							</Typography>
						)}
						<NavList items={resolvedLibrary} collapsed={collapsed} />
					</>
				)}
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

interface NavListProps {
	items: ResolvedNavItem[];
	collapsed: boolean;
}

function NavList({ items, collapsed }: NavListProps) {
	return (
		<List
			disablePadding
			sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}
		>
			{items.map((item) => {
				const { active, count } = item;
				const button = (
					<ListItemButton
						selected={active}
						onClick={item.onClick}
						sx={{
							borderRadius: 1,
							py: 0.75,
							px: collapsed ? 1 : 1.5,
							justifyContent: collapsed ? "center" : "flex-start",
							minHeight: 0,
							color: active ? "primary.main" : "text.secondary",
							"& .MuiListItemIcon-root": {
								color: "inherit",
							},
							"&.Mui-selected": {
								bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
								"&:hover": {
									bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
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
										sx: { fontWeight: active ? 600 : 400 },
									},
								}}
							/>
						)}
						{!collapsed && count !== undefined && (
							<Typography
								variant="caption"
								sx={{
									color: "text.disabled",
									fontFamily: "ui-monospace, monospace",
									fontSize: "0.6875rem",
								}}
							>
								{count}
							</Typography>
						)}
					</ListItemButton>
				);
				return (
					<Box component="li" key={item.key} sx={{ listStyle: "none" }}>
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
	);
}
