import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
	Avatar,
	Box,
	Button,
	IconButton,
	MenuItem,
	Select,
	Tab,
	Tabs,
	TextField,
	Tooltip,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { AppComment, DocumentKind } from "../lib/comments";
import {
	formatAbsoluteDateTime,
	formatRelativeTime,
} from "../lib/relativeTime";
import { type TabKey, useAppStore } from "../store/useAppStore";
import { useCommentsStore, withOrphans } from "../store/useCommentsStore";

const PANEL_WIDTH = 340;

type Scope = "document" | "repo" | "orphans" | "all";
type ResolvedTab = "unresolved" | "resolved";

interface Props {
	open: boolean;
	pinned: boolean;
	onClose: () => void;
	onTogglePin: () => void;
}

function scopeLabel(s: Scope): string {
	switch (s) {
		case "document":
			return "This document";
		case "repo":
			return "This repo";
		case "orphans":
			return "Orphans";
		case "all":
			return "All";
	}
}

function CommentItem({
	comment,
	onJump,
	onToggleResolved,
	onDelete,
}: {
	comment: AppComment;
	onJump: (comment: AppComment) => void;
	onToggleResolved: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	const jumpable = Boolean(comment.highlight && !comment.orphan);
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
				{comment.orphan && (
					<Tooltip title="Original location or text no longer found" arrow>
						<WarningAmberIcon
							fontSize="small"
							sx={{ color: "warning.main", flexShrink: 0 }}
						/>
					</Tooltip>
				)}
				<Tooltip title={comment.resolved ? "Mark unresolved" : "Resolve"} arrow>
					<IconButton
						size="small"
						onClick={() => onToggleResolved(comment.id)}
						aria-label={comment.resolved ? "Mark unresolved" : "Mark resolved"}
						sx={{ color: comment.resolved ? "success.main" : "text.secondary" }}
					>
						{comment.resolved ? (
							<CheckCircleIcon fontSize="small" />
						) : (
							<CheckCircleOutlineIcon fontSize="small" />
						)}
					</IconButton>
				</Tooltip>
				<Tooltip title="Delete" arrow>
					<IconButton
						size="small"
						onClick={() => {
							if (window.confirm("Delete this comment?")) {
								onDelete(comment.id);
							}
						}}
						aria-label="Delete comment"
						sx={{ color: "error.main" }}
					>
						<DeleteOutlineIcon fontSize="small" />
					</IconButton>
				</Tooltip>
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

function deriveDocumentKindFromView(view: string): DocumentKind {
	if (view === "specs") return "repo-spec";
	if (view === "folder") return "folder-doc";
	if (view === "schemas") return "schema";
	return "change";
}

function commentsToMarkdown(
	comments: AppComment[],
	repoName: string,
	scope: Scope,
): string {
	const lines: string[] = [];
	lines.push(`# Comments - ${repoName} - ${scopeLabel(scope)}`);
	lines.push("");
	const byDoc = new Map<string, AppComment[]>();
	for (const c of comments) {
		const k = `${c.documentKind}::${c.documentId ?? "Repo-level"}`;
		const arr = byDoc.get(k) ?? [];
		arr.push(c);
		byDoc.set(k, arr);
	}
	for (const [k, group] of byDoc) {
		const [kind, docId] = k.split("::");
		lines.push(`## ${kind}: ${docId}`);
		lines.push("");
		for (const c of group) {
			if (c.quote) lines.push(`> ${c.quote}`);
			lines.push("");
			lines.push(c.body);
			lines.push("");
			const stamp = c.timestamp.toISOString();
			lines.push(
				`- ${c.author}, ${stamp}${c.resolved ? " [resolved]" : ""}${c.orphan ? " [orphan]" : ""}`,
			);
			lines.push("");
		}
	}
	return lines.join("\n");
}

export function CommentsPanel({ open, pinned, onClose, onTogglePin }: Props) {
	const [resolvedTab, setResolvedTab] = useState<ResolvedTab>("unresolved");
	const [scope, setScope] = useState<Scope>("document");
	const [composerOpen, setComposerOpen] = useState(false);
	const [composerBody, setComposerBody] = useState("");

	const allComments = useCommentsStore((s) => s.comments);
	const highlightOrphans = useCommentsStore((s) => s.highlightOrphans);
	const documentOrphans = useCommentsStore((s) => s.documentOrphans);
	const addComment = useCommentsStore((s) => s.addComment);
	const deleteComment = useCommentsStore((s) => s.deleteComment);
	const toggleResolved = useCommentsStore((s) => s.toggleResolved);

	const repos = useAppStore((s) => s.repos);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const view = useAppStore((s) => s.view);
	const currentDocumentId = useAppStore((s) => s.currentDocumentId);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const setScrollTarget = useAppStore((s) => s.setScrollTarget);

	const activeRepo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];

	const comments = useMemo(
		() => withOrphans(allComments, highlightOrphans, documentOrphans),
		[allComments, highlightOrphans, documentOrphans],
	);

	const repoScoped = useMemo(
		() =>
			activeRepo ? comments.filter((c) => c.repoId === activeRepo.id) : [],
		[comments, activeRepo],
	);

	const filtered = useMemo(() => {
		if (scope === "all") return comments;
		if (scope === "orphans") return comments.filter((c) => c.orphan);
		if (scope === "repo") return repoScoped;
		if (!currentDocumentId) return [];
		return repoScoped.filter((c) => c.documentId === currentDocumentId);
	}, [scope, comments, repoScoped, currentDocumentId]);

	const counts = useMemo(() => {
		const unresolved = filtered.filter((c) => !c.resolved).length;
		const resolved = filtered.length - unresolved;
		return { unresolved, resolved };
	}, [filtered]);

	const visibleComments = useMemo(
		() =>
			filtered.filter((c) =>
				resolvedTab === "unresolved" ? !c.resolved : c.resolved,
			),
		[filtered, resolvedTab],
	);

	const handleJump = (comment: AppComment) => {
		const h = comment.highlight;
		if (!h || comment.documentKind !== "change" || !comment.documentId) return;
		const parts = comment.documentId.split("/");
		const tab = parts[parts.length - 1] as TabKey;
		const slug = parts.slice(0, -1).join("/");
		const change = activeRepo?.changes.find((c) => c.slug === slug);
		if (!change) return;
		const key = `${change.archived ? "archive/" : ""}${change.slug}`;
		setSelectedChangeKey(key);
		setActiveTab(tab);
		setScrollTarget({
			documentId: comment.documentId,
			text: h.text,
			occurrence: h.occurrence,
		});
	};

	const canCompose =
		!!activeRepo &&
		(scope === "repo" || (scope === "document" && !!currentDocumentId));

	const submitNewComment = async () => {
		const body = composerBody.trim();
		if (!body || !activeRepo) return;
		if (scope === "repo") {
			await addComment({
				repoId: activeRepo.id,
				documentKind: "repo",
				documentId: null,
				body,
			});
		} else if (scope === "document" && currentDocumentId) {
			await addComment({
				repoId: activeRepo.id,
				documentKind: deriveDocumentKindFromView(view),
				documentId: currentDocumentId,
				body,
			});
		}
		setComposerBody("");
		setComposerOpen(false);
	};

	const handleExport = async () => {
		const name = activeRepo?.name ?? "Repo";
		const md = commentsToMarkdown(visibleComments, name, scope);
		try {
			await navigator.clipboard.writeText(md);
		} catch {
			// Clipboard API may be blocked; fall through silently.
		}
	};

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
					gap: 0.5,
				}}
			>
				<Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
					Comments
				</Typography>
				<Tooltip title="Export to clipboard as markdown">
					<span>
						<IconButton
							size="small"
							onClick={handleExport}
							disabled={visibleComments.length === 0}
							aria-label="Export comments"
							sx={{ color: "text.secondary" }}
						>
							<ContentCopyIcon fontSize="small" />
						</IconButton>
					</span>
				</Tooltip>
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
			<Box
				sx={{
					px: 1.5,
					py: 1,
					display: "flex",
					alignItems: "center",
					gap: 1,
					borderBottom: 1,
					borderColor: "divider",
					flexShrink: 0,
				}}
			>
				<Select
					size="small"
					value={scope}
					onChange={(e) => setScope(e.target.value as Scope)}
					sx={{ flex: 1, fontSize: "0.8125rem" }}
				>
					<MenuItem value="document">{scopeLabel("document")}</MenuItem>
					<MenuItem value="repo">{scopeLabel("repo")}</MenuItem>
					<MenuItem value="orphans">{scopeLabel("orphans")}</MenuItem>
					<MenuItem value="all">{scopeLabel("all")}</MenuItem>
				</Select>
				<Tooltip
					title={canCompose ? "Add comment" : "No target for new comment"}
				>
					<span>
						<IconButton
							size="small"
							onClick={() => setComposerOpen((o) => !o)}
							disabled={!canCompose}
							aria-label="Add comment"
							sx={{
								bgcolor: composerOpen ? "action.selected" : undefined,
								color: "text.secondary",
							}}
						>
							<AddIcon fontSize="small" />
						</IconButton>
					</span>
				</Tooltip>
			</Box>
			{composerOpen && canCompose && (
				<Box
					sx={{
						px: 1.5,
						py: 1,
						borderBottom: 1,
						borderColor: "divider",
						flexShrink: 0,
					}}
				>
					<TextField
						autoFocus
						multiline
						minRows={2}
						maxRows={6}
						fullWidth
						placeholder={
							scope === "repo"
								? "Add a repo-level comment…"
								: "Add a comment on this document…"
						}
						value={composerBody}
						onChange={(e) => setComposerBody(e.target.value)}
						size="small"
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								void submitNewComment();
							}
							if (e.key === "Escape") {
								e.preventDefault();
								setComposerOpen(false);
								setComposerBody("");
							}
						}}
					/>
					<Box
						sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}
					>
						<Button
							size="small"
							onClick={() => {
								setComposerOpen(false);
								setComposerBody("");
							}}
						>
							Cancel
						</Button>
						<Button
							size="small"
							variant="contained"
							disabled={!composerBody.trim()}
							onClick={() => void submitNewComment()}
						>
							Comment
						</Button>
					</Box>
				</Box>
			)}
			<Tabs
				value={resolvedTab}
				onChange={(_, v) => setResolvedTab(v as ResolvedTab)}
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
							No {resolvedTab} comments
						</Typography>
					</Box>
				) : (
					visibleComments.map((c) => (
						<CommentItem
							key={c.id}
							comment={c}
							onJump={handleJump}
							onToggleResolved={(id) => void toggleResolved(id)}
							onDelete={(id) => void deleteComment(id)}
						/>
					))
				)}
			</Box>
		</Box>
	);
}
