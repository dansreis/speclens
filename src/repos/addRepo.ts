import { open } from "@tauri-apps/plugin-dialog";
import { resolveRepoRoot } from "../lib/repoLoader";
import { useAppStore } from "../store/useAppStore";

/**
 * Opens the OS folder picker and adds the selected folder as a repo source.
 * No-op if the user cancels. Returns the added path, or null when cancelled.
 *
 * The picked folder is normalized to the project root first: if the user picks
 * the `openspec/` directory itself, its parent (which contains it) is added
 * instead, so the common "pointed at openspec/" mistake just works.
 */
export async function pickAndAddRepoSource(): Promise<string | null> {
	const selected = await open({
		directory: true,
		multiple: false,
		title: "Select an OpenSpec project folder",
	});
	if (typeof selected !== "string") return null;
	let path = selected;
	try {
		path = await resolveRepoRoot(selected);
	} catch {
		// Resolution is best-effort; fall back to the picked path and let the
		// load surface any "no openspec/ folder" error.
	}
	await useAppStore.getState().addRepoSource(path);
	return path;
}
