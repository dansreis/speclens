import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
	Avatar,
	Box,
	IconButton,
	Tab,
	Tabs,
	Tooltip,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { AppComment } from "../lib/comments";
import { repos } from "../lib/exampleLoader";
import {
	formatAbsoluteDateTime,
	formatRelativeTime,
} from "../lib/relativeTime";
import { type TabKey, useAppStore } from "../store/useAppStore";
import { useCommentsStore } from "../store/useCommentsStore";

const PANEL_WIDTH = 340;

type Filter = "unresolved" | "resolved";

interface Props {
	open: boolean;
	pinned: boolean;
	onClose: () => void;
	onTogglePin: () => void;
}

function CommentItem({
	comment,
	onJump,
}: {
	comment: AppComment;
	onJump: (comment: AppComment) => void;
}) {
	const jumpable = Boolean(comment.highlight);
	return (
		<Box
			sx={{
				p: 2,
				borderBottom: 1,
				borderColor: "divider",
				opacity: comment.resolved ? 0.65 : 1,
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
				<Avatar
					sx={{
						width: 28,
						height: 28,
						fontSize: "0.75rem",
						bgcolor: comment.resolved ? "text.disabled" : "primary.main",
					}}
				>
					{comment.initials}
				</Avatar>
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
						{comment.author}
					</Typography>
					<Tooltip title={formatAbsoluteDateTime(comment.timestamp)} arrow>
						<Box
							component="span"
							sx={{
								display: "inline-block",
								cursor: "default",
								color: "text.secondary",
								fontSize: "0.75rem",
								lineHeight: 1.4,
							}}
						>
							{formatRelativeTime(comment.timestamp)}
						</Box>
					</Tooltip>
				</Box>
				{comment.resolved && (
					<Tooltip title="Resolved" arrow>
						<CheckCircleIcon
							fontSize="small"
							sx={{ color: "success.main", flexShrink: 0 }}
						/>
					</Tooltip>
				)}
			</Box>
			{comment.quote && (
				<Tooltip
					title={jumpable ? "Jump to highlight" : ""}
					arrow
					disableHoverListener={!jumpable}
				>
					<Box
						onClick={jumpable ? () => onJump(comment) : undefined}
						sx={{
							borderLeft: 3,
							borderColor: "primary.light",
							pl: 1.25,
							py: 0.5,
							mb: 1,
							bgcolor: "action.hover",
							borderRadius: "0 4px 4px 0",
							cursor: jumpable ? "pointer" : "default",
							transition: "background-color 150ms",
							"&:hover": jumpable ? { bgcolor: "action.selected" } : undefined,
						}}
					>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ fontStyle: "italic" }}
						>
							“{comment.quote}”
						</Typography>
					</Box>
				</Tooltip>
			)}
			<Typography
				variant="body2"
				sx={{
					lineHeight: 1.55,
					textDecoration: comment.resolved ? "line-through" : "none",
					textDecorationColor: "text.disabled",
				}}
			>
				{comment.body}
			</Typography>
		</Box>
	);
}

export function CommentsPanel({ open, pinned, onClose, onTogglePin }: Props) {
	const [filter, setFilter] = useState<Filter>("unresolved");
	const comments = useCommentsStore((s) => s.comments);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const setScrollTarget = useAppStore((s) => s.setScrollTarget);

	const handleJump = (comment: AppComment) => {
		const h = comment.highlight;
		if (!h) return;
		const parts = h.documentId.split("/");
		const tab = parts[parts.length - 1] as TabKey;
		const slug = parts.slice(0, -1).join("/");
		const activeRepo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];
		const change = activeRepo?.changes.find((c) => c.slug === slug);
		if (!change) return;
		const key = `${change.archived ? "archive/" : ""}${change.slug}`;
		setSelectedChangeKey(key);
		setActiveTab(tab);
		setScrollTarget({
			documentId: h.documentId,
			text: h.text,
			occurrence: h.occurrence,
		});
	};

	const counts = useMemo(() => {
		const unresolved = comments.filter((c) => !c.resolved).length;
		const resolved = comments.length - unresolved;
		return { unresolved, resolved };
	}, [comments]);

	const visibleComments = useMemo(
		() =>
			comments.filter((c) =>
				filter === "unresolved" ? !c.resolved : c.resolved,
			),
		[comments, filter],
	);

	const pinnedSx = {
		position: "relative" as const,
		width: open ? PANEL_WIDTH : 0,
		flexShrink: 0,
		transition: "width 200ms ease-in-out",
	};
	const floatingSx = {
		position: "absolute" as const,
		top: 0,
		right: 0,
		bottom: 0,
		width: PANEL_WIDTH,
		transform: open ? "translateX(0)" : "translateX(100%)",
		transition: "transform 200ms ease-in-out",
		zIndex: 10,
		boxShadow: 3,
	};

	return (
		<Box
			sx={{
				...(pinned ? pinnedSx : floatingSx),
				borderLeft: 1,
				borderColor: "divider",
				bgcolor: "background.paper",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				pointerEvents: open ? "auto" : "none",
			}}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					px: 1.5,
					py: 1,
					borderBottom: 1,
					borderColor: "divider",
					flexShrink: 0,
				}}
			>
				<Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
					Comments
				</Typography>
				<Box sx={{ display: "flex", gap: 0.5 }}>
					<Tooltip title={pinned ? "Unpin Comments" : "Pin Comments"}>
						<IconButton
							size="small"
							onClick={onTogglePin}
							aria-label={pinned ? "Unpin Comments" : "Pin Comments"}
							sx={{ color: pinned ? "primary.main" : "text.secondary" }}
						>
							{pinned ? (
								<PushPinIcon fontSize="small" />
							) : (
								<PushPinOutlinedIcon fontSize="small" />
							)}
						</IconButton>
					</Tooltip>
					<Tooltip title="Close">
						<IconButton
							size="small"
							onClick={onClose}
							aria-label="Close Comments"
							sx={{ color: "text.secondary" }}
						>
							<CloseIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Box>
			</Box>
			<Tabs
				value={filter}
				onChange={(_, v) => setFilter(v as Filter)}
				variant="fullWidth"
				sx={{
					borderBottom: 1,
					borderColor: "divider",
					minHeight: 40,
					flexShrink: 0,
				}}
			>
				<Tab
					value="unresolved"
					label={`Unresolved (${counts.unresolved})`}
					sx={{ minHeight: 40, textTransform: "none", fontSize: "0.8125rem" }}
				/>
				<Tab
					value="resolved"
					label={`Resolved (${counts.resolved})`}
					sx={{ minHeight: 40, textTransform: "none", fontSize: "0.8125rem" }}
				/>
			</Tabs>
			<Box sx={{ flex: 1, overflowY: "auto" }}>
				{visibleComments.length === 0 ? (
					<Box sx={{ p: 4, textAlign: "center" }}>
						<Typography variant="body2" color="text.secondary">
							No {filter} comments
						</Typography>
					</Box>
				) : (
					visibleComments.map((c) => (
						<CommentItem key={c.id} comment={c} onJump={handleJump} />
					))
				)}
			</Box>
		</Box>
	);
}
