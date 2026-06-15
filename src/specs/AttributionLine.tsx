import { Avatar, Box, Tooltip, Typography } from "@mui/material";
import {
	formatAbsoluteDateTime,
	formatRelativeTime,
} from "../lib/relativeTime";
import type { DocAuthorship, Person } from "../lib/repoLoader";

function initialsFor(name: string): string {
	const parts = name.trim().split(/\s+/).slice(0, 2);
	return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}

function PersonAvatar({ person, size }: { person: Person; size: number }) {
	return (
		<Tooltip title={`${person.name} <${person.email}>`} arrow>
			<Avatar
				sx={{
					width: size,
					height: size,
					fontSize: size * 0.45,
					bgcolor: "primary.main",
					fontWeight: 600,
				}}
			>
				{initialsFor(person.name)}
			</Avatar>
		</Tooltip>
	);
}

interface Props {
	authorship: DocAuthorship;
	size?: "sm" | "md";
}

export function AttributionLine({ authorship, size = "md" }: Props) {
	const { createdBy, lastEditedBy, createdAt, lastEditedAt } = authorship;
	const sameAuthor = createdBy.email === lastEditedBy.email;
	const avatarSize = size === "sm" ? 18 : 22;
	const editedDate = new Date(lastEditedAt);

	return (
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 0.75,
				color: "text.secondary",
				minWidth: 0,
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: -0.5 }}>
				<PersonAvatar person={createdBy} size={avatarSize} />
				{!sameAuthor && (
					<Box sx={{ ml: -0.5 }}>
						<PersonAvatar person={lastEditedBy} size={avatarSize} />
					</Box>
				)}
			</Box>
			<Typography
				variant="caption"
				component="span"
				sx={{
					minWidth: 0,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				<Box component="span" sx={{ color: "text.primary", fontWeight: 500 }}>
					{createdBy.name}
				</Box>
				{!sameAuthor && (
					<>
						{" · edited by "}
						<Box
							component="span"
							sx={{ color: "text.primary", fontWeight: 500 }}
						>
							{lastEditedBy.name}
						</Box>
					</>
				)}
				{", "}
				<Tooltip
					title={`${formatAbsoluteDateTime(editedDate)}${
						sameAuthor
							? ""
							: ` - created ${formatAbsoluteDateTime(new Date(createdAt))}`
					}`}
					arrow
				>
					<Box component="span" sx={{ cursor: "default" }}>
						{formatRelativeTime(editedDate)}
					</Box>
				</Tooltip>
			</Typography>
		</Box>
	);
}
