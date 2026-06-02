import AddIcon from "@mui/icons-material/Add";
import FolderIcon from "@mui/icons-material/Folder";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
	Box,
	ButtonBase,
	Divider,
	ListItemText,
	Menu,
	MenuItem,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

interface Repo {
	id: string;
	name: string;
	subtitle: string;
}

const mockRepos: Repo[] = [
	{ id: "speclens", name: "danielreis/speclens", subtitle: "private" },
	{ id: "gitspec", name: "danielreis/gitspec", subtitle: "private" },
	{
		id: "openspec-demo",
		name: "speclens/openspec-demo",
		subtitle: "organization",
	},
];

const isMac =
	typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl+";

export function RepositorySwitcher() {
	const [active, setActive] = useState<Repo>(mockRepos[0]);
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
	const open = Boolean(anchorEl);

	const handleOpen = (e: React.MouseEvent<HTMLElement>) =>
		setAnchorEl(e.currentTarget);
	const handleClose = () => setAnchorEl(null);
	const handleSelect = (repo: Repo) => {
		setActive(repo);
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
			if (!Number.isInteger(num) || num < 1 || num > mockRepos.length) return;
			e.preventDefault();
			setActive(mockRepos[num - 1]);
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, []);

	return (
		<>
			<ButtonBase
				onClick={handleOpen}
				aria-haspopup="menu"
				aria-expanded={open ? "true" : undefined}
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1.25,
					px: 1,
					py: 0.75,
					borderRadius: 1,
					textAlign: "left",
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
						{active.subtitle}
					</Typography>
				</Box>
				<UnfoldMoreIcon
					fontSize="small"
					sx={{ ml: 0.5, color: "text.secondary" }}
				/>
			</ButtonBase>
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
				{mockRepos.map((repo, i) => (
					<MenuItem
						key={repo.id}
						selected={repo.id === active.id}
						onClick={() => handleSelect(repo)}
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
							}}
						>
							<FolderIcon sx={{ fontSize: 14 }} />
						</Box>
						<ListItemText
							primary={repo.name}
							slotProps={{
								primary: { variant: "body2" },
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
