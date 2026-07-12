import { keyframes } from "@emotion/react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { IconButton, Tooltip } from "@mui/material";
import { useAiStore } from "../store/useAiStore";
import { useAppStore } from "../store/useAppStore";

/** Gentle sparkle while a summary is generating anywhere in the app. */
const sparkle = keyframes`
  0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
  50% { opacity: 0.55; transform: scale(1.18) rotate(12deg); }
`;

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
	const generating = useAiStore((s) => s.docSummary.generating);

	if (!aiEnabled || !source) return null;

	return (
		<Tooltip title={generating ? "Generating AI summary…" : "AI summary"}>
			<IconButton
				onClick={() =>
					void useAiStore.getState().summarizeDoc({ title, kind, source })
				}
				aria-label="AI summary"
				sx={{ color: generating ? "primary.main" : "text.secondary" }}
			>
				<AutoAwesomeIcon
					fontSize="small"
					sx={
						generating
							? { animation: `${sparkle} 1.4s ease-in-out infinite` }
							: undefined
					}
				/>
			</IconButton>
		</Tooltip>
	);
}
