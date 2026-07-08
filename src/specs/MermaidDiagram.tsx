import { Box, useTheme } from "@mui/material";
import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";
import { MermaidLightbox } from "./MermaidLightbox";

interface Props {
	code: string;
}

/**
 * Renders a ```mermaid fenced block as an SVG diagram via the mermaid client
 * API. The container carries `data-mermaid` so the comment-highlight walker
 * and the selection handler skip the generated SVG (wrapping <mark>s inside
 * it would corrupt the diagram). Clicking the diagram opens a pan/zoom
 * lightbox.
 */
export function MermaidDiagram({ code }: Props) {
	const theme = useTheme();
	const dark = theme.palette.mode === "dark";
	const id = `mmd-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const [svg, setSvg] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [lightboxOpen, setLightboxOpen] = useState(false);

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
			.then((result) => {
				if (cancelled) return;
				setSvg(result.svg);
				setError(null);
			})
			.catch((e: unknown) => {
				// On parse failure mermaid can leave its temp render element in the
				// document; drop it so it doesn't accumulate.
				document.getElementById(id)?.remove();
				if (!cancelled) {
					setSvg(null);
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

	if (!svg) return <Box data-mermaid="true" sx={{ my: 2 }} />;

	return (
		<>
			<Box
				data-mermaid="true"
				onClick={() => setLightboxOpen(true)}
				title="Click to expand"
				sx={{
					my: 2,
					display: "flex",
					justifyContent: "center",
					cursor: "zoom-in",
					borderRadius: 1,
					transition: "background-color 150ms",
					"&:hover": { bgcolor: "action.hover" },
					"& svg": { maxWidth: "100%", height: "auto" },
				}}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output is sanitized (securityLevel: "strict")
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
			<MermaidLightbox
				svg={svg}
				open={lightboxOpen}
				onClose={() => setLightboxOpen(false)}
			/>
		</>
	);
}
