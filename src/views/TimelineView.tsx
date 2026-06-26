import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RemoveIcon from "@mui/icons-material/Remove";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";
import type { Change, Repo } from "../lib/repoLoader";
import { useAppStore } from "../store/useAppStore";

const COLORS = {
	active: "#16a34a", // change still in progress (not archived)
	archived: "#9ca3af", // completed / archived change
	capability: "#2563eb", // a capability touched by a change
};

const LEFT_W = 260;
const ROW_H = 40;
const CAP_ROW_H = 32;
const YEAR_H = 22;
const MONTH_H = 24;
const HEADER_H = YEAR_H + MONTH_H;
const MIN_BAR = 10;
const MONTH_W_MIN = 56;
const MONTH_W_MAX = 200;
const MONTH_W_STEP = 28;
const LEAD_W = 28; // width of the chevron / indent gutter in the name cell

interface Props {
	repo: Repo;
}

interface Row {
	key: string;
	change: Change;
	start: Date;
	end: Date;
	caps: string[];
}

type DisplayRow =
	| { kind: "change"; row: Row; expanded: boolean }
	| { kind: "cap"; parentKey: string; cap: string; start: Date; end: Date };

function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

function startOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** End date of a change: when it was archived, else its last edit (still active). */
function changeEnd(change: Change): Date | null {
	if (change.archived && change.archivedAt) return change.archivedAt;
	const last = change.authorship?.rolled.lastEditedAt;
	if (last) return new Date(last);
	return change.createdAt;
}

const dayMs = 24 * 60 * 60 * 1000;

const dateFmt = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
});
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });

export function TimelineView({ repo }: Props) {
	const themeMode = useAppStore((s) => s.themeMode);
	const selectedChangeKey = useAppStore((s) => s.selectedChangeKey);
	const [monthW, setMonthW] = useState(96);
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

	const today = useMemo(() => new Date(), []);

	const rows = useMemo<Row[]>(() => {
		const out: Row[] = [];
		for (const change of repo.changes) {
			if (!change.createdAt) continue;
			const end = changeEnd(change) ?? change.createdAt;
			out.push({
				key: `${change.archived ? "archive/" : ""}${change.slug}`,
				change,
				start: change.createdAt,
				// guard against clock skew where end precedes start
				end: end < change.createdAt ? change.createdAt : end,
				caps: Object.keys(change.specs).sort((a, b) => a.localeCompare(b)),
			});
		}
		out.sort(
			(a, b) =>
				a.start.getTime() - b.start.getTime() ||
				a.change.name.localeCompare(b.change.name),
		);
		return out;
	}, [repo]);

	const model = useMemo(() => {
		if (rows.length === 0) return null;
		let min = rows[0].start;
		let max = rows[0].end;
		for (const r of rows) {
			if (r.start < min) min = r.start;
			if (r.end > max) max = r.end;
		}
		if (today > max) max = today;
		const domainStart = startOfMonth(min);
		// months from domain start through the month containing `max`, inclusive
		const monthCount =
			(max.getFullYear() - domainStart.getFullYear()) * 12 +
			(max.getMonth() - domainStart.getMonth()) +
			1;
		const months: Date[] = [];
		for (let i = 0; i < monthCount; i++) {
			months.push(
				new Date(domainStart.getFullYear(), domainStart.getMonth() + i, 1),
			);
		}
		return { domainStart, months };
	}, [rows, today]);

	const navigateChange = (key: string) => {
		const s = useAppStore.getState();
		s.setSelectedChangeKey(key);
		s.setActiveTab("proposal");
		s.setView("changes");
	};

	const navigateSpec = (cap: string) => {
		const s = useAppStore.getState();
		s.setSelectedSpec(cap);
		s.setView("specs");
	};

	const toggleExpand = (key: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	if (!model) {
		return (
			<Box
				sx={{
					p: 4,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					minHeight: 400,
					gap: 2,
					textAlign: "center",
				}}
			>
				<TimelineOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
				<Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
					Timeline
				</Typography>
				<Typography
					variant="body2"
					color="text.secondary"
					sx={{ maxWidth: 420 }}
				>
					{repo.hasGit
						? "No changes with dates to chart yet."
						: "A timeline needs git history. This repository has no .git, so change creation and completion dates aren't available."}
				</Typography>
			</Box>
		);
	}

	const { domainStart, months } = model;
	const totalWidth = months.length * monthW;

	const dateToX = (d: Date): number => {
		const monthIndex =
			(d.getFullYear() - domainStart.getFullYear()) * 12 +
			(d.getMonth() - domainStart.getMonth());
		const dim = daysInMonth(d.getFullYear(), d.getMonth());
		const frac = (d.getDate() - 1 + d.getHours() / 24) / dim;
		const x = (monthIndex + frac) * monthW;
		return Math.max(0, Math.min(totalWidth, x));
	};

	// Group months into contiguous years for the top header tier.
	const yearGroups: { year: number; count: number }[] = [];
	for (const m of months) {
		const last = yearGroups[yearGroups.length - 1];
		if (last && last.year === m.getFullYear()) last.count += 1;
		else yearGroups.push({ year: m.getFullYear(), count: 1 });
	}

	const lineColor =
		themeMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
	const gridBg = `repeating-linear-gradient(to right, ${lineColor} 0, ${lineColor} 1px, transparent 1px, transparent ${monthW}px)`;
	const todayX = today >= domainStart ? dateToX(today) : null;

	const archivedCount = rows.filter((r) => r.change.archived).length;

	// Flatten into render rows, interleaving capability children under expanded
	// change rows.
	const displayRows: DisplayRow[] = [];
	for (const row of rows) {
		const isExpanded = expanded.has(row.key);
		displayRows.push({ kind: "change", row, expanded: isExpanded });
		if (isExpanded) {
			for (const cap of row.caps) {
				displayRows.push({
					kind: "cap",
					parentKey: row.key,
					cap,
					start: row.start,
					end: row.end,
				});
			}
		}
	}

	return (
		<Box
			sx={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				minHeight: 0,
				height: "100%",
			}}
		>
			{/* Toolbar: legend + zoom */}
			<Box
				sx={{
					px: 3,
					py: 1.5,
					display: "flex",
					alignItems: "center",
					gap: 2,
					borderBottom: 1,
					borderColor: "divider",
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
					<LegendDot color={COLORS.active} label="Active" />
					<LegendDot color={COLORS.archived} label="Archived" />
					<LegendDot color={COLORS.capability} label="Capability" />
					<Typography variant="caption" color="text.secondary">
						{rows.length} change{rows.length === 1 ? "" : "s"}
						{archivedCount > 0 ? ` · ${archivedCount} archived` : ""}
					</Typography>
				</Box>
				<Box sx={{ display: "flex", alignItems: "center" }}>
					<Tooltip title="Zoom out">
						<span>
							<IconButton
								size="small"
								aria-label="Zoom out"
								disabled={monthW <= MONTH_W_MIN}
								onClick={() =>
									setMonthW((w) => Math.max(MONTH_W_MIN, w - MONTH_W_STEP))
								}
							>
								<RemoveIcon fontSize="small" />
							</IconButton>
						</span>
					</Tooltip>
					<Tooltip title="Zoom in">
						<span>
							<IconButton
								size="small"
								aria-label="Zoom in"
								disabled={monthW >= MONTH_W_MAX}
								onClick={() =>
									setMonthW((w) => Math.min(MONTH_W_MAX, w + MONTH_W_STEP))
								}
							>
								<AddIcon fontSize="small" />
							</IconButton>
						</span>
					</Tooltip>
				</Box>
			</Box>

			{/* Scrollable chart (both axes) */}
			<Box
				sx={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}
			>
				<Box sx={{ width: LEFT_W + totalWidth, minWidth: "100%" }}>
					{/* Header */}
					<Box
						sx={{
							position: "sticky",
							top: 0,
							zIndex: 3,
							display: "flex",
							height: HEADER_H,
							bgcolor: "background.paper",
							borderBottom: 1,
							borderColor: "divider",
						}}
					>
						<Box
							sx={{
								position: "sticky",
								left: 0,
								zIndex: 4,
								width: LEFT_W,
								flexShrink: 0,
								bgcolor: "background.paper",
								borderRight: 1,
								borderColor: "divider",
								display: "flex",
								alignItems: "flex-end",
								px: 2,
								pb: 0.5,
							}}
						>
							<Typography
								variant="caption"
								sx={{
									fontWeight: 600,
									textTransform: "uppercase",
									letterSpacing: 0.6,
									color: "text.disabled",
									fontSize: "0.6875rem",
								}}
							>
								Change
							</Typography>
						</Box>
						<Box sx={{ position: "relative", width: totalWidth }}>
							{/* Year tier */}
							<Box sx={{ display: "flex", height: YEAR_H }}>
								{yearGroups.map((g) => (
									<Box
										key={g.year}
										sx={{
											width: g.count * monthW,
											flexShrink: 0,
											display: "flex",
											alignItems: "center",
											px: 1,
											borderRight: 1,
											borderColor: "divider",
											borderBottom: 1,
										}}
									>
										<Typography
											variant="caption"
											sx={{ fontWeight: 700, color: "text.secondary" }}
										>
											{g.year}
										</Typography>
									</Box>
								))}
							</Box>
							{/* Month tier */}
							<Box sx={{ display: "flex", height: MONTH_H }}>
								{months.map((m) => (
									<Box
										key={`${m.getFullYear()}-${m.getMonth()}`}
										sx={{
											width: monthW,
											flexShrink: 0,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											borderRight: 1,
											borderColor: "divider",
										}}
									>
										<Typography
											variant="caption"
											color="text.secondary"
											sx={{ fontSize: "0.6875rem" }}
										>
											{monthFmt.format(m)}
										</Typography>
									</Box>
								))}
							</Box>
						</Box>
					</Box>

					{/* Body */}
					<Box sx={{ position: "relative" }}>
						{/* Today marker spanning all rows */}
						{todayX !== null && (
							<Box
								sx={{
									position: "absolute",
									top: 0,
									bottom: 0,
									left: LEFT_W + todayX,
									width: "2px",
									bgcolor: "error.main",
									opacity: 0.5,
									zIndex: 1,
									pointerEvents: "none",
								}}
							/>
						)}
						{displayRows.map((dr) =>
							dr.kind === "change" ? (
								<ChangeRow
									key={dr.row.key}
									row={dr.row}
									expanded={dr.expanded}
									selected={dr.row.key === selectedChangeKey}
									totalWidth={totalWidth}
									gridBg={gridBg}
									dateToX={dateToX}
									onToggle={() => toggleExpand(dr.row.key)}
									onOpen={() => navigateChange(dr.row.key)}
								/>
							) : (
								<CapRow
									key={`${dr.parentKey}::${dr.cap}`}
									cap={dr.cap}
									start={dr.start}
									end={dr.end}
									totalWidth={totalWidth}
									gridBg={gridBg}
									dateToX={dateToX}
									onOpen={() => navigateSpec(dr.cap)}
								/>
							),
						)}
					</Box>
				</Box>
			</Box>
		</Box>
	);
}

interface ChangeRowProps {
	row: Row;
	expanded: boolean;
	selected: boolean;
	totalWidth: number;
	gridBg: string;
	dateToX: (d: Date) => number;
	onToggle: () => void;
	onOpen: () => void;
}

function ChangeRow({
	row,
	expanded,
	selected,
	totalWidth,
	gridBg,
	dateToX,
	onToggle,
	onOpen,
}: ChangeRowProps) {
	const x = dateToX(row.start);
	const w = Math.max(MIN_BAR, dateToX(row.end) - x);
	const color = row.change.archived ? COLORS.archived : COLORS.active;
	const days = Math.max(
		1,
		Math.round((row.end.getTime() - row.start.getTime()) / dayMs),
	);
	const author = row.change.authorship?.rolled.createdBy.name;
	const capCount = row.caps.length;

	return (
		<Box
			onClick={onOpen}
			sx={(t) => ({
				display: "flex",
				height: ROW_H,
				cursor: "pointer",
				"&:hover .tl-name": {
					backgroundImage: `linear-gradient(${alpha(
						t.palette.primary.main,
						0.06,
					)}, ${alpha(t.palette.primary.main, 0.06)})`,
				},
				"&:hover .tl-track": {
					backgroundColor: alpha(t.palette.primary.main, 0.04),
				},
			})}
		>
			<Box
				className="tl-name"
				sx={(t) => ({
					position: "sticky",
					left: 0,
					zIndex: 2,
					width: LEFT_W,
					flexShrink: 0,
					bgcolor: "background.paper",
					backgroundImage: selected
						? `linear-gradient(${alpha(t.palette.primary.main, 0.1)}, ${alpha(
								t.palette.primary.main,
								0.1,
							)})`
						: "none",
					borderRight: 1,
					borderBottom: 1,
					borderColor: "divider",
					display: "flex",
					alignItems: "center",
					pr: 1.5,
					pl: 0.5,
					minWidth: 0,
				})}
			>
				{capCount > 0 ? (
					<Tooltip title={expanded ? "Hide capabilities" : "Show capabilities"}>
						<IconButton
							size="small"
							aria-label={expanded ? "Collapse" : "Expand"}
							onClick={(e) => {
								e.stopPropagation();
								onToggle();
							}}
							sx={{ width: LEAD_W, height: LEAD_W, flexShrink: 0, p: 0 }}
						>
							{expanded ? (
								<ExpandMoreIcon fontSize="small" />
							) : (
								<ChevronRightIcon fontSize="small" />
							)}
						</IconButton>
					</Tooltip>
				) : (
					<Box sx={{ width: LEAD_W, flexShrink: 0 }} />
				)}
				<Box
					sx={{
						width: 8,
						height: 8,
						borderRadius: "50%",
						bgcolor: color,
						flexShrink: 0,
						mr: 1,
					}}
				/>
				<Typography
					variant="body2"
					sx={{
						fontWeight: selected ? 600 : 400,
						color: selected ? "primary.main" : "text.primary",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{row.change.name}
				</Typography>
				{capCount > 0 && (
					<Typography
						variant="caption"
						sx={{
							ml: "auto",
							pl: 1,
							color: "text.disabled",
							fontFamily: "ui-monospace, monospace",
							fontSize: "0.6875rem",
							flexShrink: 0,
						}}
					>
						{capCount}
					</Typography>
				)}
			</Box>
			<Box
				className="tl-track"
				sx={(t) => ({
					position: "relative",
					width: totalWidth,
					borderBottom: 1,
					borderColor: "divider",
					backgroundColor: selected
						? alpha(t.palette.primary.main, 0.06)
						: "transparent",
					backgroundImage: gridBg,
				})}
			>
				<Tooltip
					arrow
					placement="top"
					title={
						<Box sx={{ py: 0.5 }}>
							<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
								{row.change.name}
							</Typography>
							<Typography variant="caption" component="div">
								{row.change.archived ? "Archived" : "Active"} · {days} day
								{days === 1 ? "" : "s"}
							</Typography>
							<Typography variant="caption" component="div">
								Created {dateFmt.format(row.start)}
							</Typography>
							<Typography variant="caption" component="div">
								{row.change.archived ? "Archived" : "Last edit"}{" "}
								{dateFmt.format(row.end)}
							</Typography>
							{capCount > 0 && (
								<Typography variant="caption" component="div">
									{capCount} capabilit{capCount === 1 ? "y" : "ies"}
								</Typography>
							)}
							{author && (
								<Typography variant="caption" component="div">
									By {author}
								</Typography>
							)}
						</Box>
					}
				>
					<Box
						sx={{
							position: "absolute",
							top: "50%",
							left: x,
							width: w,
							height: 16,
							transform: "translateY(-50%)",
							borderRadius: 1,
							bgcolor: color,
							opacity: row.change.archived ? 0.55 : 0.9,
							border: selected ? "2px solid" : "none",
							borderColor: "primary.main",
							transition: "opacity 120ms",
							"&:hover": { opacity: 1 },
						}}
					/>
				</Tooltip>
			</Box>
		</Box>
	);
}

interface CapRowProps {
	cap: string;
	start: Date;
	end: Date;
	totalWidth: number;
	gridBg: string;
	dateToX: (d: Date) => number;
	onOpen: () => void;
}

function CapRow({
	cap,
	start,
	end,
	totalWidth,
	gridBg,
	dateToX,
	onOpen,
}: CapRowProps) {
	const x = dateToX(start);
	const w = Math.max(MIN_BAR, dateToX(end) - x);

	return (
		<Box
			onClick={onOpen}
			sx={(t) => ({
				display: "flex",
				height: CAP_ROW_H,
				cursor: "pointer",
				"&:hover .tl-name": {
					backgroundImage: `linear-gradient(${alpha(
						t.palette.primary.main,
						0.06,
					)}, ${alpha(t.palette.primary.main, 0.06)})`,
				},
				"&:hover .tl-track": {
					backgroundColor: alpha(t.palette.primary.main, 0.04),
				},
			})}
		>
			<Box
				className="tl-name"
				sx={{
					position: "sticky",
					left: 0,
					zIndex: 2,
					width: LEFT_W,
					flexShrink: 0,
					bgcolor: "background.paper",
					borderRight: 1,
					borderBottom: 1,
					borderColor: "divider",
					display: "flex",
					alignItems: "center",
					pr: 1.5,
					// indent past the chevron gutter so children nest under the change
					pl: `${LEAD_W + 12}px`,
					minWidth: 0,
				}}
			>
				<Box
					sx={{
						width: 7,
						height: 7,
						borderRadius: "50%",
						bgcolor: COLORS.capability,
						flexShrink: 0,
						mr: 1,
					}}
				/>
				<Typography
					variant="caption"
					sx={{
						color: "text.secondary",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{cap}
				</Typography>
			</Box>
			<Box
				className="tl-track"
				sx={{
					position: "relative",
					width: totalWidth,
					borderBottom: 1,
					borderColor: "divider",
					backgroundImage: gridBg,
				}}
			>
				<Tooltip arrow placement="top" title={`Capability: ${cap}`}>
					<Box
						sx={{
							position: "absolute",
							top: "50%",
							left: x,
							width: w,
							height: 8,
							transform: "translateY(-50%)",
							borderRadius: 999,
							bgcolor: COLORS.capability,
							opacity: 0.45,
							transition: "opacity 120ms",
							"&:hover": { opacity: 0.8 },
						}}
					/>
				</Tooltip>
			</Box>
		</Box>
	);
}

function LegendDot({ color, label }: { color: string; label: string }) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
			<Box
				sx={{
					width: 10,
					height: 10,
					borderRadius: "50%",
					bgcolor: color,
					flexShrink: 0,
				}}
			/>
			<Typography variant="caption" color="text.secondary">
				{label}
			</Typography>
		</Box>
	);
}
