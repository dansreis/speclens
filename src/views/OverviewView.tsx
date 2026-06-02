import { Box, ButtonBase, Typography } from "@mui/material";
import { type ReactNode, useMemo } from "react";
import type { Change, Repo } from "../lib/exampleLoader";
import { formatCompactDateTime, formatDuration } from "../lib/relativeTime";
import { countTaskCompletion } from "../lib/tasksCompletion";
import { useAppStore } from "../store/useAppStore";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_ARCHIVED_LIMIT = 10;

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

interface Props {
	repo: Repo | null;
}

export function OverviewView({ repo }: Props) {
	const setView = useAppStore((s) => s.setView);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setActiveTab = useAppStore((s) => s.setActiveTab);

	const stats = useMemo(() => {
		if (!repo) {
			return {
				specs: 0,
				active: 0,
				archived: 0,
				completion: 0,
				stale: 0,
				avgLifecycle: null as string | null,
			};
		}
		const active = repo.changes.filter((c) => !c.archived);
		const archived = repo.changes.filter((c) => c.archived);
		const specs = new Set(repo.changes.flatMap((c) => Object.keys(c.specs)))
			.size;
		let totalDone = 0;
		let totalTasks = 0;
		for (const c of repo.changes) {
			if (!c.tasks) continue;
			const { total, done } = countTaskCompletion(c.tasks);
			totalDone += done;
			totalTasks += total;
		}
		const completion =
			totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
		const now = Date.now();
		const stale = active.filter(
			(c) => c.createdAt && now - c.createdAt.getTime() > THIRTY_DAYS_MS,
		).length;
		const lifecycles = archived
			.filter((c) => c.createdAt && c.archivedAt)
			.map(
				(c) =>
					(c.archivedAt as Date).getTime() - (c.createdAt as Date).getTime(),
			);
		const avgLifecycle =
			lifecycles.length > 0
				? formatDuration(
						lifecycles.reduce((sum, ms) => sum + ms, 0) / lifecycles.length,
					)
				: null;
		return {
			specs,
			active: active.length,
			archived: archived.length,
			completion,
			stale,
			avgLifecycle,
		};
	}, [repo]);

	const activeChanges = useMemo(() => {
		if (!repo) return [];
		return repo.changes
			.filter((c) => !c.archived)
			.sort(
				(a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
			);
	}, [repo]);

	const recentArchived = useMemo(() => {
		if (!repo) return [];
		return repo.changes
			.filter((c) => c.archived)
			.sort(
				(a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
			)
			.slice(0, RECENT_ARCHIVED_LIMIT);
	}, [repo]);

	const handleSelect = (c: Change) => {
		setView("changes");
		setSelectedChangeKey(changeKey(c));
		setActiveTab("proposal");
	};

	return (
		<Box sx={{ p: 4 }}>
			<Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
				Overview
			</Typography>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: {
						xs: "repeat(2, 1fr)",
						md: "repeat(4, 1fr)",
					},
					gap: 2,
					mb: 5,
				}}
			>
				<StatCard value={stats.specs} label="Specs" />
				<StatCard value={stats.active} label="Active Changes" />
				<StatCard value={stats.archived} label="Archived Changes" />
				<StatCard value={`${stats.completion}%`} label="Task Completion" />
				<StatCard
					value={stats.avgLifecycle ?? "—"}
					label="Avg lifecycle (archived)"
				/>
				<StatCard value={stats.stale} label="Stale active (>30d)" />
			</Box>
			<Section title="Active Changes">
				{activeChanges.length === 0 ? (
					<Typography variant="body2" color="text.secondary">
						No active changes
					</Typography>
				) : (
					<ChangeList changes={activeChanges} onSelect={handleSelect} />
				)}
			</Section>
			<Section title="Recently Archived">
				{recentArchived.length === 0 ? (
					<Typography variant="body2" color="text.secondary">
						No archived changes
					</Typography>
				) : (
					<ChangeList changes={recentArchived} onSelect={handleSelect} />
				)}
			</Section>
		</Box>
	);
}

function StatCard({ value, label }: { value: number | string; label: string }) {
	return (
		<Box
			sx={{
				p: 2,
				border: 1,
				borderColor: "divider",
				borderRadius: 1,
				bgcolor: "background.paper",
			}}
		>
			<Typography
				variant="h3"
				sx={{
					fontWeight: 700,
					color: "primary.main",
					lineHeight: 1.1,
					mb: 0.5,
				}}
			>
				{value}
			</Typography>
			<Typography variant="caption" color="text.secondary">
				{label}
			</Typography>
		</Box>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Box component="section" sx={{ mb: 4 }}>
			<Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>
				{title}
			</Typography>
			{children}
		</Box>
	);
}

function ChangeList({
	changes,
	onSelect,
}: {
	changes: Change[];
	onSelect: (c: Change) => void;
}) {
	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
			{changes.map((c) => (
				<ButtonBase
					key={changeKey(c)}
					onClick={() => onSelect(c)}
					sx={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						gap: 2,
						px: 1.5,
						py: 1,
						borderRadius: 1,
						transition: "background-color 150ms",
						"&:hover": { bgcolor: "action.hover" },
					}}
				>
					<Typography
						variant="body2"
						sx={{
							color: "text.primary",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							flex: 1,
							textAlign: "left",
						}}
					>
						{c.name}
					</Typography>
					{c.createdAt && (
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ flexShrink: 0, fontFamily: "ui-monospace, monospace" }}
						>
							{formatCompactDateTime(c.createdAt)}
						</Typography>
					)}
				</ButtonBase>
			))}
		</Box>
	);
}
