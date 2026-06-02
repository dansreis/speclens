import AddIcon from "@mui/icons-material/Add";
import ComputerIcon from "@mui/icons-material/Computer";
import FolderIcon from "@mui/icons-material/Folder";
import GroupIcon from "@mui/icons-material/Group";
import LockIcon from "@mui/icons-material/Lock";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
	Box,
	ButtonBase,
	Divider,
	ListItemText,
	Menu,
	MenuItem,
	Tooltip,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type RepoType, repos } from "../lib/exampleLoader";
import { useAppStore } from "../store/useAppStore";

function typeIcon(type: RepoType) {
	if (type === "private") return <LockIcon sx={{ fontSize: 14 }} />;
	if (type === "organization") return <GroupIcon sx={{ fontSize: 14 }} />;
	return <ComputerIcon sx={{ fontSize: 14 }} />;
}

const isMac =
	typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl+";

interface SwitcherProps {
	collapsed?: boolean;
}

export function RepositorySwitcher({ collapsed = false }: SwitcherProps) {
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const setSelectedRepoId = useAppStore((s) => s.setSelectedRepoId);
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
	const open = Boolean(anchorEl);

	useEffect(() => {
		if (!selectedRepoId && repos[0]) {
			setSelectedRepoId(repos[0].id);
		}
	}, [selectedRepoId, setSelectedRepoId]);

	const active = repos.find((r) => r.id === selectedRepoId) ?? repos[0];

	const handleOpen = (e: React.MouseEvent<HTMLElement>) =>
		setAnchorEl(e.currentTarget);
	const handleClose = () => setAnchorEl(null);
	const handleSelect = (id: string) => {
		setSelectedRepoId(id);
		handleClose();
	};

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
	}, [setSelectedRepoId]);

	if (!active) return null;

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
					bgcolor: "primary.main",
					color: "primary.contrastText",
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
							{active.name}
						</Typography>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ lineHeight: 1.2 }}
						>
							{active.type}
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

	return (
		<>
			{collapsed ? (
				<Tooltip title={active.name} placement="right" arrow>
					{trigger}
				</Tooltip>
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
					paper: { sx: { minWidth: 260, mt: 0.5 } },
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
				{repos.map((repo, i) => (
					<MenuItem
						key={repo.id}
						selected={repo.id === active.id}
						onClick={() => handleSelect(repo.id)}
						sx={{ gap: 1.25, py: 1 }}
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
								color: "text.secondary",
							}}
						>
							{typeIcon(repo.type)}
						</Box>
						<ListItemText
							primary={repo.name}
							secondary={repo.type}
							slotProps={{
								primary: { variant: "body2" },
								secondary: { variant: "caption" },
							}}
						/>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ ml: 2, fontFamily: "ui-monospace, monospace" }}
						>
							{modKey}
							{i + 1}
						</Typography>
					</MenuItem>
				))}
				<Divider sx={{ my: 0.5 }} />
				<MenuItem sx={{ gap: 1.25, py: 1, color: "text.secondary" }}>
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
