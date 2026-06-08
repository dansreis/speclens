import { keyframes } from "@emotion/react";
import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { SelectionPopover } from "../comments/SelectionPopover";
import { rehypeEarsKeywords } from "../lib/earsKeywords";
import {
	applyHighlights,
	countOccurrenceBefore,
	type HighlightTarget,
} from "../lib/highlight";
import { useAppStore } from "../store/useAppStore";
import { useCommentsStore } from "../store/useCommentsStore";

const flashAnim = keyframes`
  0%, 100% {
    background-color: rgba(253, 224, 71, 0.85);
    box-shadow: inset 0 0 0 0 transparent;
  }
  50% {
    background-color: transparent;
    box-shadow: inset 0 0 0 2px rgba(253, 189, 24, 1);
  }
`;

interface Props {
	source: string;
	documentId?: string;
}

interface PendingSelection {
	text: string;
	occurrence: number;
	top: number;
	left: number;
}

export function MarkdownView({ source, documentId }: Props) {
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [pending, setPending] = useState<PendingSelection | null>(null);
	const comments = useCommentsStore((s) => s.comments);
	const addComment = useCommentsStore((s) => s.addComment);
	const scrollTarget = useAppStore((s) => s.scrollTarget);
	const setScrollTarget = useAppStore((s) => s.setScrollTarget);
	const markdownZoom = useAppStore((s) => s.markdownZoom);
	const highlightEars = useAppStore((s) => s.highlightEars);

	const rehypePlugins = useMemo(
		() =>
			highlightEars
				? [rehypeRaw, rehypeSlug, rehypeEarsKeywords]
				: [rehypeRaw, rehypeSlug],
		[highlightEars],
	);

	const highlights: HighlightTarget[] = documentId
		? comments
				.filter((c) => c.highlight?.documentId === documentId)
				.map((c) => ({
					text: c.highlight?.text ?? "",
					occurrence: c.highlight?.occurrence ?? 1,
				}))
		: [];

	useEffect(() => {
		const container = contentRef.current;
		if (!container) return;
		applyHighlights(container, highlights);

		if (scrollTarget && documentId && scrollTarget.documentId === documentId) {
			const marks = container.querySelectorAll<HTMLElement>(
				"mark.user-highlight",
			);
			let count = 0;
			for (const mark of marks) {
				if (mark.textContent === scrollTarget.text) {
					count++;
					if (count === scrollTarget.occurrence) {
						mark.scrollIntoView({ behavior: "smooth", block: "center" });
						mark.classList.add("flash");
						window.setTimeout(() => {
							mark.classList.remove("flash");
							setScrollTarget(null);
						}, 550);
						break;
					}
				}
			}
		}
	});

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

	const handleSubmit = (body: string) => {
		if (!pending || !documentId) return;
		addComment(body, {
			text: pending.text,
			occurrence: pending.occurrence,
			documentId,
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
						bgcolor: "rgba(253, 224, 71, 0.45)",
						borderRadius: "2px",
						px: "1px",
						color: "inherit",
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
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					rehypePlugins={rehypePlugins}
				>
					{source}
				</ReactMarkdown>
			</Box>
			{pending && (
				<SelectionPopover
					top={pending.top}
					left={pending.left}
					onSubmit={handleSubmit}
					onCancel={() => setPending(null)}
				/>
			)}
		</>
	);
}
