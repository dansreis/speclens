import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import RuleIcon from "@mui/icons-material/Rule";
import SchemaOutlinedIcon from "@mui/icons-material/SchemaOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WaterfallChartOutlinedIcon from "@mui/icons-material/WaterfallChartOutlined";
import {
	Box,
	Divider,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Tooltip,
	Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { type ReactNode, useMemo, useState } from "react";
import { RepositorySwitcher } from "../repos/RepositorySwitcher";
import { useSpecCheckResults } from "../specs/useSpecChecks";
import {
	type AppView,
	DEFAULT_SETTINGS,
	useAppStore,
} from "../store/useAppStore";
import { SidebarFooter } from "./SidebarFooter";

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

const COLLAPSED_WIDTH = 64;
// Drag-resize bounds; must match the sidebarWidth clamp in sanitizeSettings.
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;

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
	const openFolder = useAppStore((s) => s.openFolder);
	const selectedFolder = useAppStore((s) => s.selectedFolder);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const setSelectedSchema = useAppStore((s) => s.setSelectedSchema);
	const repos = useAppStore((s) => s.repos);
	const specChecksEnabled = useAppStore((s) => s.settings.specChecks);
	const activeRepo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];
	const checksCount = useSpecCheckResults(activeRepo ?? null).length;
	const resolvedWorkflow = useMemo<ResolvedNavItem[]>(() => {
		const counts: Partial<Record<AppView, number>> = {};
		if (activeRepo) {
			counts.changes = activeRepo.changes.length;
		}
		const items = workflowNav.map((item) => ({
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
		if (specChecksEnabled) {
			// After Overview and Changes: analysis of what the changes contain.
			items.splice(2, 0, {
				key: "checks",
				label: "Checks",
				icon: <RuleIcon />,
				count: checksCount > 0 ? checksCount : undefined,
				active: view === "checks",
				onClick: () => setView("checks"),
			});
		}
		return items;
	}, [
		activeRepo,
		view,
		setView,
		setSelectedChangeKey,
		specChecksEnabled,
		checksCount,
	]);
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
	const sidebarWidth = useAppStore((s) => s.settings.sidebarWidth);
	const setSetting = useAppStore((s) => s.setSetting);
	const [resizing, setResizing] = useState(false);
	const width = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

	const handleResizeStart = (e: React.PointerEvent<HTMLElement>) => {
		// preventDefault stops a text selection from starting mid-drag.
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = useAppStore.getState().settings.sidebarWidth;
		const handle = e.currentTarget;
		handle.setPointerCapture(e.pointerId);
		setResizing(true);
		const onMove = (ev: PointerEvent) => {
			const w = Math.round(
				Math.min(
					MAX_WIDTH,
					Math.max(MIN_WIDTH, startWidth + ev.clientX - startX),
				),
			);
			useAppStore.getState().setSetting("sidebarWidth", w);
		};
		const onUp = () => {
			setResizing(false);
			handle.removeEventListener("pointermove", onMove);
			handle.removeEventListener("pointerup", onUp);
			handle.removeEventListener("pointercancel", onUp);
		};
		handle.addEventListener("pointermove", onMove);
		handle.addEventListener("pointerup", onUp);
		handle.addEventListener("pointercancel", onUp);
	};

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
				// The collapse toggle animates; dragging must track the cursor 1:1.
				transition: resizing ? "none" : "width 200ms ease-in-out",
				overflow: "hidden",
				position: "relative",
			}}
		>
			{!collapsed && (
				<Box
					onPointerDown={handleResizeStart}
					onDoubleClick={() =>
						setSetting("sidebarWidth", DEFAULT_SETTINGS.sidebarWidth)
					}
					aria-label="Resize sidebar"
					sx={{
						position: "absolute",
						top: 0,
						right: 0,
						bottom: 0,
						width: 5,
						cursor: "col-resize",
						zIndex: 1,
						bgcolor: resizing
							? (t) => alpha(t.palette.primary.main, 0.3)
							: "transparent",
						transition: "background-color 150ms",
						"&:hover": {
							bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
						},
					}}
				/>
			)}
			<Box
				sx={{
					px: 1,
					height: 48,
					display: "flex",
					alignItems: "center",
					borderBottom: 1,
					borderColor: "divider",
				}}
			>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<RepositorySwitcher collapsed={collapsed} />
				</Box>
			</Box>
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
