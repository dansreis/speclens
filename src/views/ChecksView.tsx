import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
	Box,
	Chip,
	Collapse,
	List,
	ListItemButton,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { Repo } from "../lib/repoLoader";
import {
	type CheckSeverity,
	changeKeyOf,
	countBySeverity,
	maxSeverity,
	type SpecCheckResult,
} from "../lib/specChecks";
import { CHECKS, type CheckId } from "../lib/specChecksConfig";
import { jumpToFinding } from "../specs/specCheckJump";
import { useSpecCheckResults } from "../specs/useSpecChecks";
import { useAppStore } from "../store/useAppStore";

type SeverityFilter = "all" | CheckSeverity;
type GroupMode = "change" | "check";

const SEVERITY_ICON: Record<CheckSeverity, React.ReactNode> = {
	error: <ErrorOutlinedIcon color="error" sx={{ fontSize: 16 }} />,
	warning: <WarningAmberIcon color="warning" sx={{ fontSize: 16 }} />,
	info: <InfoOutlinedIcon color="info" sx={{ fontSize: 16 }} />,
};

interface TreeSubGroup {
	key: string;
	label: string;
	results: SpecCheckResult[];
}

interface TreeTopGroup {
	key: string;
	label: string;
	/** Extra caption next to the label (e.g. check title for id groups). */
	caption: string | null;
	results: SpecCheckResult[];
	children: TreeSubGroup[];
}

interface Props {
	repo: Repo | null;
}

function checkLabel(id: CheckId): string {
	return `${id} · ${CHECKS[id].title}`;
}

/**
 * Dedicated navigation destination for spec-check analysis: a two-level tree
 * over every finding in the repo, groupable by change (change → check type)
 * or by check (check type → change), filterable by severity and text. Leaf
 * rows jump to the highlighted text in the owning document.
 */
export function ChecksView({ repo }: Props) {
	const enabled = useAppStore((s) => s.settings.specChecks);
	const [filter, setFilter] = useState("");
	const [severity, setSeverity] = useState<SeverityFilter>("all");
	const [mode, setMode] = useState<GroupMode>("change");
	// Everything renders collapsed by default. An active text filter
	// force-expands the tree so matches are never hidden behind a closed node.
	const [expandedTop, setExpandedTop] = useState<Set<string>>(new Set());
	const [expandedSub, setExpandedSub] = useState<Set<string>>(new Set());

	const results = useSpecCheckResults(repo);
	const counts = countBySeverity(results);

	const query = filter.trim().toLowerCase();
	const forceExpand = query !== "";

	const visible = useMemo(() => {
		return results.filter((r) => {
			if (severity !== "all" && r.severity !== severity) return false;
			if (!query) return true;
			return [r.message, r.id, r.changeKey, r.capability, r.heading]
				.filter(Boolean)
				.some((field) => (field as string).toLowerCase().includes(query));
		});
	}, [results, severity, query]);

	const tree = useMemo<TreeTopGroup[]>(() => {
		const ownerKey = (r: SpecCheckResult) =>
			r.changeKey ?? `spec:${r.capability}`;
		const ownerLabel = (r: SpecCheckResult) => {
			if (!r.changeKey) return `${r.capability} (spec)`;
			const change = repo?.changes.find((c) => changeKeyOf(c) === r.changeKey);
			return change?.name ?? r.changeKey;
		};
		const topKeyOf =
			mode === "change" ? ownerKey : (r: SpecCheckResult) => r.id;
		const subKeyOf =
			mode === "change" ? (r: SpecCheckResult) => r.id : ownerKey;
		const topLabelOf =
			mode === "change" ? ownerLabel : (r: SpecCheckResult) => r.id;
		const subLabelOf =
			mode === "change" ? (r: SpecCheckResult) => checkLabel(r.id) : ownerLabel;

		const tops = new Map<string, TreeTopGroup>();
		for (const result of visible) {
			const topKey = topKeyOf(result);
			let top = tops.get(topKey);
			if (!top) {
				top = {
					key: topKey,
					label: topLabelOf(result),
					caption: mode === "check" ? CHECKS[result.id].title : null,
					results: [],
					children: [],
				};
				tops.set(topKey, top);
			}
			top.results.push(result);
			const subKey = subKeyOf(result);
			let sub = top.children.find((c) => c.key === subKey);
			if (!sub) {
				sub = { key: subKey, label: subLabelOf(result), results: [] };
				top.children.push(sub);
			}
			sub.results.push(result);
		}
		for (const top of tops.values()) {
			top.children.sort((a, b) => a.label.localeCompare(b.label));
		}
		return [...tops.values()].sort((a, b) => a.label.localeCompare(b.label));
	}, [visible, mode, repo]);

	const toggleTop = (key: string) =>
		setExpandedTop((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	const toggleSub = (key: string) =>
		setExpandedSub((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	if (!enabled) {
		return (
			<Box sx={{ p: 4, width: "100%" }}>
				<Typography color="text.secondary">
					Spec checks are disabled. Enable them in Settings → General to lint
					this repository's changes and specs.
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ p: 4, width: "100%" }}>
			<Box
				sx={{
					display: "flex",
					gap: 1.5,
					alignItems: "center",
					mb: 2,
					flexWrap: "wrap",
				}}
			>
				<TextField
					placeholder="Filter findings..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					size="small"
					sx={{ flex: 1, minWidth: 220 }}
				/>
				<ToggleButtonGroup
					size="small"
					value={mode}
					exclusive
					onChange={(_, v) => v && setMode(v as GroupMode)}
				>
					<ToggleButton value="change" sx={{ textTransform: "none" }}>
						By change
					</ToggleButton>
					<ToggleButton value="check" sx={{ textTransform: "none" }}>
						By check
					</ToggleButton>
				</ToggleButtonGroup>
				<ToggleButtonGroup
					size="small"
					value={severity}
					exclusive
					onChange={(_, v) => v && setSeverity(v as SeverityFilter)}
				>
					<ToggleButton value="all" sx={{ textTransform: "none" }}>
						All ({counts.total})
					</ToggleButton>
					<ToggleButton value="error" sx={{ textTransform: "none" }}>
						Errors ({counts.errors})
					</ToggleButton>
					<ToggleButton value="warning" sx={{ textTransform: "none" }}>
						Warnings ({counts.warnings})
					</ToggleButton>
					<ToggleButton value="info" sx={{ textTransform: "none" }}>
						Info ({counts.infos})
					</ToggleButton>
				</ToggleButtonGroup>
			</Box>
			{visible.length === 0 ? (
				<Box
					sx={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 1,
						py: 8,
						color: "text.secondary",
					}}
				>
					<CheckCircleOutlinedIcon color="success" sx={{ fontSize: 32 }} />
					<Typography color="text.secondary">
						{results.length === 0
							? "No findings - all checks pass for this repository."
							: "No findings match this filter."}
					</Typography>
				</Box>
			) : (
				<List
					disablePadding
					sx={{
						border: 1,
						borderColor: "divider",
						borderRadius: 1,
						bgcolor: "background.paper",
						overflow: "hidden",
					}}
				>
					{tree.map((top) => {
						const topOpen = forceExpand || expandedTop.has(top.key);
						const topCounts = countBySeverity(top.results);
						const topSeverity = maxSeverity(topCounts);
						return (
							<Box key={top.key}>
								<ListItemButton
									onClick={() => toggleTop(top.key)}
									sx={{
										py: 0.75,
										gap: 1,
										borderTop: 1,
										borderColor: "divider",
										"&:first-of-type": { borderTop: 0 },
									}}
								>
									{topOpen ? (
										<ExpandMoreIcon
											sx={{ fontSize: 18, color: "text.secondary" }}
										/>
									) : (
										<ChevronRightIcon
											sx={{ fontSize: 18, color: "text.secondary" }}
										/>
									)}
									{topSeverity && SEVERITY_ICON[topSeverity]}
									<Typography
										variant="body2"
										sx={{
											fontWeight: 600,
											fontFamily:
												mode === "check"
													? "ui-monospace, monospace"
													: undefined,
										}}
									>
										{top.label}
									</Typography>
									{top.caption && (
										<Typography variant="body2" color="text.secondary">
											{top.caption}
										</Typography>
									)}
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{ ml: "auto" }}
									>
										{top.results.length}
									</Typography>
								</ListItemButton>
								<Collapse in={topOpen} timeout={150} unmountOnExit>
									{top.children.map((sub) => {
										const subNodeKey = `${top.key}/${sub.key}`;
										const subOpen = forceExpand || expandedSub.has(subNodeKey);
										const subCounts = countBySeverity(sub.results);
										const subSeverity = maxSeverity(subCounts);
										return (
											<Box key={sub.key}>
												<ListItemButton
													onClick={() => toggleSub(subNodeKey)}
													sx={{ py: 0.5, pl: 4.5, gap: 1 }}
												>
													{subOpen ? (
														<ExpandMoreIcon
															sx={{ fontSize: 16, color: "text.secondary" }}
														/>
													) : (
														<ChevronRightIcon
															sx={{ fontSize: 16, color: "text.secondary" }}
														/>
													)}
													{subSeverity && SEVERITY_ICON[subSeverity]}
													<Typography variant="body2">{sub.label}</Typography>
													<Typography
														variant="caption"
														color="text.secondary"
														sx={{ ml: "auto" }}
													>
														{sub.results.length}
													</Typography>
												</ListItemButton>
												<Collapse in={subOpen} timeout={150} unmountOnExit>
													{sub.results.map((result, i) => (
														<ListItemButton
															// biome-ignore lint/suspicious/noArrayIndexKey: results are recomputed wholesale, never reordered in place
															key={`${result.id}-${i}`}
															onClick={() =>
																repo && jumpToFinding(repo, result)
															}
															sx={{
																py: 0.5,
																pl: 9,
																pr: 2,
																gap: 1.5,
																alignItems: "flex-start",
															}}
														>
															<Box sx={{ flex: 1, minWidth: 0 }}>
																<Typography variant="body2">
																	{result.message}
																</Typography>
																<Typography
																	variant="caption"
																	color="text.secondary"
																	sx={{
																		fontFamily: "ui-monospace, monospace",
																	}}
																>
																	{[
																		mode === "change" ? null : result.id,
																		result.tab,
																		result.heading,
																	]
																		.filter(Boolean)
																		.join(" · ") || result.id}
																</Typography>
															</Box>
															{result.capability && (
																<Chip
																	label={result.capability}
																	size="small"
																	variant="outlined"
																	sx={{
																		height: 20,
																		fontSize: "0.6875rem",
																		color: "text.secondary",
																		borderColor: "divider",
																		flexShrink: 0,
																	}}
																/>
															)}
														</ListItemButton>
													))}
												</Collapse>
											</Box>
										);
									})}
								</Collapse>
							</Box>
						);
					})}
				</List>
			)}
		</Box>
	);
}
