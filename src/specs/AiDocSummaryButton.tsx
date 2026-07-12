import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { IconButton, Tooltip } from "@mui/material";
import { useAiStore } from "../store/useAiStore";
import { useAppStore } from "../store/useAppStore";

interface Props {
	/** Human document title, e.g. the change or capability name. */
	title: string;
	/** What kind of document this is: "proposal", "tasks", "spec delta", ... */
	kind: string;
	/** Markdown source of the document currently shown; null hides the button. */
	source: string | null;
}

/**
 * "AI summary" IconButton for document viewers: starts (or reuses a cached)
 * summary of the current document and opens the right-side AiSummaryPanel.
 * Generation runs detached in useAiStore, so navigating away doesn't cancel
 * it. Rendered only when the `aiEnabled` setting is on and a source exists.
 */
export function AiDocSummaryButton({ title, kind, source }: Props) {
	const aiEnabled = useAppStore((s) => s.settings.aiEnabled);

	if (!aiEnabled || !source) return null;

	return (
		<Tooltip title="AI summary">
			<IconButton
				onClick={() =>
					void useAiStore.getState().summarizeDoc({ title, kind, source })
				}
				aria-label="AI summary"
				sx={{ color: "text.secondary" }}
			>
				<AutoAwesomeIcon fontSize="small" />
			</IconButton>
		</Tooltip>
	);
}
