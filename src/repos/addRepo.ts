import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../store/useAppStore";

/**
 * Opens the OS folder picker and adds the selected folder as a repo source.
 * No-op if the user cancels. Returns the chosen path, or null when cancelled.
 */
export async function pickAndAddRepoSource(): Promise<string | null> {
	const selected = await open({
		directory: true,
		multiple: false,
		title: "Select an OpenSpec project folder",
	});
	if (typeof selected !== "string") return null;
	await useAppStore.getState().addRepoSource(selected);
	return selected;
}
