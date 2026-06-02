import {
	Box,
	List,
	ListItemButton,
	ListItemText,
	Typography,
} from "@mui/material";
import type { Change } from "../lib/exampleLoader";
import { countTaskCompletion } from "../lib/tasksCompletion";

interface Props {
	changes: Change[];
	selectedKey: string | null;
	onSelect: (key: string) => void;
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

export function ChangesSidebar({ changes, selectedKey, onSelect }: Props) {
	const active = changes.filter((c) => !c.archived);
	const archived = changes.filter((c) => c.archived);

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
		<Box
			sx={{
				width: 260,
				borderRight: 1,
				borderColor: "divider",
				overflowY: "auto",
				flexShrink: 0,
			}}
		>
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
		</Box>
	);
}
