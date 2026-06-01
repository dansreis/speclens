import { Box, IconButton, Typography } from "@mui/material";
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
	return depth <= 1 ? 18 : 10;
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
					if (topId) setActiveSlug(topId);
				}
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
		setActiveSlug(els[0]?.id ?? null);
		return () => observer.disconnect();
	}, [containerRef, headings]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-runs when source changes so the indicator reflects the new scrollHeight
	useEffect(() => {
		const container = containerRef.current;
		const rail = railRef.current;
		if (!container || !rail) return;
		const update = () => {
			const railHeight = rail.clientHeight;
			const scrollTop = container.scrollTop;
			const scrollHeight = container.scrollHeight;
			const clientHeight = container.clientHeight;
			if (scrollHeight <= clientHeight) {
				setIndicator({ top: 0, height: railHeight });
				return;
			}
			const ratioHeight = clientHeight / scrollHeight;
			const height = Math.max(INDICATOR_MIN_HEIGHT, ratioHeight * railHeight);
			const ratioTop = scrollTop / (scrollHeight - clientHeight);
			const top = ratioTop * (railHeight - height);
			setIndicator({ top, height });
		};
		update();
		container.addEventListener("scroll", update);
		const ro = new ResizeObserver(update);
		ro.observe(container);
		ro.observe(rail);
		return () => {
			container.removeEventListener("scroll", update);
			ro.disconnect();
		};
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
		const railHeight = rail.clientHeight;
		const newTop = e.clientY - drag.railTop - drag.offset;
		const maxTop = railHeight - indicator.height;
		const clampedTop = Math.max(0, Math.min(newTop, maxTop));
		const ratio = maxTop > 0 ? clampedTop / maxTop : 0;
		container.scrollTop =
			ratio * (container.scrollHeight - container.clientHeight);
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
				width: SPINE_WIDTH,
				borderRight: 1,
				borderColor: "divider",
			}}
			onPointerEnter={() => setHovering(true)}
			onPointerLeave={() => setHovering(false)}
		>
			<Box
				ref={railRef}
				sx={{
					height: "100%",
					position: "relative",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: `${BAR_GAP}px`,
					py: `${RAIL_PADDING_Y}px`,
					overflow: "hidden",
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
					left: "100%",
					width: open ? PANEL_WIDTH : 0,
					opacity: open ? 1 : 0,
					pointerEvents: open ? "auto" : "none",
					zIndex: 10,
					display: "flex",
					flexDirection: "column",
					bgcolor: "background.paper",
					borderRight: 1,
					borderColor: "divider",
					boxShadow: 3,
					overflow: "hidden",
					transition: "width 200ms ease-in-out, opacity 200ms ease-in-out",
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
					<IconButton
						size="small"
						onClick={() => setPinned((p) => !p)}
						aria-label={
							pinned ? "Unpin Table of Contents" : "Pin Table of Contents"
						}
						sx={{
							fontSize: "0.875rem",
							color: pinned ? "primary.main" : "text.secondary",
						}}
					>
						📌
					</IconButton>
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
