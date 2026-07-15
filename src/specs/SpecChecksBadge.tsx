import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RuleIcon from "@mui/icons-material/Rule";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Badge, Box, IconButton, Tooltip, Typography } from "@mui/material";
import {
	type CheckCounts,
	countBySeverity,
	maxSeverity,
	type SpecCheckResult,
} from "../lib/specChecks";
import { useAppStore } from "../store/useAppStore";

interface Props {
	results: SpecCheckResult[];
}

/**
 * Compact per-row severity indicator (error/warning/info icons + counts)
 * used by the changes and specs listings. Renders nothing when clean.
 */
export function CheckSeverityCounts({ counts }: { counts: CheckCounts }) {
	if (counts.total === 0) return null;
	return (
		<Tooltip
			title={`Spec checks: ${counts.errors} errors, ${counts.warnings} warnings, ${counts.infos} info`}
			arrow
			placement="left"
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
				{counts.errors > 0 && (
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
						<ErrorOutlinedIcon color="error" sx={{ fontSize: 14 }} />
						<Typography variant="caption" color="error">
							{counts.errors}
						</Typography>
					</Box>
				)}
				{counts.warnings > 0 && (
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
						<WarningAmberIcon color="warning" sx={{ fontSize: 14 }} />
						<Typography variant="caption" sx={{ color: "warning.main" }}>
							{counts.warnings}
						</Typography>
					</Box>
				)}
				{counts.infos > 0 && (
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
						<InfoOutlinedIcon color="info" sx={{ fontSize: 14 }} />
						<Typography variant="caption" sx={{ color: "info.main" }}>
							{counts.infos}
						</Typography>
					</Box>
				)}
			</Box>
		</Tooltip>
	);
}

/**
 * Title-row toggle for the spec-checks panel: finding count for the current
 * change, colored by its highest severity.
 */
export function SpecChecksBadge({ results }: Props) {
	const enabled = useAppStore((s) => s.settings.specChecks);
	const panelOpen = useAppStore((s) => s.specChecksPanelOpen);
	const togglePanel = useAppStore((s) => s.toggleSpecChecksPanel);

	if (!enabled) return null;

	const counts = countBySeverity(results);
	const top = maxSeverity(counts);

	return (
		<Tooltip
			title={
				counts.total > 0
					? `Spec checks: ${counts.errors} errors, ${counts.warnings} warnings, ${counts.infos} info`
					: "Spec checks: no findings"
			}
		>
			<IconButton
				onClick={togglePanel}
				aria-label="Toggle spec checks panel"
				sx={{ color: panelOpen ? "primary.main" : "text.secondary" }}
			>
				<Badge
					badgeContent={counts.total}
					color={top ?? "default"}
					max={99}
					invisible={counts.total === 0}
				>
					<RuleIcon fontSize="small" />
				</Badge>
			</IconButton>
		</Tooltip>
	);
}
