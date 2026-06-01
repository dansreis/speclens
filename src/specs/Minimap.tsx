import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Heading } from "../lib/extractHeadings";

interface Props {
	headings: Heading[];
	containerRef: React.RefObject<HTMLDivElement | null>;
}

const SPINE_WIDTH = 40;
const PANEL_WIDTH = 280;
const INDICATOR_MIN_HEIGHT = 20;
const BAR_HEIGHT = 4;
const BAR_GAP = 8;
const RAIL_PADDING_Y = 20;

function barWidth(depth: number): number {
	switch (depth) {
		case 1:
			return 20;
		case 2:
			return 14;
		case 3:
			return 10;
		case 4:
			return 6;
		default:
			return 2;
	}
}

export function Minimap({ headings, containerRef }: Props) {
	const railRef = useRef<HTMLDivElement | null>(null);
	const [activeSlug, setActiveSlug] = useState<string | null>(null);
	const [indicator, setIndicator] = useState({
		top: 0,
		height: INDICATOR_MIN_HEIGHT,
	});
	const [visibleSlugs, setVisibleSlugs] = useState<Set<string>>(new Set());
	const [hovering, setHovering] = useState(false);
	const [pinned, setPinned] = useState(false);
	const dragRef = useRef<{ offset: number; railTop: number } | null>(null);

	const open = hovering || pinned;

	useEffect(() => {
		const container = containerRef.current;
		if (!container || headings.length === 0) return;
		const visibleSet = new Set<string>();
		let lastActive: string | null = null;

		const computeIndicator = () => {
			const indices: number[] = [];
			for (let i = 0; i < headings.length; i++) {
				if (visibleSet.has(headings[i].slug)) indices.push(i);
			}
			if (indices.length > 0) {
				const firstIdx = indices[0];
				const lastIdx = indices[indices.length - 1];
				const top = RAIL_PADDING_Y + firstIdx * (BAR_HEIGHT + BAR_GAP) - 4;
				const bottom =
					RAIL_PADDING_Y + lastIdx * (BAR_HEIGHT + BAR_GAP) + BAR_HEIGHT + 4;
				const height = Math.max(INDICATOR_MIN_HEIGHT, bottom - top);
				setIndicator({ top, height });
			} else if (lastActive) {
				const idx = headings.findIndex((h) => h.slug === lastActive);
				if (idx >= 0) {
					const top = RAIL_PADDING_Y + idx * (BAR_HEIGHT + BAR_GAP) - 4;
					setIndicator({ top, height: INDICATOR_MIN_HEIGHT });
				}
			}
		};

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const id = (entry.target as HTMLElement).id;
					if (!id) continue;
					if (entry.isIntersecting) visibleSet.add(id);
					else visibleSet.delete(id);
				}
				setVisibleSlugs(new Set(visibleSet));
				if (visibleSet.size > 0) {
					let topId: string | null = null;
					let topY = Infinity;
					for (const id of visibleSet) {
						const el = container.querySelector<HTMLElement>(
							`#${CSS.escape(id)}`,
						);
						if (!el) continue;
						const y = el.getBoundingClientRect().top;
						if (y < topY) {
							topY = y;
							topId = id;
						}
					}
					if (topId) {
						lastActive = topId;
						setActiveSlug(topId);
					}
				}
				computeIndicator();
			},
			{
				root: container,
				threshold: 0,
			},
		);
		const els = container.querySelectorAll<HTMLElement>(
			"h1, h2, h3, h4, h5, h6",
		);
		for (const el of els) {
			if (el.id) observer.observe(el);
		}
		lastActive = els[0]?.id ?? null;
		setActiveSlug(lastActive);
		return () => observer.disconnect();
	}, [containerRef, headings]);

	const scrollToSlug = (slug: string) => {
		const target = containerRef.current?.querySelector(`#${CSS.escape(slug)}`);
		target?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		const container = containerRef.current;
		const rail = railRef.current;
		if (!container || !rail) return;
		const indicatorRect = e.currentTarget.getBoundingClientRect();
		const railRect = rail.getBoundingClientRect();
		dragRef.current = {
			offset: e.clientY - indicatorRect.top,
			railTop: railRect.top,
		};
		e.currentTarget.setPointerCapture(e.pointerId);
		e.preventDefault();
	};

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		const container = containerRef.current;
		const rail = railRef.current;
		if (!drag || !container || !rail) return;
		const newTop = e.clientY - drag.railTop - drag.offset;
		const idx = Math.round(
			(newTop - RAIL_PADDING_Y + 4) / (BAR_HEIGHT + BAR_GAP),
		);
		const clampedIdx = Math.max(0, Math.min(idx, headings.length - 1));
		const heading = headings[clampedIdx];
		const el = container.querySelector<HTMLElement>(
			`#${CSS.escape(heading.slug)}`,
		);
		el?.scrollIntoView({ behavior: "auto", block: "start" });
	};

	const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		dragRef.current = null;
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId);
		}
	};

	if (headings.length === 0) return null;

	return (
		<Box
			sx={{
				position: "relative",
				flexShrink: 0,
				width: pinned ? SPINE_WIDTH + PANEL_WIDTH : SPINE_WIDTH,
				transition: "width 200ms ease-in-out",
			}}
			onPointerEnter={() => setHovering(true)}
			onPointerLeave={() => setHovering(false)}
		>
			<Box
				ref={railRef}
				sx={{
					width: SPINE_WIDTH,
					height: "100%",
					position: "relative",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: `${BAR_GAP}px`,
					py: `${RAIL_PADDING_Y}px`,
					overflow: "hidden",
					borderRight: 1,
					borderColor: "divider",
				}}
			>
				<Box
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
					sx={{
						position: "absolute",
						left: "7px",
						right: "7px",
						top: `${indicator.top}px`,
						height: `${indicator.height}px`,
						minHeight: `${INDICATOR_MIN_HEIGHT}px`,
						zIndex: 1,
						borderRadius: 0.5,
						border: 1,
						borderColor: "divider",
						bgcolor: "action.hover",
						cursor: "grab",
						transition: "top 150ms ease-out, height 150ms ease-out",
						"&:active": { cursor: "grabbing" },
						"&:hover": { borderColor: "text.secondary" },
						touchAction: "none",
					}}
				/>
				{headings.map((h) => {
					const inView = visibleSlugs.has(h.slug);
					return (
						<Box
							key={h.slug}
							onClick={() => scrollToSlug(h.slug)}
							sx={{
								position: "relative",
								zIndex: 2,
								flexShrink: 0,
								height: `${BAR_HEIGHT}px`,
								width: `${barWidth(h.depth)}px`,
								borderRadius: 0.5,
								bgcolor: inView ? "primary.main" : "text.disabled",
								opacity: inView ? 1 : 0.35,
								cursor: "pointer",
								transition: "background-color 200ms, opacity 200ms",
								"&:hover": { opacity: 1 },
							}}
							title={h.text}
						/>
					);
				})}
			</Box>
			<Box
				sx={{
					position: "absolute",
					top: 0,
					bottom: 0,
					left: `${SPINE_WIDTH}px`,
					width: open ? PANEL_WIDTH : 0,
					opacity: open ? 1 : 0,
					pointerEvents: open ? "auto" : "none",
					zIndex: 10,
					display: "flex",
					flexDirection: "column",
					bgcolor: "background.paper",
					borderRight: 1,
					borderColor: "divider",
					boxShadow: pinned ? 0 : 3,
					overflow: "hidden",
					transition:
						"width 200ms ease-in-out, opacity 200ms ease-in-out, box-shadow 200ms",
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						px: 1.5,
						py: 1,
						flexShrink: 0,
					}}
				>
					<Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
						Table of Contents
					</Typography>
					<Tooltip title={pinned ? "Unpin ToC" : "Pin ToC"}>
						<IconButton
							size="small"
							onClick={() => setPinned((p) => !p)}
							aria-label={pinned ? "Unpin ToC" : "Pin ToC"}
							sx={{
								color: pinned ? "primary.main" : "text.secondary",
							}}
						>
							{pinned ? (
								<PushPinIcon fontSize="small" />
							) : (
								<PushPinOutlinedIcon fontSize="small" />
							)}
						</IconButton>
					</Tooltip>
				</Box>
				<Box sx={{ flex: 1, overflowY: "auto", pb: 1 }}>
					{headings.map((h) => {
						const active = h.slug === activeSlug;
						return (
							<Box
								key={h.slug}
								onClick={() => scrollToSlug(h.slug)}
								sx={{
									display: "flex",
									alignItems: "center",
									pl: `${20 + (h.depth - 1) * 12}px`,
									pr: 2,
									py: 0.75,
									borderLeft: 2,
									borderColor: active ? "primary.main" : "transparent",
									bgcolor: active ? "action.selected" : "transparent",
									color: active ? "text.primary" : "text.secondary",
									fontWeight: active ? 600 : 400,
									cursor: "pointer",
									transition:
										"background-color 150ms, color 150ms, border-color 150ms",
									"&:hover": {
										bgcolor: "action.hover",
										color: "text.primary",
									},
								}}
							>
								<Typography
									variant="body2"
									sx={{
										display: "-webkit-box",
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
										overflow: "hidden",
										overflowWrap: "anywhere",
										lineHeight: 1.4,
									}}
								>
									{h.text}
								</Typography>
							</Box>
						);
					})}
				</Box>
			</Box>
		</Box>
	);
}
