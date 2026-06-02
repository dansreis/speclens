import type { TabKey } from "../store/useAppStore";
import type { Change } from "./exampleLoader";

export function getCurrentSource(
	change: Change | null,
	tab: TabKey,
): string | null {
	if (!change) return null;
	if (tab === "proposal") return change.proposal;
	if (tab === "tasks") return change.tasks;
	const caps = Object.keys(change.specs);
	if (caps.length === 0) return null;
	return caps.map((c) => change.specs[c]).join("\n\n");
}
