import { keyframes } from "@emotion/react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import {
	Avatar,
	Box,
	Fade,
	IconButton,
	Paper,
	Popper,
	Tooltip,
	Typography,
} from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { SelectionPopover } from "../comments/SelectionPopover";
import type { AppComment, DocumentKind } from "../lib/comments";
import { rehypeEarsKeywords } from "../lib/earsKeywords";
import {
	applyHighlights,
	countOccurrenceBefore,
	type HighlightTarget,
	highlightKey,
} from "../lib/highlight";
import { formatRelativeTime } from "../lib/relativeTime";
import { useCurrentDocument } from "../lib/useCurrentDocument";
import { useAppStore } from "../store/useAppStore";
import { useCommentsStore } from "../store/useCommentsStore";
import { MermaidDiagram } from "./MermaidDiagram";

// ```mermaid fences arrive as <pre><code class="language-mermaid">. Intercept
// at the <pre> level so the diagram isn't wrapped in the styled code block.
const markdownComponents: Components = {
	pre({ node, children, ...rest }) {
		const child = node?.children[0];
		if (
			child?.type === "element" &&
			child.tagName === "code" &&
			Array.isArray(child.properties?.className) &&
			child.properties.className.includes("language-mermaid")
		) {
			const code = child.children
				.map((c) => (c.type === "text" ? c.value : ""))
				.join("");
			return <MermaidDiagram code={code.trim()} />;
		}
		return <pre {...rest}>{children}</pre>;
	},
};

// Flash keyframes depend on the user-chosen highlight color, so they're built
// per-color rather than at module scope. The blink still fades the fill to
// transparent at 50% and pulses a darker inset ring so the mark reads on any hue.
const makeFlashAnim = (color: string) => keyframes`
  0%, 100% {
    background-color: ${alpha(color, 0.85)};
    box-shadow: inset 0 0 0 0 transparent;
  }
  50% {
    background-color: transparent;
    box-shadow: inset 0 0 0 2px ${darken(color, 0.25)};
  }
`;

interface Props {
	source: string;
	documentId?: string;
	documentKind?: DocumentKind;
}

interface PendingSelection {
	text: string;
	occurrence: number;
	top: number;
	left: number;
}

export function MarkdownView({
	source,
	documentId,
	documentKind = "change",
}: Props) {
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [pending, setPending] = useState<PendingSelection | null>(null);
	const comments = useCommentsStore((s) => s.comments);
	const addComment = useCommentsStore((s) => s.addComment);
	const deleteComment = useCommentsStore((s) => s.deleteComment);
	const toggleResolved = useCommentsStore((s) => s.toggleResolved);
	const setHighlightOrphans = useCommentsStore((s) => s.setHighlightOrphans);
	const scrollTarget = useAppStore((s) => s.scrollTarget);
	const setScrollTarget = useAppStore((s) => s.setScrollTarget);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const markdownZoom = useAppStore((s) => s.markdownZoom);
	const highlightEars = useAppStore((s) => s.highlightEars);
	const highlightColor = useAppStore((s) => s.settings.highlightColor);
	const flashAnim = useMemo(
		() => makeFlashAnim(highlightColor),
		[highlightColor],
	);

	useCurrentDocument(documentId ?? null);

	const rehypePlugins = useMemo(
		() =>
			highlightEars
				? [rehypeRaw, rehypeSlug, rehypeEarsKeywords]
				: [rehypeRaw, rehypeSlug],
		[highlightEars],
	);

	// Resolved comments are intentionally excluded: resolving a comment removes
	// its highlight from the document (and, since it's no longer rendered, stops
	// it from being flagged as an orphan by the applyHighlights pass below).
	const commentsForDoc = useMemo(
		() =>
			documentId && selectedRepoId
				? comments.filter(
						(c) =>
							c.highlight &&
							!c.resolved &&
							c.repoId === selectedRepoId &&
							c.documentId === documentId,
					)
				: [],
		[comments, documentId, selectedRepoId],
	);

	const highlights: HighlightTarget[] = useMemo(
		() =>
			commentsForDoc.map((c) => ({
				id: c.id,
				text: c.highlight?.text ?? "",
				occurrence: c.highlight?.occurrence ?? 1,
			})),
		[commentsForDoc],
	);

	// highlightKey (text|occurrence) → the comment(s) sharing that highlight,
	// used to resolve which comment a hovered <mark> belongs to.
	const commentsByKey = useMemo(() => {
		const map = new Map<string, AppComment[]>();
		for (const c of commentsForDoc) {
			if (!c.highlight) continue;
			const key = highlightKey({
				text: c.highlight.text,
				occurrence: c.highlight.occurrence,
			});
			const arr = map.get(key);
			if (arr) arr.push(c);
			else map.set(key, [c]);
		}
		return map;
	}, [commentsForDoc]);
	const commentsByKeyRef = useRef(commentsByKey);
	commentsByKeyRef.current = commentsByKey;

	const [hover, setHover] = useState<{
		key: string;
		comments: AppComment[];
	} | null>(null);
	const hideTimer = useRef<number | null>(null);

	// The render-time applyHighlights effect rebuilds every <mark> on each
	// render, so we can't anchor the Popper to a captured element (it gets
	// detached → reports a 0,0 rect). Anchor to a virtual element that re-queries
	// the live mark for the hovered key at measure time instead.
	const anchorEl = useMemo(() => {
		if (!hover) return null;
		return {
			getBoundingClientRect: () => {
				const container = contentRef.current;
				const mark = container?.querySelector<HTMLElement>(
					`mark.user-highlight[data-highlight-key="${CSS.escape(hover.key)}"]`,
				);
				return (mark ?? container)?.getBoundingClientRect() ?? new DOMRect();
			},
		};
	}, [hover]);

	const clearHide = useCallback(() => {
		if (hideTimer.current !== null) {
			window.clearTimeout(hideTimer.current);
			hideTimer.current = null;
		}
	}, []);
	const scheduleHide = useCallback(() => {
		clearHide();
		// Generous grace period so the cursor can travel from the highlight up
		// into the popover (crossing non-highlight content) without it closing.
		hideTimer.current = window.setTimeout(() => setHover(null), 450);
	}, [clearHide]);

	const handleDelete = useCallback(
		(id: string) => {
			if (!window.confirm("Delete this comment?")) return;
			void deleteComment(id);
			setHover((prev) => {
				if (!prev) return null;
				const remaining = prev.comments.filter((c) => c.id !== id);
				return remaining.length > 0 ? { ...prev, comments: remaining } : null;
			});
		},
		[deleteComment],
	);

	const handleToggleResolved = useCallback(
		(id: string) => {
			void toggleResolved(id);
			// The popover only shows unresolved comments, so resolving one removes
			// it (and its highlight). Drop it from the popover; close if it was the
			// last one so we don't dangle over a highlight that's about to vanish.
			setHover((prev) => {
				if (!prev) return null;
				const remaining = prev.comments.filter((c) => c.id !== id);
				return remaining.length > 0 ? { ...prev, comments: remaining } : null;
			});
		},
		[toggleResolved],
	);

	// Re-run only when the rendered DOM or the highlight targets/scroll intent
	// change - crucially NOT on every render. Hover/selection state changes must
	// not re-trigger the clear+rewrap DOM surgery below, which otherwise reflows
	// code blocks and collapses an in-progress text selection before a comment can
	// be added. `source` and `highlightEars` are read here because they change the
	// rendered DOM shape (content / EARS keyword spans), so highlights must re-sync.
	useEffect(() => {
		const container = contentRef.current;
		if (!container) return;
		// Read so they register as effect deps (see comment above).
		void source;
		void highlightEars;
		try {
			const found = applyHighlights(container, highlights);
			if (documentId && selectedRepoId) {
				const orphans: Record<string, boolean> = {};
				for (const [id, ok] of Object.entries(found)) orphans[id] = !ok;
				setHighlightOrphans(orphans, {
					repoId: selectedRepoId,
					documentId,
				});
			}

			if (
				scrollTarget &&
				documentId &&
				scrollTarget.documentId === documentId
			) {
				const key = highlightKey({
					text: scrollTarget.text,
					occurrence: scrollTarget.occurrence,
				});
				const marks = container.querySelectorAll<HTMLElement>(
					`mark.user-highlight[data-highlight-key="${CSS.escape(key)}"]`,
				);
				if (marks.length > 0) {
					marks[0].scrollIntoView({ behavior: "smooth", block: "center" });
					for (const mark of marks) mark.classList.add("flash");
					window.setTimeout(() => {
						for (const mark of marks) mark.classList.remove("flash");
						setScrollTarget(null);
					}, 550);
				}
			}
		} catch {
			// DOM mutation can race with React reconciliation when the
			// document switches; the next render's effect will redo this.
		}
	}, [
		highlights,
		documentId,
		selectedRepoId,
		scrollTarget,
		source,
		highlightEars,
		setHighlightOrphans,
		setScrollTarget,
	]);

	useEffect(() => {
		const container = contentRef.current;
		if (!container) return;
		const onMouseUp = () => {
			const selection = window.getSelection();
			if (!selection || selection.isCollapsed) {
				setPending(null);
				return;
			}
			const range = selection.getRangeAt(0);
			if (!container.contains(range.commonAncestorContainer)) {
				setPending(null);
				return;
			}
			// Selections inside a rendered mermaid SVG can't be highlighted (the
			// highlight walker skips [data-mermaid] subtrees), so don't offer to
			// comment on them.
			const anchorElement =
				range.commonAncestorContainer instanceof Element
					? range.commonAncestorContainer
					: range.commonAncestorContainer.parentElement;
			if (anchorElement?.closest("[data-mermaid]")) {
				setPending(null);
				return;
			}
			const text = selection.toString().trim();
			if (!text || !documentId) {
				setPending(null);
				return;
			}
			const rect = range.getBoundingClientRect();
			const occurrence = countOccurrenceBefore(container, range, text);
			setPending({
				text,
				occurrence,
				top: rect.top,
				left: rect.left + rect.width / 2,
			});
		};
		const onDocMouseDown = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (target?.closest('[data-selection-popover="true"]')) return;
			setPending(null);
		};
		container.addEventListener("mouseup", onMouseUp);
		document.addEventListener("mousedown", onDocMouseDown);
		return () => {
			container.removeEventListener("mouseup", onMouseUp);
			document.removeEventListener("mousedown", onDocMouseDown);
		};
	}, [documentId]);

	// Open the comment popover when hovering a highlighted <mark>. Marks are
	// injected by DOM mutation (outside React), so we listen via delegation.
	useEffect(() => {
		const container = contentRef.current;
		if (!container) return;
		const onOver = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			const mark = target?.closest<HTMLElement>("mark.user-highlight");
			if (!mark || !container.contains(mark)) return;
			const key = mark.dataset.highlightKey;
			const cs = key ? commentsByKeyRef.current.get(key) : undefined;
			if (cs && cs.length > 0 && key) {
				clearHide();
				setHover({ key, comments: cs });
			}
		};
		container.addEventListener("mouseover", onOver);
		return () => {
			container.removeEventListener("mouseover", onOver);
			clearHide();
		};
	}, [clearHide]);

	// While the popover is open, keep it open as long as the pointer is over the
	// originating highlight or the popover (its bridges included); only schedule a
	// hide when the pointer is over neither. Document-level so it also covers the
	// portaled popover. This avoids the fragile "schedule hide on every mouseover"
	// race that made the resolve/delete icons hard to reach.
	useEffect(() => {
		if (!hover) return;
		const markSel = `mark.user-highlight[data-highlight-key="${CSS.escape(hover.key)}"]`;
		const onDocOver = (e: MouseEvent) => {
			const t = e.target as HTMLElement | null;
			if (
				t?.closest('[data-comment-hover-popover="true"]') ||
				t?.closest(markSel)
			) {
				clearHide();
			} else {
				scheduleHide();
			}
		};
		document.addEventListener("mouseover", onDocOver);
		return () => document.removeEventListener("mouseover", onDocOver);
	}, [hover, clearHide, scheduleHide]);

	const handleSubmit = (body: string) => {
		if (!pending || !documentId || !selectedRepoId) return;
		void addComment({
			repoId: selectedRepoId,
			documentKind,
			documentId,
			body,
			quote: pending.text,
			highlight: {
				text: pending.text,
				occurrence: pending.occurrence,
			},
		});
		setPending(null);
		window.getSelection()?.removeAllRanges();
	};

	return (
		<>
			<Box
				ref={contentRef}
				sx={{
					fontSize: `${markdownZoom}rem`,
					transition: "font-size 150ms ease-out",
					"& h1": {
						fontSize: "2.125em",
						fontWeight: 400,
						lineHeight: 1.235,
						mt: 4,
						mb: 2,
					},
					"& h2": {
						fontSize: "1.5em",
						fontWeight: 400,
						lineHeight: 1.334,
						mt: 3,
						mb: 1.5,
					},
					"& h3": {
						fontSize: "1.25em",
						fontWeight: 500,
						lineHeight: 1.6,
						mt: 2,
						mb: 1,
					},
					"& h4, & h5, & h6": {
						fontSize: "1em",
						fontWeight: 400,
						lineHeight: 1.75,
						mt: 2,
						mb: 1,
					},
					"& p": { lineHeight: 1.65, mb: 1.5 },
					"& ul, & ol": { pl: 3, mb: 1.5 },
					"& li": { mb: 0.5 },
					"& code": {
						px: 0.75,
						py: 0.25,
						borderRadius: 0.5,
						bgcolor: "action.hover",
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						fontSize: "0.875em",
					},
					"& pre": {
						p: 2,
						my: 2,
						borderRadius: 1,
						bgcolor: "action.hover",
						overflowX: "auto",
					},
					"& pre code": { p: 0, bgcolor: "transparent" },
					"& blockquote": {
						borderLeft: 3,
						borderColor: "divider",
						pl: 2,
						my: 2,
						color: "text.secondary",
					},
					"& table": { borderCollapse: "collapse", my: 2 },
					"& th, & td": {
						border: 1,
						borderColor: "divider",
						px: 1.5,
						py: 0.75,
					},
					"& th": { bgcolor: "action.hover" },
					"& input[type=checkbox]": { mr: 1 },
					"& kbd": {
						display: "inline-block",
						px: 0.75,
						py: 0.125,
						mx: 0.25,
						borderRadius: 0.5,
						border: 1,
						borderColor: "divider",
						bgcolor: "background.paper",
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						fontSize: "0.8125em",
						lineHeight: 1.4,
						boxShadow: "inset 0 -1px 0 0",
					},
					"& details": {
						my: 2,
						borderLeft: 3,
						borderColor: "divider",
						pl: 2,
					},
					"& summary": { cursor: "pointer", fontWeight: 600 },
					"& mark.user-highlight": {
						bgcolor: alpha(highlightColor, 0.45),
						borderRadius: "2px",
						px: "1px",
						color: "inherit",
						cursor: "help",
						transition: "background-color 150ms",
					},
					"& mark.user-highlight:hover": {
						bgcolor: alpha(highlightColor, 0.7),
					},
					"& mark.user-highlight.flash": {
						animation: `${flashAnim} 0.225s ease-in-out 2`,
					},
					"& .ears-kw": {
						fontWeight: 600,
						borderRadius: "3px",
						px: "3px",
						py: "0.5px",
						fontVariantLigatures: "none",
					},
					"& .ears-shall, & .ears-must": {
						color: "primary.main",
						bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
					},
					"& .ears-should": {
						color: "info.main",
						bgcolor: (t) => alpha(t.palette.info.main, 0.12),
					},
					"& .ears-may": {
						color: "secondary.main",
						bgcolor: (t) => alpha(t.palette.secondary.main, 0.12),
					},
					"& .ears-when": {
						color: "success.main",
						bgcolor: (t) => alpha(t.palette.success.main, 0.12),
					},
					"& .ears-while": {
						color: "warning.main",
						bgcolor: (t) => alpha(t.palette.warning.main, 0.14),
					},
					"& .ears-where": {
						color: "secondary.main",
						bgcolor: (t) => alpha(t.palette.secondary.main, 0.12),
					},
					"& .ears-if": {
						color: "error.main",
						bgcolor: (t) => alpha(t.palette.error.main, 0.12),
					},
					"& .ears-then": {
						color: "info.main",
						bgcolor: (t) => alpha(t.palette.info.main, 0.12),
					},
					"& .ears-given, & .ears-and": {
						color: "text.secondary",
						bgcolor: "action.hover",
					},
				}}
			>
				{/* Keyed wrapper forces a full unmount/remount when the document
				    changes, so React removes the whole subtree as a single
				    operation. Without this, React diffs the markdown tree
				    node-by-node and crashes when our injected <mark> elements
				    have moved text nodes out of their original parents. */}
				<Box key={documentId ?? source.slice(0, 40)}>
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						rehypePlugins={rehypePlugins}
						components={markdownComponents}
					>
						{source}
					</ReactMarkdown>
				</Box>
			</Box>
			{pending && (
				<SelectionPopover
					top={pending.top}
					left={pending.left}
					onSubmit={handleSubmit}
					onCancel={() => setPending(null)}
				/>
			)}
			<Popper
				open={Boolean(hover)}
				anchorEl={anchorEl}
				placement="top"
				transition
				sx={{ zIndex: (t) => t.zIndex.tooltip }}
				modifiers={[{ name: "offset", options: { offset: [0, 4] } }]}
			>
				{({ TransitionProps }) => (
					<Fade {...TransitionProps} timeout={120}>
						<Paper
							elevation={4}
							data-comment-hover-popover="true"
							sx={{
								position: "relative",
								maxWidth: 320,
								maxHeight: 320,
								overflowY: "auto",
								p: 0,
								// Transparent bridges over the offset gap to the highlight so
								// the pointer never crosses a dead zone that closes the popover.
								// One on each side because the Popper flips above/below the
								// highlight depending on viewport room. `position: relative`
								// above anchors these to the Paper itself.
								"&::before, &::after": {
									content: '""',
									position: "absolute",
									left: 0,
									right: 0,
									height: 8,
								},
								"&::before": { top: "100%" },
								"&::after": { bottom: "100%" },
							}}
						>
							{hover?.comments.map((c, i) => (
								<Box
									key={c.id}
									sx={{
										p: 1.5,
										borderTop: i === 0 ? 0 : 1,
										borderColor: "divider",
										opacity: c.resolved ? 0.6 : 1,
									}}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1,
											mb: 0.75,
										}}
									>
										<Avatar
											sx={{
												width: 22,
												height: 22,
												fontSize: "0.7rem",
												bgcolor: c.resolved ? "text.disabled" : "primary.main",
											}}
										>
											{c.initials}
										</Avatar>
										<Typography
											variant="caption"
											sx={{ fontWeight: 600, lineHeight: 1.2 }}
										>
											{c.author}
										</Typography>
										<Typography
											variant="caption"
											sx={{ color: "text.secondary", ml: "auto" }}
										>
											{formatRelativeTime(c.timestamp)}
										</Typography>
										<Tooltip
											title={c.resolved ? "Mark unresolved" : "Resolve"}
											arrow
										>
											<IconButton
												size="small"
												onClick={() => handleToggleResolved(c.id)}
												aria-label={
													c.resolved ? "Mark unresolved" : "Mark resolved"
												}
												sx={{
													color: c.resolved ? "success.main" : "text.secondary",
													p: 0.25,
												}}
											>
												{c.resolved ? (
													<CheckCircleIcon sx={{ fontSize: "1rem" }} />
												) : (
													<CheckCircleOutlineIcon sx={{ fontSize: "1rem" }} />
												)}
											</IconButton>
										</Tooltip>
										<Tooltip title="Delete" arrow>
											<IconButton
												size="small"
												onClick={() => handleDelete(c.id)}
												aria-label="Delete comment"
												sx={{ color: "error.main", p: 0.25 }}
											>
												<DeleteOutlineIcon sx={{ fontSize: "1rem" }} />
											</IconButton>
										</Tooltip>
									</Box>
									<Typography
										variant="body2"
										sx={{
											lineHeight: 1.5,
											textDecoration: c.resolved ? "line-through" : "none",
											textDecorationColor: "text.disabled",
											whiteSpace: "pre-wrap",
											wordBreak: "break-word",
										}}
									>
										{c.body}
									</Typography>
								</Box>
							))}
						</Paper>
					</Fade>
				)}
			</Popper>
		</>
	);
}
