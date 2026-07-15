import { useMemo } from "react";
import type { Repo } from "../lib/repoLoader";
import { runSpecChecks, type SpecCheckResult } from "../lib/specChecks";
import { useAppStore } from "../store/useAppStore";

/**
 * Settings-aware spec-check results for a repo: empty when the feature is
 * off, archived changes included per settings.specChecksIncludeArchived.
 * The single place UI components get findings from, so the settings wiring
 * can't drift between surfaces.
 */
export function useSpecCheckResults(repo: Repo | null): SpecCheckResult[] {
	const enabled = useAppStore((s) => s.settings.specChecks);
	const includeArchived = useAppStore(
		(s) => s.settings.specChecksIncludeArchived,
	);
	return useMemo(
		() => (repo && enabled ? runSpecChecks(repo, { includeArchived }) : []),
		[repo, enabled, includeArchived],
	);
}
