import { Box, useTheme } from "@mui/material";
import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";

interface Props {
	code: string;
}

/**
 * Renders a ```mermaid fenced block as an SVG diagram via the mermaid client
 * API. The container carries `data-mermaid` so the comment-highlight walker
 * and the selection handler skip the generated SVG (wrapping <mark>s inside
 * it would corrupt the diagram).
 */
export function MermaidDiagram({ code }: Props) {
	const theme = useTheme();
	const dark = theme.palette.mode === "dark";
	const id = `mmd-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const ref = useRef<HTMLDivElement | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		// Mermaid config is global; re-initializing on every render pass is how
		// the diagram theme tracks the MUI palette mode.
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			theme: dark ? "dark" : "default",
			fontFamily: theme.typography.fontFamily,
		});
		mermaid
			.render(id, code)
			.then(({ svg }) => {
				if (cancelled || !ref.current) return;
				ref.current.innerHTML = svg;
				setError(null);
			})
			.catch((e: unknown) => {
				// On parse failure mermaid can leave its temp render element in the
				// document; drop it so it doesn't accumulate.
				document.getElementById(id)?.remove();
				if (!cancelled) {
					setError(e instanceof Error ? e.message : String(e));
				}
			});
		return () => {
			cancelled = true;
		};
	}, [code, dark, id, theme.typography.fontFamily]);

	if (error) {
		// Fall back to the raw source so a typo'd diagram is still readable.
		return (
			<Box
				component="pre"
				sx={{ borderLeft: 3, borderColor: "error.main" }}
				title={error}
			>
				<code>{code}</code>
			</Box>
		);
	}

	return (
		<Box
			ref={ref}
			data-mermaid="true"
			sx={{
				my: 2,
				display: "flex",
				justifyContent: "center",
				"& svg": { maxWidth: "100%", height: "auto" },
			}}
		/>
	);
}
