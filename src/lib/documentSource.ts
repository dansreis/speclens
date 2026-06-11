import { type TabKey, useAppStore } from "../store/useAppStore";
import type { Change } from "./exampleLoader";

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
