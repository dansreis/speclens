import type { Change, Repo } from "./exampleLoader";
import { countTaskCompletion } from "./tasksCompletion";

export type DeltaOp = "added" | "modified" | "removed" | "renamed";
export type LifecycleState = "archived" | "in-progress" | "draft";

export interface FlowDot {
	capability: string;
	ops: Set<DeltaOp>;
	primaryOp: DeltaOp;
}

export interface FlowChange {
	key: string;
	slug: string;
	name: string;
	state: LifecycleState;
	progress: number;
	createdAt: Date | null;
	archivedAt: Date | null;
	dots: FlowDot[];
}

export interface FlowLane {
	capability: string;
	firstIdx: number;
	lastIdx: number;
}

export interface FlowData {
	changes: FlowChange[];
	lanes: FlowLane[];
}

const HEADING_RE = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\b/gim;

const PRIORITY: Record<DeltaOp, number> = {
	removed: 4,
	renamed: 3,
	added: 2,
	modified: 1,
};

function parseOpsFromSpec(md: string): Set<DeltaOp> {
	const ops = new Set<DeltaOp>();
	for (const m of md.matchAll(HEADING_RE)) {
		ops.add(m[1].toLowerCase() as DeltaOp);
	}
	return ops;
}

function primaryOp(ops: Set<DeltaOp>): DeltaOp {
	let best: DeltaOp = "modified";
	let bestP = 0;
	for (const op of ops) {
		const p = PRIORITY[op];
		if (p > bestP) {
			best = op;
			bestP = p;
		}
	}
	return best;
}

function classifyState(change: Change): {
	state: LifecycleState;
	progress: number;
} {
	if (change.archived) return { state: "archived", progress: 1 };
	const tasks = change.tasks
		? countTaskCompletion(change.tasks)
		: { total: 0, done: 0 };
	if (tasks.total === 0 || tasks.done === 0) {
		return { state: "draft", progress: 0 };
	}
	return { state: "in-progress", progress: tasks.done / tasks.total };
}

function changeKey(c: Change): string {
	return `${c.archived ? "archive/" : ""}${c.slug}`;
}

function timestampFor(c: Change): number {
	if (c.archived) {
		return (
			c.archivedAt?.getTime() ??
			c.createdAt?.getTime() ??
			Number.MAX_SAFE_INTEGER
		);
	}
	return c.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function compareChanges(a: Change, b: Change): number {
	// Archived first (oldest-archived → leftmost), then active (oldest-created → leftmost).
	const aArch = a.archived ? 0 : 1;
	const bArch = b.archived ? 0 : 1;
	if (aArch !== bArch) return aArch - bArch;
	const aT = timestampFor(a);
	const bT = timestampFor(b);
	if (aT !== bT) return aT - bT;
	return a.slug.localeCompare(b.slug);
}

export function buildFlow(repo: Repo): FlowData {
	const sorted = [...repo.changes].sort(compareChanges);

	const changes: FlowChange[] = sorted.map((c) => {
		const { state, progress } = classifyState(c);
		const dots: FlowDot[] = [];
		for (const [cap, md] of Object.entries(c.specs)) {
			const ops = parseOpsFromSpec(md);
			if (ops.size === 0) ops.add("modified");
			dots.push({ capability: cap, ops, primaryOp: primaryOp(ops) });
		}
		dots.sort((a, b) => a.capability.localeCompare(b.capability));
		return {
			key: changeKey(c),
			slug: c.slug,
			name: c.name,
			state,
			progress,
			createdAt: c.createdAt,
			archivedAt: c.archivedAt,
			dots,
		};
	});

	const lanesMap = new Map<string, { firstIdx: number; lastIdx: number }>();
	changes.forEach((c, idx) => {
		for (const d of c.dots) {
			const existing = lanesMap.get(d.capability);
			if (!existing) {
				lanesMap.set(d.capability, { firstIdx: idx, lastIdx: idx });
			} else {
				existing.lastIdx = idx;
			}
		}
	});

	const lanes: FlowLane[] = [...lanesMap.entries()]
		.map(([capability, { firstIdx, lastIdx }]) => ({
			capability,
			firstIdx,
			lastIdx,
		}))
		.sort((a, b) => {
			if (a.firstIdx !== b.firstIdx) return a.firstIdx - b.firstIdx;
			return a.capability.localeCompare(b.capability);
		});

	return { changes, lanes };
}
