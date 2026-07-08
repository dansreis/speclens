import { Box, Chip, Typography } from "@mui/material";
import { type ComponentProps, useMemo, useRef, useState } from "react";
import {
	darkTheme,
	GraphCanvas,
	type GraphCanvasRef,
	type GraphEdge,
	type GraphNode,
	lightTheme,
	useSelection,
} from "reagraph";
import type { Person, Repo } from "../../lib/repoLoader";
import { stripDatePrefix } from "../../lib/stripDatePrefix";
import { useAppStore } from "../../store/useAppStore";

// Rendered node radius range. Also fed into the force layouts as collision
// radii via each node's `size` (assigned at the end of buildGraph).
const MIN_NODE_SIZE = 4;
const MAX_NODE_SIZE = 12;
// Nodes enter the physics at this multiple of their drawn radius, so collision
// resolution leaves air (and label room) between circles instead of letting them
// kiss. Rendering isn't affected: sizingType="default" min-max rescales the
// observed sizes back into [MIN_NODE_SIZE, MAX_NODE_SIZE], exactly undoing the
// multiplier. Raise for more separation.
const NODE_SPACING = 2;

const COLORS = {
	cap: "#2563eb", // existing capability (has a repo spec)
	capProposed: "#f59e0b", // capability introduced by a change, no repo spec yet
	change: "#16a34a", // active change
	changeArchived: "#9ca3af", // archived change
	person: "#a855f7", // contributor
};

type NodeType = "capability" | "change" | "person";

// reagraph only ellipsizes node labels past 75 chars and exposes no way to lower
// that, so long names are shortened here. The full name lives in NodeData for the
// hover card.
const LABEL_MAX = 24;
function truncateLabel(text: string): string {
	if (text.length <= LABEL_MAX) return text;
	return `${text.slice(0, LABEL_MAX - 1).trimEnd()}…`;
}

interface NodeData {
	type: NodeType;
	fullLabel: string;
	// capability
	cap?: string;
	proposed?: boolean;
	// change
	key?: string;
	archived?: boolean;
	createdBy?: string;
	lastEditedBy?: string;
	// shared: capabilities-touched (change) / changes-touching (capability/person)
	relatedCount?: number;
	// person
	email?: string;
}

function buildGraph(
	repo: Repo,
	showPeople: boolean,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	const edgeIds = new Set<string>();
	const addEdge = (source: string, target: string) => {
		const id = `${source}~${target}`;
		if (edgeIds.has(id)) return;
		edgeIds.add(id);
		edges.push({ id, source, target });
	};

	const personId = (p: Person) => `person:${p.email || p.name}`;

	// Pre-count relationships so hover cards can show "N changes touch this", etc.
	const capChangeCount = new Map<string, number>();
	const personChangeCount = new Map<string, number>();
	for (const change of repo.changes) {
		for (const cap of Object.keys(change.specs)) {
			capChangeCount.set(cap, (capChangeCount.get(cap) ?? 0) + 1);
		}
		if (showPeople && change.authorship) {
			const ids = new Set([
				personId(change.authorship.rolled.createdBy),
				personId(change.authorship.rolled.lastEditedBy),
			]);
			for (const pid of ids) {
				personChangeCount.set(pid, (personChangeCount.get(pid) ?? 0) + 1);
			}
		}
	}

	const repoCaps = new Set(repo.repoSpecs.map((s) => s.capability));
	const seenCap = new Set<string>();
	const addCap = (cap: string) => {
		if (seenCap.has(cap)) return;
		seenCap.add(cap);
		const proposed = !repoCaps.has(cap);
		nodes.push({
			id: `cap:${cap}`,
			label: truncateLabel(cap),
			fill: proposed ? COLORS.capProposed : COLORS.cap,
			data: {
				type: "capability",
				fullLabel: cap,
				cap,
				proposed,
				relatedCount: capChangeCount.get(cap) ?? 0,
			} satisfies NodeData,
		});
	};
	for (const spec of repo.repoSpecs) addCap(spec.capability);

	const seenPerson = new Set<string>();
	const addPerson = (p: Person) => {
		const id = personId(p);
		if (seenPerson.has(id)) return;
		seenPerson.add(id);
		nodes.push({
			id,
			label: truncateLabel(p.name),
			fill: COLORS.person,
			data: {
				type: "person",
				fullLabel: p.name,
				email: p.email,
				relatedCount: personChangeCount.get(id) ?? 0,
			} satisfies NodeData,
		});
	};

	for (const change of repo.changes) {
		const key = `${change.archived ? "archive/" : ""}${change.slug}`;
		const id = `chg:${key}`;
		nodes.push({
			id,
			label: truncateLabel(stripDatePrefix(change.name)),
			fill: change.archived ? COLORS.changeArchived : COLORS.change,
			data: {
				type: "change",
				fullLabel: change.name,
				key,
				archived: change.archived,
				relatedCount: Object.keys(change.specs).length,
				createdBy: change.authorship?.rolled.createdBy.name,
				lastEditedBy: change.authorship?.rolled.lastEditedBy.name,
			} satisfies NodeData,
		});
		for (const cap of Object.keys(change.specs)) {
			addCap(cap);
			addEdge(id, `cap:${cap}`);
		}
		if (showPeople && change.authorship) {
			for (const p of [
				change.authorship.rolled.createdBy,
				change.authorship.rolled.lastEditedBy,
			]) {
				addPerson(p);
				addEdge(personId(p), id);
			}
		}
	}

	// The force layouts read collision radii from each node's `size` attribute at
	// layout time, while sizingType-based sizing happens AFTER layout - leaving
	// every node a radius-1 physics body under circles drawn at 4–12, so they
	// overlapped. Assign degree-scaled sizes here, inflated by NODE_SPACING so
	// circles keep clear air between them; sizingType="default" rescales back to
	// the drawn range, keeping physics and pixels in proportion.
	const degrees = nodes.map((n) => (n.data as NodeData).relatedCount ?? 0);
	const minDeg = Math.min(...degrees);
	const maxDeg = Math.max(...degrees);
	nodes.forEach((node, i) => {
		const drawn =
			minDeg === maxDeg
				? (MIN_NODE_SIZE + MAX_NODE_SIZE) / 2
				: Math.round(
						MIN_NODE_SIZE +
							((degrees[i] - minDeg) / (maxDeg - minDeg)) *
								(MAX_NODE_SIZE - MIN_NODE_SIZE),
					);
		node.size = drawn * NODE_SPACING;
	});

	return { nodes, edges };
}

export type GraphLayout = "spread" | "grouped";

type LayoutOverridesProp = ComponentProps<
	typeof GraphCanvas
>["layoutOverrides"];

// "spread": forceAtlas2 with `adjustSizes` accounts for each node's radius, so
// circles don't overlap. Cast because reagraph's exported `LayoutOverrides` type
// only models the forceDirected family, though the factory forwards these keys.
const SPREAD_OVERRIDES = {
	// Prevents circle overlap using each node's `size` attribute - which only
	// works because buildGraph assigns real sizes (unset, every node is radius 1
	// to the physics). scalingRatio adds the extra spacing labels need (they
	// render below the circles and are wider than them), while gravity pulls
	// nodes inward so the graph stays reasonably compact.
	adjustSizes: true,
	scalingRatio: 420,
	gravity: 24,
	iterations: 250,
	barnesHutOptimize: true,
} as unknown as LayoutOverridesProp;

// "grouped": forceDirected2d enables clustering (capabilities vs changes), but
// has no radius collision - so we use moderate repulsion + link distance to keep
// nodes apart, and clusterStrength to push the two clusters off each other so
// changes and capabilities don't bleed together.
const GROUPED_OVERRIDES: LayoutOverridesProp = {
	nodeStrength: -1400,
	linkDistance: 150,
	clusterStrength: 1.5,
	nodeLevelRatio: 5,
};

// Both hoisted to stable references: reagraph keys its layout effect on
// `layoutOverrides`, so an inline object would re-run the whole layout
// (repositioning every node) on every hover re-render.

// Node label styling dead ends in reagraph 4.x, so we use the built-in themes
// as-is - they already stroke label text with the canvas color (an outline halo
// that keeps names legible over edges without occluding anything):
// - `theme.node.label.fontSize` is never forwarded to node labels (only edge and
//   cluster labels honor it), so labels can't be shrunk.
// - `theme.node.label.backgroundColor` draws a pill at a hardcoded z=10 - in
//   front of nearby node circles and labels - and sizes it by a rough character
//   estimate that clips the text. Don't reintroduce it.
// Readability instead comes from truncateLabel + the layout spacing below.

interface HoverState {
	label: string;
	data: NodeData;
	x: number;
	y: number;
}

const TYPE_META: Record<NodeType, { color: string; label: string }> = {
	capability: { color: COLORS.cap, label: "Capability" },
	change: { color: COLORS.change, label: "Change" },
	person: { color: COLORS.person, label: "Contributor" },
};

function HoverCard({ hover }: { hover: HoverState }) {
	const { data, label, x, y } = hover;
	const meta = TYPE_META[data.type];
	const chipLabel =
		data.type === "capability" && data.proposed
			? "Proposed capability"
			: data.type === "change" && data.archived
				? "Archived change"
				: meta.label;
	const chipColor =
		data.type === "capability" && data.proposed
			? COLORS.capProposed
			: data.type === "change" && data.archived
				? COLORS.changeArchived
				: meta.color;

	const lines: string[] = [];
	if (data.type === "capability") {
		lines.push(
			`${data.relatedCount ?? 0} change${data.relatedCount === 1 ? "" : "s"} touch this`,
		);
		if (data.proposed) lines.push("No spec yet - introduced by a change");
	} else if (data.type === "change") {
		lines.push(
			`${data.relatedCount ?? 0} capabilit${data.relatedCount === 1 ? "y" : "ies"}`,
		);
		if (data.createdBy) lines.push(`Created by ${data.createdBy}`);
		if (data.lastEditedBy && data.lastEditedBy !== data.createdBy)
			lines.push(`Last edited by ${data.lastEditedBy}`);
	} else {
		if (data.email) lines.push(data.email);
		lines.push(
			`${data.relatedCount ?? 0} change${data.relatedCount === 1 ? "" : "s"}`,
		);
	}

	return (
		<Box
			sx={{
				position: "fixed",
				left: x + 14,
				top: y + 14,
				zIndex: 1500,
				pointerEvents: "none",
				maxWidth: 280,
				p: 1.25,
				borderRadius: 1,
				border: 1,
				borderColor: "divider",
				bgcolor: "background.paper",
				boxShadow: 4,
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
				<Box
					sx={{
						width: 10,
						height: 10,
						borderRadius: "50%",
						bgcolor: chipColor,
						flexShrink: 0,
					}}
				/>
				<Typography
					variant="subtitle2"
					sx={{
						fontWeight: 700,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{label}
				</Typography>
			</Box>
			<Chip
				size="small"
				label={chipLabel}
				sx={{
					height: 18,
					fontSize: "0.625rem",
					mb: lines.length ? 0.75 : 0,
					color: chipColor,
					borderColor: chipColor,
				}}
				variant="outlined"
			/>
			{lines.map((line) => (
				<Typography
					key={line}
					variant="caption"
					component="div"
					sx={{ mt: 0.25 }}
				>
					{line}
				</Typography>
			))}
		</Box>
	);
}

interface Props {
	repo: Repo;
	showPeople: boolean;
	layout: GraphLayout;
}

export default function GraphCanvasView({ repo, showPeople, layout }: Props) {
	const themeMode = useAppStore((s) => s.themeMode);
	const grouped = layout === "grouped";
	const graphRef = useRef<GraphCanvasRef | null>(null);
	const [hover, setHover] = useState<HoverState | null>(null);
	const { nodes, edges } = useMemo(
		() => buildGraph(repo, showPeople),
		[repo, showPeople],
	);

	const {
		selections,
		actives,
		onNodeClick,
		onCanvasClick,
		onNodePointerOver,
		onNodePointerOut,
	} = useSelection({
		ref: graphRef,
		nodes,
		edges,
		type: "single",
		pathSelectionType: "all", // selecting a node lights up everything it touches
		pathHoverType: "all",
		focusOnSelect: false, // we navigate away on click; no camera jump needed
	});

	const navigate = (node: GraphNode) => {
		const data = node.data as NodeData | undefined;
		const s = useAppStore.getState();
		if (data?.type === "capability" && data.cap) {
			s.setSelectedSpec(data.cap);
			s.setView("specs"); // setView keeps selectedSpec when target is "specs"
		} else if (data?.type === "change" && data.key) {
			s.setSelectedChangeKey(data.key);
			s.setActiveTab("proposal");
			s.setView("changes");
		}
		// person nodes have no destination view
	};

	return (
		<>
			<GraphCanvas
				ref={graphRef}
				nodes={nodes}
				edges={edges}
				layoutType={grouped ? "forceDirected2d" : "forceatlas2"}
				clusterAttribute={grouped ? "type" : undefined}
				layoutOverrides={grouped ? GROUPED_OVERRIDES : SPREAD_OVERRIDES}
				// Freeze positions after the initial layout so hovering/selecting only
				// highlights nodes instead of re-animating the whole graph.
				animated={false}
				// "default" min-max rescales the `size` buildGraph assigned (drawn size
				// × NODE_SPACING) back into [MIN_NODE_SIZE, MAX_NODE_SIZE], so nodes
				// draw at the intended radius while the layouts saw the inflated one.
				// (Don't switch back to "centrality": it sizes nodes after layout, so
				// the physics wouldn't see the rendered radii and circles overlap.)
				sizingType="default"
				minNodeSize={MIN_NODE_SIZE}
				maxNodeSize={MAX_NODE_SIZE}
				// Render every node label (not "auto", which hides smaller nodes' labels
				// until you zoom in). Truncation + label backgrounds keep them readable.
				labelType="nodes"
				draggable
				theme={themeMode === "dark" ? darkTheme : lightTheme}
				selections={selections}
				actives={actives}
				onCanvasClick={onCanvasClick}
				onNodePointerOver={(node, event) => {
					onNodePointerOver?.(node);
					const data = (node.data ?? {}) as NodeData;
					setHover({
						// Canvas labels are truncated; the hover card shows the full name.
						label: data.fullLabel ?? node.label ?? "",
						data,
						x: event.nativeEvent.clientX,
						y: event.nativeEvent.clientY,
					});
				}}
				onNodePointerOut={(node) => {
					onNodePointerOut?.(node);
					setHover(null);
				}}
				onNodeClick={(node) => {
					onNodeClick?.(node);
					navigate(node);
				}}
			/>
			{hover && <HoverCard hover={hover} />}
		</>
	);
}
