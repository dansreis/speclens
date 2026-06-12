import { type TabKey, useAppStore } from "../store/useAppStore";
import type { Change } from "./repoLoader";
import { artifactLabel } from "./schema";

export function getCurrentSource(
	change: Change | null,
	tab: TabKey,
): string | null {
	if (!change) return null;
	const files = change.documentFiles[tab];
	if (files && files.length > 0) {
		const stored =
			useAppStore.getState().selectedFiles[`${change.slug}::${tab}`];
		const picked = (stored && files.find((f) => f.name === stored)) || files[0];
		return picked.content;
	}
	return change.documents[tab] ?? null;
}

export interface StatsSection {
	label: string;
	source: string;
}

export function getStatsSections(
	change: Change | null,
	tab: TabKey,
	selectedFiles: Record<string, string>,
): StatsSection[] {
	if (!change) return [];
	const files = change.documentFiles[tab];
	const label = artifactLabel(tab);
	if (files && files.length > 1) {
		const stored = selectedFiles[`${change.slug}::${tab}`];
		const picked = (stored && files.find((f) => f.name === stored)) || files[0];
		const aggregate = files.map((f) => f.content).join("\n\n");
		return [
			{ label: `${label}: ${picked.name}`, source: picked.content },
			{ label: `All ${label} (${files.length} files)`, source: aggregate },
		];
	}
	const source = getCurrentSource(change, tab);
	return source ? [{ label, source }] : [];
}
