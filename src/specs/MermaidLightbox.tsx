import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { Box, Dialog, IconButton, Paper, Tooltip } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;

interface Props {
	svg: string;
	open: boolean;
	onClose: () => void;
}

interface View {
	scale: number;
	tx: number;
	ty: number;
}

const INITIAL_VIEW: View = { scale: 1, tx: 0, ty: 0 };

/**
 * Full-screen pan/zoom viewer for a rendered mermaid SVG. Scroll wheel zooms
 * toward the cursor, dragging pans, Escape / backdrop / the close button exit.
 */
export function MermaidLightbox({ svg, open, onClose }: Props) {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const [view, setView] = useState<View>(INITIAL_VIEW);
	const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
		null,
	);

	useEffect(() => {
		if (open) setView(INITIAL_VIEW);
	}, [open]);

	// cx/cy are cursor coordinates relative to the viewport center (the
	// transform origin), so the point under the cursor stays put while zooming.
	const zoomBy = useCallback((factor: number, cx = 0, cy = 0) => {
		setView((v) => {
			const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
			const ratio = scale / v.scale;
			return {
				scale,
				tx: cx - (cx - v.tx) * ratio,
				ty: cy - (cy - v.ty) * ratio,
			};
		});
	}, []);

	// React registers onWheel as a passive listener, so preventDefault (needed
	// to keep the wheel from scrolling anything behind) requires attaching a
	// non-passive native listener ourselves.
	useEffect(() => {
		const el = viewportRef.current;
		if (!el || !open) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const rect = el.getBoundingClientRect();
			const cx = e.clientX - rect.left - rect.width / 2;
			const cy = e.clientY - rect.top - rect.height / 2;
			zoomBy(Math.exp(-e.deltaY * 0.002), cx, cy);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [open, zoomBy]);

	const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
	};
	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const d = drag.current;
		if (!d) return;
		setView((v) => ({
			...v,
			tx: d.tx + e.clientX - d.x,
			ty: d.ty + e.clientY - d.y,
		}));
	};
	const onPointerUp = () => {
		drag.current = null;
	};

	return (
		<Dialog open={open} onClose={onClose} fullScreen>
			<Box
				ref={viewportRef}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				sx={{
					position: "relative",
					width: "100%",
					height: "100%",
					overflow: "hidden",
					bgcolor: "background.default",
					cursor: "grab",
					"&:active": { cursor: "grabbing" },
					touchAction: "none",
					userSelect: "none",
				}}
			>
				<Box
					sx={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
						// Mermaid caps its SVG with an inline max-width; lift it so the
						// diagram can grow past the viewport when zoomed.
						"& svg": { maxWidth: "none !important" },
					}}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output is sanitized (securityLevel: "strict")
					dangerouslySetInnerHTML={{ __html: svg }}
				/>
			</Box>
			<Paper
				elevation={4}
				sx={{
					position: "absolute",
					top: 12,
					right: 12,
					display: "flex",
					gap: 0.5,
					p: 0.5,
				}}
			>
				<Tooltip title="Zoom in">
					<IconButton size="small" onClick={() => zoomBy(1.25)}>
						<ZoomInIcon fontSize="small" />
					</IconButton>
				</Tooltip>
				<Tooltip title="Zoom out">
					<IconButton size="small" onClick={() => zoomBy(0.8)}>
						<ZoomOutIcon fontSize="small" />
					</IconButton>
				</Tooltip>
				<Tooltip title="Reset view">
					<IconButton size="small" onClick={() => setView(INITIAL_VIEW)}>
						<RestartAltIcon fontSize="small" />
					</IconButton>
				</Tooltip>
				<Tooltip title="Close">
					<IconButton size="small" onClick={onClose} aria-label="Close">
						<CloseIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			</Paper>
		</Dialog>
	);
}
