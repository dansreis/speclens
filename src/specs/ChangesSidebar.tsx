import {
	Avatar,
	Box,
	List,
	ListItemButton,
	ListItemText,
	Tooltip,
	Typography,
} from "@mui/material";
import type { Change } from "../lib/exampleLoader";
import { countTaskCompletion } from "../lib/tasksCompletion";

interface Props {
	changes: Change[];
	selectedKey: string | null;
	onSelect: (key: string) => void;
	collapsed?: boolean;
}

function getInitials(name: string): string {
	const words = name.split(/\s+/).filter(Boolean);
	if (words.length === 0) return "?";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function statusBadge(change: Change): string {
	if (change.archived) return "archived";
	if (!change.tasks) return "no tasks";
	const { total, done } = countTaskCompletion(change.tasks);
	if (total === 0) return "no tasks";
	return `${done}/${total}`;
}

export function ChangesSidebar({
	changes,
	selectedKey,
	onSelect,
	collapsed = false,
}: Props) {
	const active = changes.filter((c) => !c.archived);
	const archived = changes.filter((c) => c.archived);

	if (collapsed) {
		return (
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 0.5,
					py: 1,
				}}
			>
				{[...active, ...archived].map((c) => {
					const key = `${c.archived ? "archive/" : ""}${c.slug}`;
					const isSelected = key === selectedKey;
					return (
						<Tooltip key={key} title={c.name} placement="right" arrow>
							<Avatar
								onClick={() => onSelect(key)}
								sx={{
									width: 32,
									height: 32,
									borderRadius: 1,
									fontSize: "0.75rem",
									fontWeight: 600,
									cursor: "pointer",
									bgcolor: isSelected ? "primary.main" : "transparent",
									color: isSelected ? "primary.contrastText" : "text.primary",
									border: 1,
									borderColor: isSelected ? "primary.main" : "divider",
									opacity: c.archived ? 0.6 : 1,
									transition:
										"background-color 150ms, color 150ms, border-color 150ms",
									"&:hover": {
										bgcolor: isSelected ? "primary.dark" : "action.hover",
									},
								}}
							>
								{getInitials(c.name)}
							</Avatar>
						</Tooltip>
					);
				})}
			</Box>
		);
	}

	const renderItem = (c: Change) => {
		const key = changeKey(c);
		return (
			<ListItemButton
				key={key}
				selected={key === selectedKey}
				onClick={() => onSelect(key)}
			>
				<ListItemText
					primary={c.name}
					secondary={statusBadge(c)}
					slotProps={{
						primary: { variant: "body2" },
						secondary: { variant: "caption" },
					}}
				/>
			</ListItemButton>
		);
	};

	return (
		<>
			<Typography
				variant="overline"
				sx={{ display: "block", px: 2, pt: 2, color: "text.secondary" }}
			>
				Active
			</Typography>
			<List dense disablePadding>
				{active.map(renderItem)}
			</List>
			{archived.length > 0 && (
				<>
					<Typography
						variant="overline"
						sx={{ display: "block", px: 2, pt: 2, color: "text.secondary" }}
					>
						Archive
					</Typography>
					<List dense disablePadding>
						{archived.map(renderItem)}
					</List>
				</>
			)}
		</>
	);
}
