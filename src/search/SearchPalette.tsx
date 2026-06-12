import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SearchIcon from "@mui/icons-material/Search";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { Box, ButtonBase, Dialog, InputBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type React from "react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

const SPEC_COLOR = "info" as const;
const CHANGE_COLOR = "success" as const;

const filterColor: Record<
	"all" | "specs" | "changes",
	"primary" | "info" | "success"
> = {
	all: "primary",
	specs: SPEC_COLOR,
	changes: CHANGE_COLOR,
};

type FilterKind = "all" | "specs" | "changes";

interface SpecResult {
	kind: "spec";
	capability: string;
	changeName: string;
	titleMatch: MatchRange | null;
	snippet: HighlightedText | null;
}

interface ChangeResult {
	kind: "change";
	name: string;
	key: string;
	titleMatch: MatchRange | null;
	snippet: HighlightedText | null;
}

type Result = SpecResult | ChangeResult;

interface MatchRange {
	start: number;
	end: number;
}

interface HighlightedText {
	text: string;
	matches: MatchRange[];
}

const SNIPPET_RADIUS = 60;

interface Props {
	open: boolean;
	onClose: () => void;
}

function findTitleMatch(title: string, q: string): MatchRange | null {
	if (!q) return null;
	const idx = title.toLowerCase().indexOf(q);
	if (idx === -1) return null;
	return { start: idx, end: idx + q.length };
}

function findSnippet(text: string, q: string): HighlightedText | null {
	if (!q || !text) return null;
	const lower = text.toLowerCase();
	const idx = lower.indexOf(q);
	if (idx === -1) return null;
	const start = Math.max(0, idx - SNIPPET_RADIUS);
	const end = Math.min(text.length, idx + q.length + SNIPPET_RADIUS);
	let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
	const prefix = start > 0 ? "…" : "";
	const suffix = end < text.length ? "…" : "";
	snippet = prefix + snippet + suffix;
	const matches: MatchRange[] = [];
	const sLower = snippet.toLowerCase();
	let from = 0;
	while (true) {
		const i = sLower.indexOf(q, from);
		if (i === -1) break;
		matches.push({ start: i, end: i + q.length });
		from = i + q.length;
	}
	return { text: snippet, matches };
}

function renderHighlighted(text: string, range: MatchRange | null): ReactNode {
	if (!range) return text;
	return (
		<>
			{text.slice(0, range.start)}
			<Box
				component="mark"
				sx={{
					bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
					color: "primary.main",
					borderRadius: 0.25,
					px: 0.25,
				}}
			>
				{text.slice(range.start, range.end)}
			</Box>
			{text.slice(range.end)}
		</>
	);
}

function renderHighlightedMulti(highlighted: HighlightedText): ReactNode {
	const { text, matches } = highlighted;
	if (matches.length === 0) return text;
	const parts: ReactNode[] = [];
	let cursor = 0;
	for (let i = 0; i < matches.length; i++) {
		const m = matches[i];
		if (m.start > cursor) parts.push(text.slice(cursor, m.start));
		parts.push(
			<Box
				key={`m-${i}`}
				component="mark"
				sx={{
					bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
					color: "primary.main",
					borderRadius: 0.25,
					px: 0.25,
				}}
			>
				{text.slice(m.start, m.end)}
			</Box>,
		);
		cursor = m.end;
	}
	if (cursor < text.length) parts.push(text.slice(cursor));
	return <>{parts}</>;
}

export function SearchPalette({ open, onClose }: Props) {
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const setView = useAppStore((s) => s.setView);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const repos = useAppStore((s) => s.repos);
	const repo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];

	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<FilterKind>("all");
	const [activeIndex, setActiveIndex] = useState(0);
	const listRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (open) {
			setQuery("");
			setFilter("all");
			setActiveIndex(0);
		}
	}, [open]);

	const allResults = useMemo(() => {
		const empty = { specs: [] as SpecResult[], changes: [] as ChangeResult[] };
		if (!repo) return empty;
		const q = query.trim().toLowerCase();
		if (!q) return empty;
		const specs = new Map<string, SpecResult>();
		const changes: ChangeResult[] = [];
		for (const change of repo.changes) {
			const key = `${change.archived ? "archive/" : ""}${change.slug}`;
			const titleMatch =
				findTitleMatch(change.name, q) ?? findTitleMatch(change.slug, q);
			const changeContent = [
				change.proposal ?? "",
				change.tasks ?? "",
				...Object.values(change.specs),
			].join("\n\n");
			const snippet = findSnippet(changeContent, q);
			if (titleMatch || snippet) {
				changes.push({
					kind: "change",
					name: change.name,
					key,
					titleMatch,
					snippet,
				});
			}
			for (const [cap, content] of Object.entries(change.specs)) {
				if (specs.has(cap)) continue;
				const capTitleMatch = findTitleMatch(cap, q);
				const capSnippet = findSnippet(content, q);
				if (capTitleMatch || capSnippet) {
					specs.set(cap, {
						kind: "spec",
						capability: cap,
						changeName: change.name,
						titleMatch: capTitleMatch,
						snippet: capSnippet,
					});
				}
			}
		}
		return { specs: [...specs.values()], changes };
	}, [repo, query]);

	const visibleSpecs = filter === "changes" ? [] : allResults.specs;
	const visibleChanges = filter === "specs" ? [] : allResults.changes;
	const flat: Result[] = [...visibleSpecs, ...visibleChanges];

	const clampedActive = Math.min(activeIndex, Math.max(0, flat.length - 1));

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll active item into view when index changes
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const el = list.querySelector<HTMLElement>(
			`[data-search-index="${clampedActive}"]`,
		);
		el?.scrollIntoView({ block: "nearest" });
	}, [clampedActive, query, filter]);

	const handleSelect = (result: Result) => {
		if (result.kind === "spec") {
			setView("specs");
			setSelectedSpec(result.capability);
			setActiveTab("specs");
		} else {
			setView("changes");
			setSelectedChangeKey(result.key);
			setActiveTab("proposal");
		}
		onClose();
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(0, i - 1));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const r = flat[clampedActive];
			if (r) handleSelect(r);
		}
	};

	const renderResult = (result: Result, index: number) => {
		const isActive = index === clampedActive;
		const title = result.kind === "spec" ? result.capability : result.name;
		const accent = result.kind === "spec" ? SPEC_COLOR : CHANGE_COLOR;
		const Icon =
			result.kind === "spec" ? DescriptionOutlinedIcon : TrendingUpIcon;
		return (
			<ButtonBase
				key={
					result.kind === "spec"
						? `s::${result.capability}`
						: `c::${result.key}`
				}
				data-search-index={index}
				onClick={() => handleSelect(result)}
				sx={{
					display: "flex",
					alignItems: "flex-start",
					gap: 1.25,
					textAlign: "left",
					width: "100%",
					px: 2,
					py: 1,
					bgcolor: isActive ? "action.hover" : "transparent",
					transition: "background-color 100ms",
					"&:hover": { bgcolor: "action.hover" },
				}}
			>
				<Icon
					sx={{
						fontSize: 16,
						color: `${accent}.main`,
						mt: 0.25,
						flexShrink: 0,
					}}
				/>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography
						variant="body2"
						sx={{ fontWeight: 500, color: "text.primary" }}
					>
						{renderHighlighted(title, result.titleMatch)}
					</Typography>
					{result.snippet && (
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{
								display: "-webkit-box",
								WebkitLineClamp: 1,
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
								mt: 0.25,
							}}
						>
							{renderHighlightedMulti(result.snippet)}
						</Typography>
					)}
				</Box>
			</ButtonBase>
		);
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
			slotProps={{
				paper: { sx: { borderRadius: 1.5 } },
				transition: { onEntered: () => inputRef.current?.focus() },
			}}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1,
					px: 2,
					borderBottom: 1,
					borderColor: "divider",
				}}
			>
				<SearchIcon sx={{ color: "text.secondary" }} />
				<InputBase
					autoFocus
					fullWidth
					inputRef={inputRef}
					placeholder="Search specs and changes..."
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={onKeyDown}
					sx={{ flex: 1, py: 1.5, fontSize: "0.875rem" }}
				/>
				<Box
					component="kbd"
					sx={{
						fontSize: "0.6875rem",
						color: "text.secondary",
						bgcolor: "action.hover",
						px: 0.75,
						py: 0.25,
						borderRadius: 0.5,
						border: 1,
						borderColor: "divider",
						fontFamily: "ui-monospace, monospace",
					}}
				>
					ESC
				</Box>
			</Box>
			{query.trim() && (
				<Box sx={{ display: "flex", gap: 0.75, px: 2, pt: 1.25, pb: 0.5 }}>
					{(["all", "specs", "changes"] as FilterKind[]).map((f) => {
						const isActive = f === filter;
						const c = filterColor[f];
						return (
							<ButtonBase
								key={f}
								onClick={() => {
									setFilter(f);
									setActiveIndex(0);
								}}
								sx={{
									px: 1.25,
									py: 0.25,
									borderRadius: 999,
									fontSize: "0.75rem",
									textTransform: "capitalize",
									bgcolor: isActive
										? (theme) => alpha(theme.palette[c].main, 0.2)
										: "action.hover",
									color: isActive ? `${c}.main` : "text.secondary",
									transition: "background-color 150ms, color 150ms",
									"&:hover": {
										color: isActive ? `${c}.main` : "text.primary",
									},
								}}
							>
								{f}
							</ButtonBase>
						);
					})}
				</Box>
			)}
			<Box ref={listRef} sx={{ maxHeight: 360, overflowY: "auto" }}>
				{!query.trim() ? (
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ p: 3, textAlign: "center" }}
					>
						Type to search across specs and changes...
					</Typography>
				) : flat.length === 0 ? (
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ p: 3, textAlign: "center" }}
					>
						No matches for “{query}”
					</Typography>
				) : (
					<>
						{visibleSpecs.length > 0 && (
							<Box>
								<Box
									sx={{
										px: 2,
										pt: 1.5,
										pb: 0.5,
										fontSize: "0.6875rem",
										fontWeight: 700,
										color: `${SPEC_COLOR}.main`,
										textTransform: "uppercase",
										letterSpacing: "0.05em",
									}}
								>
									Specs
								</Box>
								{visibleSpecs.map((r, i) => renderResult(r, i))}
							</Box>
						)}
						{visibleChanges.length > 0 && (
							<Box>
								<Box
									sx={{
										px: 2,
										pt: 1.5,
										pb: 0.5,
										fontSize: "0.6875rem",
										fontWeight: 700,
										color: `${CHANGE_COLOR}.main`,
										textTransform: "uppercase",
										letterSpacing: "0.05em",
									}}
								>
									Changes
								</Box>
								{visibleChanges.map((r, i) =>
									renderResult(r, visibleSpecs.length + i),
								)}
							</Box>
						)}
					</>
				)}
			</Box>
		</Dialog>
	);
}
