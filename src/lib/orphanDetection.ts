import { useEffect } from "react";
import type { AppComment } from "./comments";
import type { Repo } from "./repoLoader";

/**
 * Build the set of currently-valid documentIds for a single repo across all
 * comment-bearing surfaces. Schemas and root files are not yet rendered via
 * MarkdownView, so they have no documentIds to validate against.
 */
function validDocumentIds(repo: Repo): Set<string> {
	const ids = new Set<string>();
	for (const c of repo.changes) {
		if (c.proposal !== null) ids.add(`${c.slug}/proposal`);
		if (c.tasks !== null) ids.add(`${c.slug}/tasks`);
		for (const tabId of Object.keys(c.documents)) {
			ids.add(`${c.slug}/${tabId}`);
		}
		for (const [tabId, files] of Object.entries(c.documentFiles)) {
			for (const f of files) ids.add(`${c.slug}/${tabId}/${f.name}`);
		}
		for (const cap of Object.keys(c.specs)) {
			ids.add(`${c.slug}/specs/${cap}`);
		}
	}
	for (const spec of repo.repoSpecs) ids.add(`repo-doc:${spec.path}`);
	for (const folder of repo.folders) {
		for (const doc of folder.docs) ids.add(`repo-doc:${doc.path}`);
	}
	return ids;
}

/**
 * Returns a map of commentId → true for comments whose (repoId, documentId)
 * does not resolve in any currently loaded repo. Comments referencing a repo
 * that isn't loaded are considered orphans by repo-removal as well.
 */
export function computeDocumentOrphans(
	comments: AppComment[],
	repos: Repo[],
): Record<string, boolean> {
	const byRepo: Map<string, Set<string>> = new Map();
	for (const r of repos) byRepo.set(r.id, validDocumentIds(r));

	const orphans: Record<string, boolean> = {};
	for (const c of comments) {
		if (c.documentKind === "repo") {
			if (!byRepo.has(c.repoId)) orphans[c.id] = true;
			continue;
		}
		const set = byRepo.get(c.repoId);
		if (!set) {
			orphans[c.id] = true;
			continue;
		}
		if (c.documentId === null || !set.has(c.documentId)) {
			orphans[c.id] = true;
		}
	}
	return orphans;
}

import { useCommentsStore } from "../store/useCommentsStore";

export function useDocumentOrphans(
	comments: AppComment[],
	repos: Repo[],
): void {
	const setDocumentOrphans = useCommentsStore((s) => s.setDocumentOrphans);
	// biome-ignore lint/correctness/useExhaustiveDependencies: setter is stable
	useEffect(() => {
		setDocumentOrphans(computeDocumentOrphans(comments, repos));
	}, [comments, repos]);
}
