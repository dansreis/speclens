import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { getRepoSignature } from "./repoLoader";

const POLL_INTERVAL_MS = 15 * 1000;

/**
 * Polls the selected repo's signature every 15 seconds (and on window
 * focus / tab-visibility transitions) and flips `staleRepos[path]` to
 * true when the on-disk signature drifts from the one captured at load
 * time. The UI surfaces this as a warning badge on the repository's
 * refresh button (see `RepositorySwitcher`); the watcher never reloads
 * on its own.
 *
 * Only the currently selected repo is polled - switching repos triggers
 * an immediate one-shot check on the new one.
 *
 * The window `focus` listener is what catches the common case of editing
 * a file in another app and switching back: `visibilitychange` only fires
 * when the window is fully hidden, not on app-to-app focus changes.
 */
export function useRepoSyncWatcher(): void {
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const isSelectedMissing = useAppStore((s) => {
		if (!s.selectedRepoId) return true;
		const src = s.repoSources.find((r) => r.path === s.selectedRepoId);
		return src?.missing ?? true;
	});

	useEffect(() => {
		if (!selectedRepoId || isSelectedMissing) return;

		let cancelled = false;

		const check = async () => {
			if (document.hidden) return;
			try {
				const current = await getRepoSignature(selectedRepoId);
				if (cancelled) return;
				const loaded = useAppStore.getState().loadedSignatures[selectedRepoId];
				if (!loaded) return;
				if (loaded !== current) {
					useAppStore.getState().markRepoStale(selectedRepoId);
				}
			} catch {
				// Folder may be transiently unavailable (unmounted, locked) -
				// the next tick will retry. Don't flip `missing` from here;
				// that's the loader's job.
			}
		};

		check();
		const interval = window.setInterval(check, POLL_INTERVAL_MS);
		const onVisibility = () => {
			if (!document.hidden) check();
		};
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("focus", check);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("focus", check);
		};
	}, [selectedRepoId, isSelectedMissing]);
}
