import RuleIcon from "@mui/icons-material/Rule";
import { Badge, IconButton, Tooltip } from "@mui/material";
import {
	countBySeverity,
	maxSeverity,
	type SpecCheckResult,
} from "../lib/specChecks";
import { useAppStore } from "../store/useAppStore";

interface Props {
	results: SpecCheckResult[];
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
