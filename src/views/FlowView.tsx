import {
	Background,
	Controls,
	type Edge,
	Handle,
	MarkerType,
	MiniMap,
	type Node,
	type NodeProps,
	Position,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import AutorenewOutlinedIcon from "@mui/icons-material/AutorenewOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
	Box,
	Paper,
	Popper,
	Tooltip,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import {
	buildFlow,
	type DeltaOp,
	type FlowChange,
	type FlowData,
	type FlowDot,
	type LifecycleState,
} from "../lib/changeFlow";
import { repos } from "../lib/exampleLoader";
import { useAppStore } from "../store/useAppStore";

const LABEL_W = 200;
const CHART_L = LABEL_W + 40;
const COL_GAP = 58;
const PILL_TOP = 130;
const PILL_SIZE = 14;
const LANE_TOP = 180;
const LANE_GAP = 42;
const DOT_R = 6;
const TIME_AXIS_GAP = 40;
const LABEL_OVERHANG_RIGHT = 120;
const LABEL_OVERHANG_TOP = 110;

// Marginal uniform padding, high maxZoom — the chart fills the canvas as much
// as possible, centered. Lower padding → tighter fit. Raise maxZoom → small
// repos can grow further.
const FIT_VIEW_PADDING = 0.02;
const FIT_VIEW_MAX_ZOOM = 10;
const FIT_VIEW_BUTTON_DURATION = 300;

const OP_PALETTE: Record<
	DeltaOp,
	"success" | "warning" | "error" | "secondary"
> = {
	added: "success",
	modified: "warning",
	removed: "error",
	renamed: "secondary",
};

const OP_LABEL: Record<DeltaOp, string> = {
	added: "added",
	modified: "modified",
	removed: "removed",
	renamed: "renamed",
};

const STATE_LABEL: Record<LifecycleState, string> = {
	archived: "archived",
	"in-progress": "in progress",
	draft: "draft",
};

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
	year: "numeric",
	month: "short",
	day: "numeric",
});

function truncate(s: string, max = 22): string {
	return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function activate(handler: () => void) {
	return (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handler();
		}
	};
}

function opColor(op: DeltaOp, theme: Theme) {
	const c = theme.palette[OP_PALETTE[op]];
	return { fill: c.main, stroke: c.dark };
}

function pillColor(state: LifecycleState, theme: Theme) {
	if (state === "archived") {
		return {
			fill: alpha(theme.palette.text.primary, 0.08),
			stroke: alpha(theme.palette.text.primary, 0.4),
			dash: undefined as string | undefined,
		};
	}
	if (state === "in-progress") {
		return {
			fill: alpha(theme.palette.primary.main, 0.3),
			stroke: theme.palette.primary.main,
			dash: undefined,
		};
	}
	return {
		fill: "transparent",
		stroke: alpha(theme.palette.text.primary, 0.45),
		dash: "3 2",
	};
}

const HANDLE_STYLE: React.CSSProperties = {
	opacity: 0,
	width: 1,
	height: 1,
	border: 0,
	background: "transparent",
	pointerEvents: "none",
	minWidth: 0,
	minHeight: 0,
};

type ChangeNodeData = { change: FlowChange };
type DotNodeData = { change: FlowChange; dot: FlowDot };
type LaneLabelNodeData = { capability: string };
type TimeLabelNodeData = Record<string, never>;
type SpacerNodeData = Record<string, never>;

type ChangeNodeType = Node<ChangeNodeData, "change">;
type DotNodeType = Node<DotNodeData, "dot">;
type LaneLabelNodeType = Node<LaneLabelNodeData, "laneLabel">;
type TimeLabelNodeType = Node<TimeLabelNodeData, "timeLabel">;
type SpacerNodeType = Node<SpacerNodeData, "spacer">;

function ChangeNode({ data }: NodeProps<ChangeNodeType>) {
	const theme = useTheme();
	const setView = useAppStore((s) => s.setView);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const { change } = data;

	const onClick = () => {
		setView("changes");
		setSelectedChangeKey(change.key);
	};

	const col = pillColor(change.state, theme);
	const fillPct =
		change.state === "in-progress" ? Math.round(change.progress * 100) : 0;

	return (
		<Box
			role="button"
			aria-label={change.slug}
			tabIndex={0}
			onClick={onClick}
			onKeyDown={activate(onClick)}
			className="nodrag"
			sx={{
				width: PILL_SIZE,
				height: PILL_SIZE,
				position: "relative",
				cursor: "pointer",
				outline: "none",
			}}
		>
			<Handle
				id="bottom"
				type="source"
				position={Position.Bottom}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
			{/* Pill body */}
			<Box
				sx={{
					position: "absolute",
					inset: 0,
					bgcolor: col.fill,
					border: `0.75px ${col.dash ? "dashed" : "solid"} ${col.stroke}`,
					borderRadius: "3px",
					overflow: "hidden",
				}}
			>
				{fillPct > 0 && (
					<Box
						sx={{
							position: "absolute",
							left: 0,
							right: 0,
							bottom: 0,
							height: `${fillPct}%`,
							bgcolor: "primary.main",
							opacity: 0.7,
						}}
					/>
				)}
			</Box>
			{/* Diagonal label — bottom-left pivots above pill's top edge */}
			<Box
				sx={{
					position: "absolute",
					left: PILL_SIZE / 2,
					bottom: "calc(100% + 4px)",
					transform: "rotate(-42deg)",
					transformOrigin: "0 100%",
					fontSize: 11,
					color: "text.secondary",
					whiteSpace: "nowrap",
					pointerEvents: "none",
					userSelect: "none",
					lineHeight: 1,
				}}
			>
				{truncate(change.slug)}
			</Box>
		</Box>
	);
}

function DotNode({ data }: NodeProps<DotNodeType>) {
	const theme = useTheme();
	const setView = useAppStore((s) => s.setView);
	const setSelectedChangeKey = useAppStore((s) => s.setSelectedChangeKey);
	const { change, dot } = data;

	const onClick = () => {
		setView("changes");
		setSelectedChangeKey(change.key);
	};

	const col = opColor(dot.primaryOp, theme);

	return (
		<Box
			role="button"
			aria-label={`${dot.capability} ${dot.primaryOp} in ${change.slug}`}
			tabIndex={0}
			onClick={onClick}
			onKeyDown={activate(onClick)}
			className="nodrag"
			sx={{
				width: DOT_R * 2,
				height: DOT_R * 2,
				borderRadius: "50%",
				bgcolor: col.fill,
				border: `1px solid ${col.stroke}`,
				cursor: "pointer",
				outline: "none",
				position: "relative",
				transition: "transform 120ms ease-out",
				"&:hover": { transform: "scale(1.6)" },
			}}
		>
			<Handle
				id="left"
				type="target"
				position={Position.Left}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
			<Handle
				id="right"
				type="source"
				position={Position.Right}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
			<Handle
				id="top"
				type="target"
				position={Position.Top}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
		</Box>
	);
}

function LaneLabelNode({ data }: NodeProps<LaneLabelNodeType>) {
	return (
		<Box
			sx={{
				width: LABEL_W,
				height: 20,
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-end",
				pr: "14px",
				fontSize: 12,
				color: "text.primary",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			{data.capability}
		</Box>
	);
}

function TimeLabelNode() {
	return (
		<Box
			sx={{
				width: 36,
				height: 18,
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-end",
				fontSize: 12,
				color: "text.secondary",
				pointerEvents: "none",
				userSelect: "none",
				position: "relative",
			}}
		>
			time
			<Handle
				id="right"
				type="source"
				position={Position.Right}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
		</Box>
	);
}

function SpacerNode() {
	return (
		<Box
			sx={{
				width: 1,
				height: 1,
				opacity: 0,
				pointerEvents: "none",
				position: "relative",
			}}
		>
			<Handle
				id="left"
				type="target"
				position={Position.Left}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
			<Handle
				id="right"
				type="source"
				position={Position.Right}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
			<Handle
				id="top"
				type="target"
				position={Position.Top}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
			<Handle
				id="bottom"
				type="source"
				position={Position.Bottom}
				isConnectable={false}
				style={HANDLE_STYLE}
			/>
		</Box>
	);
}

const nodeTypes = {
	change: ChangeNode,
	dot: DotNode,
	laneLabel: LaneLabelNode,
	timeLabel: TimeLabelNode,
	spacer: SpacerNode,
};

function buildGraph(
	flow: FlowData,
	theme: Theme,
): { nodes: Node[]; edges: Edge[] } {
	const nodes: Node[] = [];
	const edges: Edge[] = [];

	const changeX = (idx: number) => CHART_L + idx * COL_GAP;
	const laneIdxByCap = new Map(
		flow.lanes.map((l, i) => [l.capability, i] as const),
	);
	const laneY = (j: number) => LANE_TOP + j * LANE_GAP;

	const chartR = changeX(Math.max(0, flow.changes.length - 1));
	const lastLaneY = laneY(Math.max(0, flow.lanes.length - 1));
	const timeAxisY = lastLaneY + TIME_AXIS_GAP;

	for (const lane of flow.lanes) {
		const j = laneIdxByCap.get(lane.capability) ?? 0;
		nodes.push({
			id: `lane-${lane.capability}`,
			type: "laneLabel",
			position: { x: 0, y: laneY(j) - 10 },
			data: { capability: lane.capability },
			width: LABEL_W,
			height: 20,
			draggable: false,
			selectable: false,
		});
	}

	for (let i = 0; i < flow.changes.length; i++) {
		const c = flow.changes[i];
		nodes.push({
			id: `change-${c.key}`,
			type: "change",
			position: { x: changeX(i) - PILL_SIZE / 2, y: PILL_TOP },
			data: { change: c },
			width: PILL_SIZE,
			height: PILL_SIZE,
			draggable: false,
		});
	}

	for (let i = 0; i < flow.changes.length; i++) {
		const c = flow.changes[i];
		for (const d of c.dots) {
			const j = laneIdxByCap.get(d.capability);
			if (j === undefined) continue;
			nodes.push({
				id: `dot-${c.key}-${d.capability}`,
				type: "dot",
				position: { x: changeX(i) - DOT_R, y: laneY(j) - DOT_R },
				data: { change: c, dot: d },
				width: DOT_R * 2,
				height: DOT_R * 2,
				draggable: false,
			});
		}
	}

	// Time axis: label node + spacer + edge with arrow marker
	nodes.push({
		id: "timeLabel",
		type: "timeLabel",
		position: { x: LABEL_W - 50, y: timeAxisY - 9 },
		data: {},
		width: 36,
		height: 18,
		draggable: false,
		selectable: false,
	});
	nodes.push({
		id: "timeEnd",
		type: "spacer",
		position: { x: chartR + 30, y: timeAxisY },
		data: {},
		width: 1,
		height: 1,
		draggable: false,
		selectable: false,
	});
	edges.push({
		id: "time-axis-edge",
		source: "timeLabel",
		target: "timeEnd",
		sourceHandle: "right",
		targetHandle: "left",
		type: "straight",
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: 14,
			height: 14,
			color: theme.palette.text.secondary,
		},
		style: {
			stroke: theme.palette.text.secondary,
			strokeWidth: 1.5,
		},
		selectable: false,
		focusable: false,
	});

	// Corner spacers so fitView includes the rotated-label area above the pills
	nodes.push({
		id: "spacer-tl",
		type: "spacer",
		position: { x: 0, y: PILL_TOP - LABEL_OVERHANG_TOP },
		data: {},
		width: 1,
		height: 1,
		draggable: false,
		selectable: false,
	});
	nodes.push({
		id: "spacer-tr",
		type: "spacer",
		position: {
			x: chartR + LABEL_OVERHANG_RIGHT,
			y: PILL_TOP - LABEL_OVERHANG_TOP,
		},
		data: {},
		width: 1,
		height: 1,
		draggable: false,
		selectable: false,
	});

	// Lane edges
	const dotIdsByCap = new Map<string, string[]>();
	for (const c of flow.changes) {
		for (const d of c.dots) {
			const arr = dotIdsByCap.get(d.capability) ?? [];
			arr.push(`dot-${c.key}-${d.capability}`);
			dotIdsByCap.set(d.capability, arr);
		}
	}
	for (const [cap, ids] of dotIdsByCap) {
		if (ids.length < 2) continue;
		edges.push({
			id: `lane-edge-${cap}`,
			source: ids[0],
			target: ids[ids.length - 1],
			sourceHandle: "right",
			targetHandle: "left",
			type: "straight",
			style: {
				stroke: theme.palette.divider,
				strokeWidth: 1.5,
				opacity: 0.7,
			},
			selectable: false,
			focusable: false,
		});
	}

	// Spine edges
	for (const c of flow.changes) {
		if (c.dots.length === 0) continue;
		let lowestCap: string | null = null;
		let lowestJ = -1;
		for (const d of c.dots) {
			const j = laneIdxByCap.get(d.capability);
			if (j !== undefined && j > lowestJ) {
				lowestJ = j;
				lowestCap = d.capability;
			}
		}
		if (!lowestCap) continue;
		const dashed = c.state === "draft";
		edges.push({
			id: `spine-${c.key}`,
			source: `change-${c.key}`,
			target: `dot-${c.key}-${lowestCap}`,
			sourceHandle: "bottom",
			targetHandle: "top",
			type: "straight",
			style: {
				stroke: theme.palette.text.secondary,
				strokeWidth: 0.75,
				opacity: 0.35,
				...(dashed ? { strokeDasharray: "3 2" } : {}),
			},
			selectable: false,
			focusable: false,
		});
	}

	return { nodes, edges };
}

function minimapNodeColor(node: Node, theme: Theme): string {
	if (node.type === "dot") {
		const d = node.data as DotNodeData;
		return theme.palette[OP_PALETTE[d.dot.primaryOp]].main;
	}
	if (node.type === "change") {
		const c = (node.data as ChangeNodeData).change;
		if (c.state === "in-progress") return theme.palette.primary.main;
		if (c.state === "draft") return alpha(theme.palette.text.primary, 0.3);
		return alpha(theme.palette.text.primary, 0.5);
	}
	if (node.type === "laneLabel") return alpha(theme.palette.text.primary, 0.12);
	return "transparent";
}

export function FlowView() {
	const theme = useTheme();
	const selectedRepoId = useAppStore((s) => s.selectedRepoId);
	const setFlowViewport = useAppStore((s) => s.setFlowViewport);
	const repo = repos.find((r) => r.id === selectedRepoId) ?? repos[0];
	const flow = useMemo(() => (repo ? buildFlow(repo) : null), [repo]);

	// Read the stored viewport via getState (not the hook) so pan/zoom updates
	// don't re-render this whole view. ReactFlow only consumes defaultViewport
	// on mount, and ReactFlow remounts (key={repo.id}) whenever the repo changes.
	const initialViewport = useAppStore.getState().flowViewport;

	const graph = useMemo(() => {
		if (!flow) return { nodes: [], edges: [] };
		return buildGraph(flow, theme);
	}, [flow, theme]);

	const [hover, setHover] = useState<{
		node: Node;
		x: number;
		y: number;
	} | null>(null);

	const virtualAnchor = useMemo(() => {
		if (!hover) return null;
		const x = hover.x;
		const y = hover.y;
		return {
			getBoundingClientRect: () =>
				({
					x,
					y,
					top: y,
					left: x,
					right: x,
					bottom: y,
					width: 0,
					height: 0,
					toJSON: () => ({}),
				}) as DOMRect,
		};
	}, [hover]);

	const handleNodeMouseEnter = useCallback(
		(event: React.MouseEvent, node: Node) => {
			if (node.type !== "change" && node.type !== "dot") return;
			setHover({ node, x: event.clientX, y: event.clientY });
		},
		[],
	);
	const handleNodeMouseMove = useCallback(
		(event: React.MouseEvent, node: Node) => {
			if (node.type !== "change" && node.type !== "dot") return;
			setHover((prev) =>
				prev && prev.node.id === node.id
					? { node, x: event.clientX, y: event.clientY }
					: prev,
			);
		},
		[],
	);
	const handleNodeMouseLeave = useCallback(() => {
		setHover(null);
	}, []);

	if (!repo) {
		return <Placeholder text="No repository available." />;
	}
	if (!flow || flow.changes.length === 0) {
		return <Placeholder text="This repo has no changes yet." />;
	}

	const totalChanges = flow.changes.length;
	const totalLanes = flow.lanes.length;

	const lifecycleCounts = (() => {
		let archived = 0;
		let inProgress = 0;
		let draft = 0;
		for (const c of flow.changes) {
			if (c.state === "archived") archived++;
			else if (c.state === "in-progress") inProgress++;
			else draft++;
		}
		return { archived, inProgress, draft };
	})();

	return (
		<Box
			sx={{
				flex: 1,
				minHeight: 0,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			<Box
				sx={{
					px: 3,
					pt: 3,
					pb: 2,
					flexShrink: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 2,
					flexWrap: "wrap",
				}}
			>
				<Box
					sx={{
						minWidth: 0,
						flex: 1,
						display: "flex",
						alignItems: "center",
						gap: 2,
						flexWrap: "wrap",
					}}
				>
					<StatChip
						icon={<LayersOutlinedIcon sx={{ fontSize: 20 }} />}
						value={totalLanes}
						label="Capabilities"
					/>
					<StatChip
						icon={<TrendingUpIcon sx={{ fontSize: 20 }} />}
						value={totalChanges}
						label="Changes"
					/>
					<StatChip
						icon={<ArchiveOutlinedIcon sx={{ fontSize: 20 }} />}
						value={lifecycleCounts.archived}
						label="Archived"
					/>
					<StatChip
						icon={<AutorenewOutlinedIcon sx={{ fontSize: 20 }} />}
						value={lifecycleCounts.inProgress}
						label="In progress"
					/>
					<StatChip
						icon={<EditOutlinedIcon sx={{ fontSize: 20 }} />}
						value={lifecycleCounts.draft}
						label="Draft"
					/>
				</Box>
				<LegendPanel theme={theme} />
			</Box>
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					position: "relative",
					borderTop: 1,
					borderColor: "divider",
					"& .react-flow__node, & .react-flow__minimap, & .react-flow__renderer":
						{
							WebkitFontSmoothing: "antialiased",
							MozOsxFontSmoothing: "grayscale",
							textRendering: "geometricPrecision",
						},
					"& .react-flow__controls": {
						background: theme.palette.background.paper,
						border: `1px solid ${theme.palette.divider}`,
						borderRadius: "6px",
						boxShadow: theme.shadows[2],
						overflow: "hidden",
					},
					"& .react-flow__controls-button": {
						background: theme.palette.background.paper,
						borderBottom: `1px solid ${theme.palette.divider}`,
						color: theme.palette.text.primary,
						"&:hover": {
							background: theme.palette.action.hover,
						},
						"&:last-of-type": { borderBottom: "none" },
					},
					"& .react-flow__controls-button svg, & .react-flow__controls-button path":
						{
							fill: theme.palette.text.primary,
						},
				}}
			>
				<ReactFlow
					key={repo.id}
					nodes={graph.nodes}
					edges={graph.edges}
					nodeTypes={nodeTypes}
					{...(initialViewport
						? { defaultViewport: initialViewport }
						: {
								fitView: true,
								fitViewOptions: {
									padding: FIT_VIEW_PADDING,
									maxZoom: FIT_VIEW_MAX_ZOOM,
								},
							})}
					onViewportChange={setFlowViewport}
					minZoom={0.05}
					maxZoom={3}
					nodesDraggable={false}
					nodesConnectable={false}
					elementsSelectable={false}
					panOnDrag
					zoomOnScroll
					zoomOnPinch
					zoomOnDoubleClick={false}
					onNodeMouseEnter={handleNodeMouseEnter}
					onNodeMouseMove={handleNodeMouseMove}
					onNodeMouseLeave={handleNodeMouseLeave}
					proOptions={{ hideAttribution: true }}
					style={{ background: theme.palette.background.default }}
				>
					<Background
						color={alpha(theme.palette.text.primary, 0.18)}
						gap={28}
						size={1}
					/>
					<Controls
						showInteractive={false}
						fitViewOptions={{
							padding: FIT_VIEW_PADDING,
							maxZoom: FIT_VIEW_MAX_ZOOM,
							duration: FIT_VIEW_BUTTON_DURATION,
						}}
					/>
					<MiniMap
						pannable
						zoomable
						maskColor={alpha(theme.palette.background.default, 0.7)}
						maskStrokeColor={theme.palette.text.primary}
						maskStrokeWidth={1}
						nodeColor={(n) => minimapNodeColor(n, theme)}
						nodeStrokeWidth={2}
						style={{
							width: 160,
							height: 100,
							background: theme.palette.background.paper,
							border: `1px solid ${theme.palette.divider}`,
							borderRadius: 6,
						}}
					/>
				</ReactFlow>
				<Popper
					open={Boolean(hover && virtualAnchor)}
					anchorEl={virtualAnchor}
					placement="top"
					modifiers={[{ name: "offset", options: { offset: [0, 12] } }]}
					sx={{ zIndex: 1500, pointerEvents: "none" }}
				>
					<Paper
						elevation={6}
						sx={{
							px: 1.5,
							py: 1,
							maxWidth: 280,
							bgcolor: "background.paper",
							backgroundImage: "none",
							border: 1,
							borderColor: "divider",
						}}
					>
						{hover?.node.type === "dot" ? (
							<DotTooltip
								change={(hover.node.data as DotNodeData).change}
								dot={(hover.node.data as DotNodeData).dot}
							/>
						) : hover?.node.type === "change" ? (
							<PillTooltip
								change={(hover.node.data as ChangeNodeData).change}
							/>
						) : null}
					</Paper>
				</Popper>
			</Box>
		</Box>
	);
}

function LegendPanel({ theme }: { theme: Theme }) {
	const ops: DeltaOp[] = ["added", "modified", "removed", "renamed"];
	const states: LifecycleState[] = ["archived", "in-progress", "draft"];
	return (
		<Box
			sx={{
				bgcolor: alpha(theme.palette.background.paper, 0.95),
				border: 1,
				borderColor: "divider",
				borderRadius: 1,
				px: 1.5,
				py: 0.75,
				display: "flex",
				alignItems: "center",
				gap: 1.25,
				fontSize: 12,
				backdropFilter: "blur(4px)",
			}}
		>
			{ops.map((op) => {
				const col = opColor(op, theme);
				return (
					<Box
						key={op}
						sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
					>
						<Box
							sx={{
								width: 10,
								height: 10,
								borderRadius: "50%",
								bgcolor: col.fill,
								border: `1px solid ${col.stroke}`,
							}}
						/>
						<Box sx={{ color: "text.secondary" }}>{OP_LABEL[op]}</Box>
					</Box>
				);
			})}
			<Box
				sx={{
					width: "1px",
					alignSelf: "stretch",
					my: 0.25,
					bgcolor: "divider",
				}}
			/>
			{states.map((s) => {
				const col = pillColor(s, theme);
				return (
					<Box key={s} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
						<Box
							sx={{
								width: 12,
								height: 12,
								borderRadius: "3px",
								bgcolor: col.fill,
								border: `1px ${col.dash ? "dashed" : "solid"} ${col.stroke}`,
							}}
						/>
						<Box sx={{ color: "text.secondary" }}>{STATE_LABEL[s]}</Box>
					</Box>
				);
			})}
		</Box>
	);
}

function PillTooltip({ change }: { change: FlowChange }) {
	const dateLine =
		change.archivedAt && DATE_FMT.format(change.archivedAt)
			? `Archived ${DATE_FMT.format(change.archivedAt)}`
			: change.createdAt
				? `Created ${DATE_FMT.format(change.createdAt)}`
				: null;
	return (
		<Box sx={{ py: 0.25, minWidth: 180 }}>
			<Box
				sx={{
					fontFamily: "ui-monospace, monospace",
					fontWeight: 600,
					fontSize: "0.75rem",
				}}
			>
				{change.slug}
			</Box>
			<Box sx={{ fontSize: "0.7rem", opacity: 0.9, mt: 0.25 }}>
				{STATE_LABEL[change.state]}
				{change.state === "in-progress" &&
					` · ${Math.round(change.progress * 100)}% complete`}
			</Box>
			<Box sx={{ fontSize: "0.7rem", opacity: 0.9, mt: 0.5 }}>
				Touches {change.dots.length}{" "}
				{change.dots.length === 1 ? "capability" : "capabilities"}
			</Box>
			{dateLine && (
				<Box sx={{ fontSize: "0.65rem", opacity: 0.7, mt: 0.5 }}>
					{dateLine}
				</Box>
			)}
			<Box
				sx={{
					fontSize: "0.65rem",
					opacity: 0.6,
					mt: 0.75,
					fontStyle: "italic",
				}}
			>
				Click to open
			</Box>
		</Box>
	);
}

function DotTooltip({ change, dot }: { change: FlowChange; dot: FlowDot }) {
	const ops = [...dot.ops].sort();
	return (
		<Box sx={{ py: 0.25, minWidth: 180 }}>
			<Box
				sx={{
					fontFamily: "ui-monospace, monospace",
					fontWeight: 600,
					fontSize: "0.75rem",
				}}
			>
				{dot.capability}
			</Box>
			<Box sx={{ fontSize: "0.7rem", opacity: 0.9, mt: 0.25 }}>
				{ops.map((o) => OP_LABEL[o]).join(" · ")}
			</Box>
			<Box sx={{ fontSize: "0.7rem", opacity: 0.75, mt: 0.5 }}>
				in <strong>{change.slug}</strong>
			</Box>
			<Box
				sx={{
					fontSize: "0.65rem",
					opacity: 0.6,
					mt: 0.75,
					fontStyle: "italic",
				}}
			>
				Click to open change
			</Box>
		</Box>
	);
}

function StatChip({
	icon,
	value,
	label,
}: {
	icon: React.ReactNode;
	value: number;
	label: string;
}) {
	return (
		<Tooltip title={label} arrow placement="bottom">
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 0.5,
					color: "text.secondary",
					cursor: "default",
				}}
			>
				{icon}
				<Typography
					variant="body2"
					sx={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
				>
					{value}
				</Typography>
			</Box>
		</Tooltip>
	);
}

function Placeholder({ text }: { text: string }) {
	return (
		<Box
			sx={{
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				p: 4,
			}}
		>
			<Typography color="text.secondary">{text}</Typography>
		</Box>
	);
}

export type { FlowData, SpacerNodeType, TimeLabelNodeType };
