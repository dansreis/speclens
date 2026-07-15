import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import {
	Box,
	Button,
	ButtonBase,
	Chip,
	Tab,
	Tabs,
	Tooltip,
	Typography,
} from "@mui/material";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { aiSummaryGet } from "../lib/aiSummaries";
import { buildSummaryPrompt, collectCapabilities } from "../lib/aiSummary";
import {
	formatCompactDateTime,
	formatDuration,
	formatRelativeTime,
} from "../lib/relativeTime";
import type { Change, DocAuthorship, Repo } from "../lib/repoLoader";
import { artifactLabel } from "../lib/schema";
import { countBySeverity, type SpecCheckResult } from "../lib/specChecks";
import { countTaskCompletion } from "../lib/tasksCompletion";
import { RepoConfigModal } from "../repos/RepoConfigModal";
import { AiDocSummaryButton } from "../specs/AiDocSummaryButton";
import { useSpecCheckResults } from "../specs/useSpecChecks";
import { seedDocSummaryCache } from "../store/useAiStore";
import { useAppStore } from "../store/useAppStore";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_ARCHIVED_LIMIT = 10;

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function wordCount(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatMinutes(min: number): string {
	if (min < 1) return "<1 min";
	if (min < 60) return `${min} min`;
	const h = Math.floor(min / 60);
	const m = min % 60;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
	repo: Repo | null;
}

type ActivityKind = "change" | "spec" | { folder: string };

interface ActivityEntry {
	kind: ActivityKind;
	label: string;
	authorship: DocAuthorship;
	selectKey: string;
}

export function OverviewView({ repo }: Props) {
	const setView = useAppStore((s) => s.setView);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const setSelectedSpec = useAppStore((s) => s.setSelectedSpec);
	const openFolder = useAppStore((s) => s.openFolder);
	const setActiveTab = useAppStore((s) => s.setActiveTab);
	const readingWpm = useAppStore((s) => s.settings.readingWpm);
	const aiModel = useAppStore((s) => s.settings.aiModel);
	const specChecksEnabled = useAppStore((s) => s.settings.specChecks);
	const signature = useAppStore((s) =>
		repo ? (s.loadedSignatures[repo.id] ?? null) : null,
	);
	const checkResults: SpecCheckResult[] = useSpecCheckResults(repo);
	const checkCounts = countBySeverity(checkResults);
	const [configOpen, setConfigOpen] = useState(false);
	const [tab, setTab] = useState<"summary" | "activity" | "changes" | "config">(
		"summary",
	);

	// Project summary "document": the prompt over all capabilities. The prompt
	// text doubles as the cache key source, so spec changes invalidate it.
	const overviewPrompt = useMemo(() => {
		if (!repo) return null;
		return buildSummaryPrompt({
			repoName: repo.name,
			capabilities: collectCapabilities(repo.repoSpecs, repo.changes),
			activeChangeTitles: repo.changes
				.filter((c) => !c.archived)
				.map((c) => c.name),
		});
	}, [repo]);

	// Rehydrate the session cache from the SQLite-persisted project summary,
	// but only when the repo hasn't changed since it was generated.
	useEffect(() => {
		if (!repo || !overviewPrompt) return;
		let stale = false;
		void aiSummaryGet(repo.id).then((entry) => {
			if (stale || !entry) return;
			const fresh =
				entry.modelId === aiModel &&
				!!entry.signature &&
				entry.signature === signature;
			if (fresh) seedDocSummaryCache(aiModel, overviewPrompt, entry.summary);
		});
		return () => {
			stale = true;
		};
	}, [repo, overviewPrompt, aiModel, signature]);

	const stats = useMemo(() => {
		if (!repo) {
			return {
				specs: 0,
				active: 0,
				archived: 0,
				completion: 0,
				stale: 0,
				avgLifecycle: null as string | null,
				capabilitiesInMotion: 0,
				totalReadingTime: "n/a",
			};
		}
		const active = repo.changes.filter((c) => !c.archived);
		const archived = repo.changes.filter((c) => c.archived);
		const specs = new Set(repo.changes.flatMap((c) => Object.keys(c.specs)))
			.size;
		const capabilitiesInMotion = new Set(
			active.flatMap((c) => Object.keys(c.specs)),
		).size;
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
		let totalWords = 0;
		for (const c of repo.changes) {
			for (const doc of Object.values(c.documents)) {
				totalWords += wordCount(doc);
			}
		}
		const totalReadingTime =
			totalWords > 0
				? formatMinutes(Math.max(1, Math.ceil(totalWords / readingWpm)))
				: "n/a";
		return {
			specs,
			active: active.length,
			archived: archived.length,
			completion,
			stale,
			avgLifecycle,
			capabilitiesInMotion,
			totalReadingTime,
		};
	}, [repo, readingWpm]);

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

	const recentActivity = useMemo<ActivityEntry[]>(() => {
		if (!repo) return [];
		const entries: ActivityEntry[] = [];
		for (const c of repo.changes) {
			if (!c.authorship?.rolled) continue;
			entries.push({
				kind: "change",
				label: c.name,
				authorship: c.authorship.rolled,
				selectKey: changeKey(c),
			});
		}
		for (const s of repo.repoSpecs) {
			if (!s.authorship) continue;
			entries.push({
				kind: "spec",
				label: s.capability,
				authorship: s.authorship,
				selectKey: s.capability,
			});
		}
		for (const folder of repo.folders) {
			for (const doc of folder.docs) {
				if (!doc.authorship) continue;
				entries.push({
					kind: { folder: folder.name },
					label: doc.number ? `${doc.number}: ${doc.name}` : doc.name,
					authorship: doc.authorship,
					selectKey: doc.slug,
				});
			}
		}
		entries.sort(
			(a, b) =>
				new Date(b.authorship.lastEditedAt).getTime() -
				new Date(a.authorship.lastEditedAt).getTime(),
		);
		return entries.slice(0, 10);
	}, [repo]);

	const handleSelect = (c: Change) => {
		setView("changes");
		setSelectedChangeKey(changeKey(c));
		setActiveTab("proposal");
	};

	const handleActivitySelect = (entry: ActivityEntry) => {
		if (entry.kind === "change") {
			setView("changes");
			setSelectedChangeKey(entry.selectKey);
			setActiveTab("proposal");
		} else if (entry.kind === "spec") {
			setView("specs");
			setSelectedSpec(entry.selectKey);
		} else {
			openFolder(entry.kind.folder, entry.selectKey);
		}
	};

	const kindLabel = (kind: ActivityKind): string =>
		typeof kind === "string" ? kind : kind.folder;

	// Repo loaded but nothing SpecLens can read - usually a non-standard layout
	// (e.g. change artifacts filed under specs/, or missing spec.md files).
	const isEmpty =
		!!repo &&
		repo.changes.length === 0 &&
		repo.repoSpecs.length === 0 &&
		repo.folders.length === 0;

	if (isEmpty) {
		return (
			<Box sx={{ p: 4, maxWidth: 640 }}>
				<Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
					{repo?.name ?? "Overview"}
				</Typography>
				<Typography color="text.secondary" sx={{ mb: 1.5 }}>
					This project loaded, but doesn't contain any OpenSpec content SpecLens
					can read.
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
					SpecLens expects the standard OpenSpec layout:
				</Typography>
				<Box
					component="pre"
					sx={{
						fontFamily: "monospace",
						fontSize: "0.8125rem",
						bgcolor: "action.hover",
						p: 2,
						borderRadius: 1,
						overflowX: "auto",
						color: "text.secondary",
						m: 0,
					}}
				>
					{`openspec/
├── specs/
│   └── <capability>/
│       └── spec.md          # source-of-truth spec
└── changes/
    └── <change-name>/
        ├── proposal.md
        ├── tasks.md
        └── specs/
            └── <capability>/
                └── spec.md  # delta spec`}
				</Box>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
					Files organized differently (e.g. proposals under{" "}
					<Box component="code" sx={{ fontFamily: "monospace" }}>
						specs/
					</Box>
					, or capabilities without a{" "}
					<Box component="code" sx={{ fontFamily: "monospace" }}>
						spec.md
					</Box>
					) won't appear.
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ p: 4 }}>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
				<Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
					{repo?.name ?? "Overview"}
				</Typography>
				{repo && (
					<AiDocSummaryButton
						title={repo.name}
						kind="project overview"
						source={overviewPrompt}
						rawPrompt
						persist={{ repoId: repo.id, signature }}
					/>
				)}
			</Box>
			<Tabs
				value={tab}
				onChange={(_, v) => setTab(v)}
				sx={{
					mb: 3,
					borderBottom: 1,
					borderColor: "divider",
					minHeight: 40,
				}}
			>
				<Tab value="summary" label="Summary" />
				<Tab value="activity" label="Activity" />
				<Tab value="changes" label="Changes" />
				<Tab value="config" label="Config" />
			</Tabs>
			{tab === "summary" && (
				<>
					<Typography
						variant="overline"
						sx={{
							color: "text.disabled",
							fontWeight: 600,
							letterSpacing: 0.6,
							display: "block",
							mb: 1.5,
						}}
					>
						At a glance
					</Typography>
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: {
								xs: "repeat(2, 1fr)",
								md: "repeat(4, 1fr)",
							},
							gap: 2,
							mb: 4,
						}}
					>
						<StatCard
							value={stats.specs}
							label="Specs"
							help="Number of distinct capability specs referenced across all changes in this repo."
						/>
						<StatCard
							value={stats.active}
							label="Active Changes"
							help="Proposals currently in flight. Anything under openspec/changes/ that hasn't been archived yet."
						/>
						<StatCard
							value={stats.archived}
							label="Archived Changes"
							help="Completed proposals moved to openspec/changes/archive/."
						/>
						<StatCard
							value={`${stats.completion}%`}
							label="Task Completion"
							help="Share of checklist items marked done across every tasks file in this repo (active + archived)."
						/>
						<StatCard
							value={stats.avgLifecycle ?? "n/a"}
							label="Avg lifecycle (archived)"
							help="Average time between a change's creation and its archival, computed from archived changes only."
						/>
						<StatCard
							value={stats.stale}
							label="Stale active (>30d)"
							help="Active changes created more than 30 days ago that haven't been archived yet. Worth revisiting."
						/>
						<StatCard
							value={stats.capabilitiesInMotion}
							label="Capabilities in motion"
							help="Distinct capability specs touched by active (non-archived) changes. The surface area of in-flight work."
						/>
						<StatCard
							value={stats.totalReadingTime}
							label="Total reading time"
							help={`Estimated time to read every proposal, spec, and tasks file in this repo at ${readingWpm} words per minute.`}
						/>
						{specChecksEnabled && (
							<StatCard
								value={checkCounts.total}
								label="Check findings"
								help={`Spec-check lint findings across this repo: ${checkCounts.errors} errors, ${checkCounts.warnings} warnings, ${checkCounts.infos} info.`}
							/>
						)}
					</Box>
					{repo?.config?.context && (
						<Box
							sx={{
								color: "text.secondary",
								"& p": { mb: 1 },
								"& code": {
									fontFamily: "ui-monospace, monospace",
									fontSize: "0.875em",
									bgcolor: "action.hover",
									px: 0.5,
									borderRadius: 0.5,
								},
								"& ul": { pl: 3, mb: 1 },
								"& li": { mb: 0.25 },
							}}
						>
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{repo.config.context}
							</ReactMarkdown>
						</Box>
					)}
				</>
			)}
			{tab === "activity" && (
				<Section title="Recent activity">
					{recentActivity.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							No recent activity
						</Typography>
					) : (
						<Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
							{recentActivity.map((entry) => (
								<ButtonBase
									key={`${kindLabel(entry.kind)}:${entry.selectKey}`}
									onClick={() => handleActivitySelect(entry)}
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 2,
										px: 1.5,
										py: 1,
										borderRadius: 1,
										transition: "background-color 150ms",
										"&:hover": { bgcolor: "action.hover" },
									}}
								>
									<Chip
										label={kindLabel(entry.kind)}
										size="small"
										variant="outlined"
										sx={{
											height: 18,
											fontSize: "0.6875rem",
											minWidth: 64,
											fontFamily: "ui-monospace, monospace",
											color: "text.secondary",
										}}
									/>
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
										{entry.label}
									</Typography>
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{
											flexShrink: 0,
											fontFamily: "ui-monospace, monospace",
										}}
									>
										{entry.authorship.lastEditedBy.name} ·{" "}
										{formatRelativeTime(
											new Date(entry.authorship.lastEditedAt),
										)}
									</Typography>
								</ButtonBase>
							))}
						</Box>
					)}
				</Section>
			)}
			{tab === "changes" && (
				<>
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
				</>
			)}
			{tab === "config" && repo && (
				<Section title="Repository config">
					<RepoConfigCard repo={repo} onOpenRaw={() => setConfigOpen(true)} />
				</Section>
			)}
			<RepoConfigModal
				open={configOpen}
				repo={repo}
				onClose={() => setConfigOpen(false)}
			/>
		</Box>
	);
}

function StatCard({
	value,
	label,
	help,
}: {
	value: number | string;
	label: string;
	help?: string;
}) {
	return (
		<Box
			sx={{
				position: "relative",
				p: 2,
				border: 1,
				borderColor: "divider",
				borderRadius: 1,
				bgcolor: "background.paper",
			}}
		>
			{help && (
				<Tooltip title={help} arrow placement="top">
					<HelpOutlineIcon
						fontSize="small"
						sx={{
							position: "absolute",
							top: 8,
							right: 8,
							fontSize: "1rem",
							color: "text.disabled",
							cursor: "help",
							"&:hover": { color: "text.secondary" },
						}}
					/>
				</Tooltip>
			)}
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

function RepoConfigCard({
	repo,
	onOpenRaw,
}: {
	repo: Repo;
	onOpenRaw: () => void;
}) {
	const { schema } = repo;
	return (
		<Box
			sx={{
				border: 1,
				borderColor: "divider",
				borderRadius: 1,
				p: 2,
				bgcolor: "background.paper",
			}}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 2,
					mb: 1.5,
					flexWrap: "wrap",
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<Chip
						label={schema.name}
						size="small"
						color="primary"
						variant="outlined"
						sx={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}
					/>
					{schema.version !== undefined && (
						<Typography variant="caption" color="text.secondary">
							v{schema.version}
						</Typography>
					)}
					{!repo.configYaml && (
						<Typography variant="caption" color="text.secondary">
							· built-in default
						</Typography>
					)}
				</Box>
				<Button
					size="small"
					variant="text"
					startIcon={<SettingsApplicationsIcon fontSize="small" />}
					onClick={onOpenRaw}
					sx={{ textTransform: "none" }}
				>
					View raw YAML
				</Button>
			</Box>
			{schema.description && (
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
					{schema.description}
				</Typography>
			)}
			<Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
				{schema.artifacts.map((artifact) => (
					<Box
						key={artifact.id}
						sx={{
							display: "flex",
							alignItems: "baseline",
							gap: 1.5,
							py: 0.5,
							borderBottom: 1,
							borderColor: "divider",
							"&:last-of-type": { borderBottom: 0 },
						}}
					>
						<Typography
							variant="body2"
							sx={{
								fontWeight: 600,
								minWidth: 100,
								flexShrink: 0,
							}}
						>
							{artifactLabel(artifact.id)}
						</Typography>
						<Typography
							variant="caption"
							sx={{
								fontFamily: "ui-monospace, monospace",
								color: "text.secondary",
								flexShrink: 0,
							}}
						>
							{artifact.generates}
						</Typography>
						{artifact.description && (
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{
									flex: 1,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								- {artifact.description}
							</Typography>
						)}
					</Box>
				))}
			</Box>
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
