import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
	Box,
	IconButton,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	ListSubheader,
	ToggleButton,
	ToggleButtonGroup,
	Tooltip,
	Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";
import {
	type CheckSeverity,
	changeKeyOf,
	countBySeverity,
	type SpecCheckResult,
} from "../lib/specChecks";
import { useAppStore } from "../store/useAppStore";
import { jumpToFinding } from "./specCheckJump";
import { useSpecCheckResults } from "./useSpecChecks";

const MIN_WIDTH = 300;
const MAX_WIDTH = 640;

// Views where findings live (documents + the checks analysis view). On any
// other view the panel hides; the open state survives, so it reappears when
// the user returns - same idiom as the AI panel on canvas views.
const CHECKS_VIEWS = new Set(["changes", "specs", "checks"]);

const SEVERITY_ICON: Record<CheckSeverity, React.ReactNode> = {
	error: <ErrorOutlinedIcon fontSize="small" color="error" />,
	warning: <WarningAmberIcon fontSize="small" color="warning" />,
	info: <InfoOutlinedIcon fontSize="small" color="info" />,
};

interface Group {
	changeKey: string;
	changeName: string;
	results: SpecCheckResult[];
}

/** What the panel scopes to when the user is inside a change or a spec. */
interface ScopeContext {
	label: string;
	matches: (result: SpecCheckResult) => boolean;
}

/**
 * IDE-style "Problems" panel: spec-check findings for the active repo,
 * grouped by change, docked on the right like the comments panel and
 * drag-resizable like the AI panel. While a change or capability spec is
 * open, the panel scopes to its findings (toggleable back to all). Clicking
 * a finding navigates and blink-highlights the offending text.
 */
export function SpecChecksPanel() {
	const panelOpen = useAppStore((s) => s.specChecksPanelOpen);
	const setOpen = useAppStore((s) => s.setSpecChecksPanelOpen);
	const repos = useAppStore((s) => s.repos);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const enabled = useAppStore((s) => s.settings.specChecks);
	const panelWidth = useAppStore((s) => s.settings.checksPanelWidth);
	const view = useAppStore((s) => s.view);
	const selectedChangeKey = useAppStore((s) => s.selectedChangeKey);
	const selectedSpec = useAppStore((s) => s.selectedSpec);
	const [showAll, setShowAll] = useState(false);
	const [resizing, setResizing] = useState(false);

	const open = panelOpen && CHECKS_VIEWS.has(view);
	const repo = repos.find((r) => r.id === selectedRepoId) ?? null;

	const results = useSpecCheckResults(repo);

	// Scope follows what the user is reading. "This spec" covers the
	// capability's canonical spec and every delta touching it.
	const context: ScopeContext | null = useMemo(() => {
		if (view === "changes" && selectedChangeKey) {
			return {
				label: "This change",
				matches: (r) => r.changeKey === selectedChangeKey,
			};
		}
		if (view === "specs" && selectedSpec) {
			return {
				label: "This spec",
				matches: (r) => r.capability === selectedSpec,
			};
		}
		return null;
	}, [view, selectedChangeKey, selectedSpec]);

	const scoped = context !== null && !showAll;
	const visible = useMemo(
		() => (scoped && context ? results.filter(context.matches) : results),
		[results, scoped, context],
	);

	const groups = useMemo(() => {
		const byKey = new Map<string, Group>();
		for (const result of visible) {
			// Canonical-spec findings have no owning change; group per capability.
			const groupKey = result.changeKey ?? `spec:${result.capability}`;
			let group = byKey.get(groupKey);
			if (!group) {
				const change = result.changeKey
					? repo?.changes.find((c) => changeKeyOf(c) === result.changeKey)
					: undefined;
				group = {
					changeKey: groupKey,
					changeName: result.changeKey
						? (change?.name ?? result.changeKey)
						: `${result.capability} (spec)`,
					results: [],
				};
				byKey.set(groupKey, group);
			}
			group.results.push(result);
		}
		return [...byKey.values()].sort((a, b) =>
			a.changeName.localeCompare(b.changeName),
		);
	}, [visible, repo]);

	const counts = countBySeverity(visible);

	// Same drag idiom as the AI panel: pointer capture, width written straight
	// to the persisted setting, no transition while dragging.
	const handleResizeStart = (e: React.PointerEvent<HTMLElement>) => {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = useAppStore.getState().settings.checksPanelWidth;
		const handle = e.currentTarget;
		handle.setPointerCapture(e.pointerId);
		setResizing(true);
		const onMove = (ev: PointerEvent) => {
			// Panel sits on the right, so dragging left grows it.
			const w = Math.round(
				Math.min(
					MAX_WIDTH,
					Math.max(MIN_WIDTH, startWidth + startX - ev.clientX),
				),
			);
			useAppStore.getState().setSetting("checksPanelWidth", w);
		};
		const onUp = () => {
			setResizing(false);
			handle.removeEventListener("pointermove", onMove);
			handle.removeEventListener("pointerup", onUp);
			handle.removeEventListener("pointercancel", onUp);
		};
		handle.addEventListener("pointermove", onMove);
		handle.addEventListener("pointerup", onUp);
		handle.addEventListener("pointercancel", onUp);
	};

	const handleJump = (result: SpecCheckResult) => {
		if (repo) jumpToFinding(repo, result);
	};

	return (
		<Box
			sx={{
				position: "relative",
				width: open ? panelWidth : 0,
				flexShrink: 0,
				transition: resizing ? "none" : "width 200ms ease-in-out",
				borderLeft: open ? 1 : 0,
				borderColor: "divider",
				bgcolor: "background.paper",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				pointerEvents: open ? "auto" : "none",
			}}
		>
			{open && (
				<Box
					onPointerDown={handleResizeStart}
					onDoubleClick={() =>
						useAppStore.getState().setSetting("checksPanelWidth", 380)
					}
					aria-label="Resize spec checks panel"
					sx={{
						position: "absolute",
						top: 0,
						left: 0,
						bottom: 0,
						width: 5,
						cursor: "col-resize",
						zIndex: 1,
						bgcolor: resizing
							? (t) => alpha(t.palette.primary.main, 0.3)
							: "transparent",
						transition: "background-color 150ms",
						"&:hover": {
							bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
						},
					}}
				/>
			)}
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					px: 1.5,
					py: 1,
					borderBottom: 1,
					borderColor: "divider",
					flexShrink: 0,
					gap: 1,
				}}
			>
				<Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
					Spec checks
				</Typography>
				{context && (
					<ToggleButtonGroup
						size="small"
						exclusive
						value={scoped ? "scoped" : "all"}
						onChange={(_, v) => v && setShowAll(v === "all")}
						sx={{
							"& .MuiToggleButton-root": {
								py: 0,
								px: 1,
								textTransform: "none",
								fontSize: "0.6875rem",
							},
						}}
					>
						<ToggleButton value="scoped">{context.label}</ToggleButton>
						<ToggleButton value="all">All</ToggleButton>
					</ToggleButtonGroup>
				)}
				<Tooltip title="Close">
					<IconButton
						size="small"
						onClick={() => setOpen(false)}
						aria-label="Close spec checks panel"
						sx={{ color: "text.secondary" }}
					>
						<CloseIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			</Box>
			<Box
				sx={{
					px: 1.5,
					py: 0.5,
					borderBottom: 1,
					borderColor: "divider",
					flexShrink: 0,
				}}
			>
				<Typography variant="caption" color="text.secondary">
					{counts.errors} errors · {counts.warnings} warnings · {counts.infos}{" "}
					info
				</Typography>
			</Box>
			<Box sx={{ flex: 1, overflowY: "auto" }}>
				{visible.length === 0 ? (
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 1,
							py: 6,
							px: 2,
							color: "text.secondary",
						}}
					>
						<CheckCircleOutlinedIcon color="success" />
						<Typography variant="body2" sx={{ textAlign: "center" }}>
							{!enabled
								? "Spec checks are disabled in Settings."
								: scoped && context
									? `No findings for ${context.label.toLowerCase()}.`
									: "No findings - all checks pass for this repository."}
						</Typography>
						{scoped && context && results.length > 0 && (
							<Typography variant="caption" sx={{ textAlign: "center" }}>
								{results.length} finding{results.length === 1 ? "" : "s"}{" "}
								elsewhere in the repository - switch to "All".
							</Typography>
						)}
					</Box>
				) : (
					<List dense disablePadding>
						{groups.map((group) => (
							<Box key={group.changeKey}>
								<ListSubheader
									sx={{
										lineHeight: 2.2,
										bgcolor: "background.default",
										borderBottom: 1,
										borderColor: "divider",
										fontWeight: 600,
									}}
								>
									{group.changeName}
									<Typography
										component="span"
										variant="caption"
										color="text.secondary"
										sx={{ ml: 1 }}
									>
										{group.results.length}
									</Typography>
								</ListSubheader>
								{group.results.map((result, i) => (
									<ListItemButton
										// biome-ignore lint/suspicious/noArrayIndexKey: results are recomputed wholesale, never reordered in place
										key={`${result.id}-${i}`}
										onClick={() => handleJump(result)}
										sx={{ alignItems: "flex-start", gap: 1, py: 0.75 }}
									>
										<ListItemIcon sx={{ minWidth: 24, mt: 0.5 }}>
											{SEVERITY_ICON[result.severity]}
										</ListItemIcon>
										<ListItemText
											primary={result.message}
											secondary={[result.id, result.tab, result.heading]
												.filter(Boolean)
												.join(" · ")}
											slotProps={{
												primary: { sx: { fontSize: "0.8125rem" } },
												secondary: {
													sx: {
														fontSize: "0.6875rem",
														fontFamily: "ui-monospace, monospace",
													},
												},
											}}
										/>
									</ListItemButton>
								))}
							</Box>
						))}
					</List>
				)}
			</Box>
		</Box>
	);
}
