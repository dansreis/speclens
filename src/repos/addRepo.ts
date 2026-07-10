import { message, open } from "@tauri-apps/plugin-dialog";
import { resolveRepoRoot } from "../lib/repoLoader";
import { useAppStore } from "../store/useAppStore";

/**
 * Opens the OS folder picker and adds the selected folder as a repo source.
 * No-op if the user cancels. Returns the added path, or null when cancelled.
 *
 * Only folders that are OpenSpec project roots are accepted: the picked
 * folder must contain an `openspec/` directory (picking the `openspec/`
 * directory itself also works - its parent is added). Anything else shows a
 * warning and reopens the picker, so an invalid folder can never be added.
 */
export async function pickAndAddRepoSource(): Promise<string | null> {
	while (true) {
		const selected = await open({
			directory: true,
			multiple: false,
			title: "Select an OpenSpec project folder",
		});
		if (typeof selected !== "string") return null;
		let path: string;
		try {
			path = await resolveRepoRoot(selected);
		} catch {
			await message(
				`"${selected}" doesn't contain an openspec/ folder.\n\nPick the project root - the folder that has openspec/ inside it.`,
				{ title: "Not an OpenSpec project", kind: "warning" },
			);
			continue;
		}
		await useAppStore.getState().addRepoSource(path);
		return path;
	}
}
