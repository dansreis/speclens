import type { TabKey } from "../store/useAppStore";
import type { Change } from "./exampleLoader";

export function getCurrentSource(
	change: Change | null,
	tab: TabKey,
): string | null {
	if (!change) return null;
	return change.documents[tab] ?? null;
}
