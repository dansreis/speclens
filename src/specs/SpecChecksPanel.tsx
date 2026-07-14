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
	Tooltip,
	Typography,
} from "@mui/material";
import { useMemo } from "react";
import {
	type CheckSeverity,
	changeKeyOf,
	countBySeverity,
	runSpecChecks,
	type SpecCheckResult,
} from "../lib/specChecks";
import { useAppStore } from "../store/useAppStore";
import { jumpToFinding } from "./specCheckJump";

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

/**
 * IDE-style "Problems" panel: all spec-check findings for the active repo,
 * grouped by change, docked on the right like the comments panel. Clicking a
 * finding navigates to the change/tab and blink-highlights the offending text
 * via the scrollTarget mechanism comment jumps use.
 */
export function SpecChecksPanel() {
	const open = useAppStore((s) => s.specChecksPanelOpen);
	const setOpen = useAppStore((s) => s.setSpecChecksPanelOpen);
	const repos = useAppStore((s) => s.repos);
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const enabled = useAppStore((s) => s.settings.specChecks);
	const panelWidth = useAppStore((s) => s.settings.commentsPanelWidth);
	const repo = repos.find((r) => r.id === selectedRepoId) ?? null;

	const results = useMemo(
		() => (repo && enabled ? runSpecChecks(repo) : []),
		[repo, enabled],
	);

	const groups = useMemo(() => {
		const byKey = new Map<string, Group>();
		for (const result of results) {
			let group = byKey.get(result.changeKey);
			if (!group) {
				const change = repo?.changes.find(
					(c) => changeKeyOf(c) === result.changeKey,
				);
				group = {
					changeKey: result.changeKey,
					changeName: change?.name ?? result.changeKey,
					results: [],
				};
				byKey.set(result.changeKey, group);
			}
			group.results.push(result);
		}
		return [...byKey.values()].sort((a, b) =>
			a.changeName.localeCompare(b.changeName),
		);
	}, [results, repo]);

	const counts = countBySeverity(results);

	const handleJump = (result: SpecCheckResult) => {
		if (repo) jumpToFinding(repo, result);
	};

	return (
		<Box
			sx={{
				position: "relative",
				width: open ? panelWidth : 0,
				flexShrink: 0,
				transition: "width 200ms ease-in-out",
				borderLeft: open ? 1 : 0,
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
					px: 1.5,
					py: 1,
					borderBottom: 1,
					borderColor: "divider",
					flexShrink: 0,
					gap: 0.5,
				}}
			>
				<Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
					Spec checks
				</Typography>
				<Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
					{counts.errors > 0 && `${counts.errors} errors`}
					{counts.errors > 0 && counts.warnings + counts.infos > 0 && " · "}
					{counts.warnings > 0 && `${counts.warnings} warnings`}
					{counts.warnings > 0 && counts.infos > 0 && " · "}
					{counts.infos > 0 && `${counts.infos} info`}
				</Typography>
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
			<Box sx={{ flex: 1, overflowY: "auto" }}>
				{results.length === 0 ? (
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
							{enabled
								? "No findings - all checks pass for this repository."
								: "Spec checks are disabled in Settings."}
						</Typography>
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
