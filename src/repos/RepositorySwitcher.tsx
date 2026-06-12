import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import ComputerIcon from "@mui/icons-material/Computer";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOffIcon from "@mui/icons-material/FolderOff";
import GroupIcon from "@mui/icons-material/Group";
import LockIcon from "@mui/icons-material/Lock";
import RefreshIcon from "@mui/icons-material/Refresh";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
	Badge,
	Box,
	ButtonBase,
	Divider,
	IconButton,
	ListItemText,
	Menu,
	MenuItem,
	Tooltip,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { Repo, RepoType } from "../lib/repoLoader";
import { type RepoSource, useAppStore } from "../store/useAppStore";
import { pickAndAddRepoSource } from "./addRepo";

function typeIcon(type: RepoType) {
	if (type === "private") return <LockIcon sx={{ fontSize: 14 }} />;
	if (type === "organization") return <GroupIcon sx={{ fontSize: 14 }} />;
	return <ComputerIcon sx={{ fontSize: 14 }} />;
}

const isMac =
	typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl+";

function folderName(path: string): string {
	const trimmed = path.replace(/\/+$/, "");
	const idx = trimmed.lastIndexOf("/");
	return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

interface SwitcherProps {
	collapsed?: boolean;
}

export function RepositorySwitcher({ collapsed = false }: SwitcherProps) {
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const setSelectedRepoId = useAppStore((s) => s.setSelectedRepoId);
	const repos = useAppStore((s) => s.repos);
	const repoSources = useAppStore((s) => s.repoSources);
	const removeRepoSource = useAppStore((s) => s.removeRepoSource);
	const reloadRepo = useAppStore((s) => s.reloadRepo);
	const staleRepos = useAppStore((s) => s.staleRepos);
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
	const open = Boolean(anchorEl);

	useEffect(() => {
		if (!selectedRepoId && repos[0]) {
			setSelectedRepoId(repos[0].id);
		}
	}, [selectedRepoId, setSelectedRepoId, repos]);

	const active = repos.find((r) => r.id === selectedRepoId) ?? repos[0];

	const handleOpen = (e: React.MouseEvent<HTMLElement>) =>
		setAnchorEl(e.currentTarget);
	const handleClose = () => setAnchorEl(null);
	const handleSelect = (id: string) => {
		setSelectedRepoId(id);
		handleClose();
	};
	const handleAdd = async () => {
		handleClose();
		await pickAndAddRepoSource();
	};

	const rows: { source: RepoSource; repo: Repo | null }[] = repoSources.map(
		(source) => ({
			source,
			repo: repos.find((r) => r.id === source.path) ?? null,
		}),
	);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const modifier = isMac ? e.metaKey : e.ctrlKey;
			if (!modifier || e.altKey || e.shiftKey) return;
			const target = e.target as HTMLElement | null;
			if (
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				target?.isContentEditable
			)
				return;
			const num = Number.parseInt(e.key, 10);
			if (!Number.isInteger(num) || num < 1 || num > repos.length) return;
			e.preventDefault();
			setSelectedRepoId(repos[num - 1].id);
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [setSelectedRepoId, repos]);

	const hasAnyRows = repoSources.length > 0;

	const trigger = (
		<ButtonBase
			onClick={handleOpen}
			aria-haspopup="menu"
			aria-expanded={open ? "true" : undefined}
			sx={{
				width: "100%",
				display: "flex",
				alignItems: "center",
				gap: 1.25,
				px: collapsed ? 0.5 : 1,
				py: 0.75,
				borderRadius: 1,
				textAlign: "left",
				justifyContent: collapsed ? "center" : "flex-start",
				transition: "background-color 150ms",
				"&:hover": { bgcolor: "action.hover" },
			}}
		>
			<Box
				sx={{
					width: 32,
					height: 32,
					borderRadius: 1,
					bgcolor: active ? "primary.main" : "action.disabledBackground",
					color: active ? "primary.contrastText" : "text.disabled",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
				}}
			>
				<FolderIcon sx={{ fontSize: 18 }} />
			</Box>
			{!collapsed && (
				<>
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							minWidth: 0,
							maxWidth: 220,
						}}
					>
						<Typography
							variant="body2"
							sx={{
								fontWeight: 600,
								lineHeight: 1.2,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{active ? active.name : "No repository"}
						</Typography>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ lineHeight: 1.2 }}
						>
							{active ? active.type : "Click to add"}
						</Typography>
					</Box>
					<UnfoldMoreIcon
						fontSize="small"
						sx={{ ml: 0.5, color: "text.secondary" }}
					/>
				</>
			)}
		</ButtonBase>
	);

	let loadedIndex = 0;

	const activeStale = active ? !!staleRepos[active.id] : false;
	const expandedTrigger =
		!collapsed && active ? (
			<Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
				<Box sx={{ flex: 1, minWidth: 0 }}>{trigger}</Box>
				<Tooltip
					title={
						activeStale
							? "Changes detected on disk since this repository was loaded. Click to refresh and pick them up."
							: "Reload repository"
					}
					placement="bottom"
					arrow
				>
					<Badge
						overlap="circular"
						anchorOrigin={{ vertical: "top", horizontal: "right" }}
						badgeContent={activeStale ? "⚠️" : null}
						sx={{
							"& .MuiBadge-badge": {
								fontSize: "0.75rem",
								minWidth: 16,
								height: 16,
								padding: 0,
								bgcolor: "transparent",
							},
						}}
					>
						<IconButton
							size="small"
							onClick={() => reloadRepo(active.id)}
							aria-label={
								activeStale
									? "Reload repository (changes detected)"
									: "Reload repository"
							}
							sx={{
								color: activeStale ? "warning.main" : "text.secondary",
							}}
						>
							<RefreshIcon fontSize="small" />
						</IconButton>
					</Badge>
				</Tooltip>
			</Box>
		) : null;

	return (
		<>
			{collapsed && active ? (
				<Tooltip title={active.name} placement="right" arrow>
					{trigger}
				</Tooltip>
			) : expandedTrigger ? (
				expandedTrigger
			) : (
				trigger
			)}
			<Menu
				anchorEl={anchorEl}
				open={open}
				onClose={handleClose}
				anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
				transformOrigin={{ vertical: "top", horizontal: "left" }}
				slotProps={{
					paper: { sx: { minWidth: 280, mt: 0.5 } },
					list: { sx: { py: 0.5 } },
				}}
			>
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ px: 2, py: 0.5, display: "block" }}
				>
					Repositories
				</Typography>
				{!hasAnyRows && (
					<Box sx={{ px: 2, py: 1.5 }}>
						<Typography variant="body2" color="text.secondary">
							No repositories yet.
						</Typography>
					</Box>
				)}
				{rows.map(({ source, repo }) => {
					const isMissing = source.missing || !repo;
					const isActive = repo?.id === active?.id && !!repo;
					const shortcutIdx = !isMissing && repo ? ++loadedIndex : null;
					return (
						<MenuItem
							key={source.path}
							selected={isActive}
							onClick={() => {
								if (isMissing || !repo) return;
								handleSelect(repo.id);
							}}
							sx={{
								gap: 1.25,
								py: 1,
								cursor: isMissing ? "default" : "pointer",
								opacity: isMissing ? 0.65 : 1,
								"&:hover": isMissing ? { bgcolor: "transparent" } : undefined,
								"&:hover .repo-delete": { opacity: 1 },
							}}
						>
							<Box
								sx={{
									width: 24,
									height: 24,
									borderRadius: 0.75,
									border: 1,
									borderColor: isMissing ? "warning.main" : "divider",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
									color: isMissing ? "warning.main" : "text.secondary",
								}}
							>
								{isMissing ? (
									<FolderOffIcon sx={{ fontSize: 14 }} />
								) : repo ? (
									typeIcon(repo.type)
								) : null}
							</Box>
							<ListItemText
								primary={repo?.name ?? folderName(source.path)}
								secondary={
									isMissing ? `Folder not found · ${source.path}` : source.path
								}
								slotProps={{
									primary: {
										variant: "body2",
										sx: { fontWeight: isActive ? 600 : 400 },
									},
									secondary: {
										variant: "caption",
										sx: {
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											color: isMissing ? "warning.main" : "text.secondary",
										},
									},
								}}
							/>
							{shortcutIdx !== null && (
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{ ml: 2, fontFamily: "ui-monospace, monospace" }}
								>
									{modKey}
									{shortcutIdx}
								</Typography>
							)}
							<Tooltip title="Reload" placement="top" arrow>
								<IconButton
									className="repo-delete"
									size="small"
									onClick={(e) => {
										e.stopPropagation();
										handleClose();
										reloadRepo(source.path);
									}}
									sx={{
										ml: 0.5,
										opacity: isMissing ? 1 : 0,
										transition: "opacity 150ms",
										color: "text.secondary",
									}}
								>
									<RefreshIcon sx={{ fontSize: 16 }} />
								</IconButton>
							</Tooltip>
							<Tooltip title="Remove from list" placement="left" arrow>
								<IconButton
									className="repo-delete"
									size="small"
									onClick={(e) => {
										e.stopPropagation();
										removeRepoSource(source.path);
									}}
									sx={{
										opacity: isMissing ? 1 : 0,
										transition: "opacity 150ms",
										color: "text.secondary",
									}}
								>
									<CloseIcon sx={{ fontSize: 16 }} />
								</IconButton>
							</Tooltip>
						</MenuItem>
					);
				})}
				<Divider sx={{ my: 0.5 }} />
				<MenuItem
					onClick={handleAdd}
					sx={{ gap: 1.25, py: 1, color: "text.secondary" }}
				>
					<Box
						sx={{
							width: 24,
							height: 24,
							borderRadius: 0.75,
							border: 1,
							borderColor: "divider",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
						}}
					>
						<AddIcon sx={{ fontSize: 16 }} />
					</Box>
					<ListItemText
						primary="Add repository"
						slotProps={{
							primary: { variant: "body2", sx: { fontWeight: 500 } },
						}}
					/>
				</MenuItem>
			</Menu>
		</>
	);
}
