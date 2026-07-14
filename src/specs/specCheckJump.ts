import type { Repo } from "../lib/repoLoader";
import {
	changeKeyOf,
	findingDocumentId,
	type SpecCheckResult,
} from "../lib/specChecks";
import { useAppStore } from "../store/useAppStore";

/**
 * Navigates to a spec-check finding: changes view, selects the change/tab
 * (and file for multi-file tabs), then blink-highlights the offending text
 * via the scrollTarget mechanism. Shared by the checks panel and Overview.
 */
export function jumpToFinding(repo: Repo, result: SpecCheckResult): void {
	const store = useAppStore.getState();
	const change = repo.changes.find((c) => changeKeyOf(c) === result.changeKey);
	store.setView("changes");
	store.setSelectedChangeKey(result.changeKey);
	if (!change || !result.tab) return;
	store.setActiveTab(result.tab);
	const tabFiles = change.documentFiles[result.tab] ?? [];
	if (result.file && tabFiles.length > 1) {
		store.setSelectedFile(change.slug, result.tab, result.file);
	}
	const text = result.snippet ?? result.heading;
	const documentId = findingDocumentId(change, result);
	if (text && documentId) {
		store.setScrollTarget({ documentId, text, occurrence: 1 });
	}
}
