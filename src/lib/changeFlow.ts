import type { Change, Repo } from "./repoLoader";
import { countTaskCompletion } from "./tasksCompletion";

export type DeltaOp = "added" | "modified" | "removed" | "renamed";
export type LifecycleState = "archived" | "in-progress" | "draft";

export interface FlowDot {
	capability: string;
	ops: Set<DeltaOp>;
	primaryOp: DeltaOp;
	/** 1-indexed position of this dot within its capability lane. */
	lanePosition: number;
	/** Total number of changes touching this capability. */
	laneTotal: number;
	/** Slug of the previous change touching the same capability, if any. */
	previousChangeSlug: string | null;
}

export interface FlowChange {
	key: string;
	slug: string;
	name: string;
	state: LifecycleState;
	progress: number;
	/** Completed task count (only meaningful when a tasks artifact exists). */
	tasksDone: number;
	/** Total task count (0 when no tasks artifact). */
	tasksTotal: number;
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
	tasksDone: number;
	tasksTotal: number;
} {
	const tasks = change.tasks
		? countTaskCompletion(change.tasks)
		: { total: 0, done: 0 };
	if (change.archived) {
		return {
			state: "archived",
			progress: 1,
			tasksDone: tasks.done,
			tasksTotal: tasks.total,
		};
	}
	if (tasks.total === 0 || tasks.done === 0) {
		return {
			state: "draft",
			progress: 0,
			tasksDone: tasks.done,
			tasksTotal: tasks.total,
		};
	}
	return {
		state: "in-progress",
		progress: tasks.done / tasks.total,
		tasksDone: tasks.done,
		tasksTotal: tasks.total,
	};
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
		const { state, progress, tasksDone, tasksTotal } = classifyState(c);
		const dots: FlowDot[] = [];
		for (const [cap, md] of Object.entries(c.specs)) {
			const ops = parseOpsFromSpec(md);
			if (ops.size === 0) ops.add("modified");
			dots.push({
				capability: cap,
				ops,
				primaryOp: primaryOp(ops),
				// Lineage fields filled in after all changes are built.
				lanePosition: 0,
				laneTotal: 0,
				previousChangeSlug: null,
			});
		}
		dots.sort((a, b) => a.capability.localeCompare(b.capability));
		return {
			key: changeKey(c),
			slug: c.slug,
			name: c.name,
			state,
			progress,
			tasksDone,
			tasksTotal,
			createdAt: c.createdAt,
			archivedAt: c.archivedAt,
			dots,
		};
	});

	// Walk changes left-to-right per capability, stamping each dot with its
	// 1-indexed position and the previous slug in that lane.
	const laneCursor = new Map<
		string,
		{ count: number; previousSlug: string | null }
	>();
	const laneTotals = new Map<string, number>();
	for (const c of changes) {
		for (const d of c.dots) {
			laneTotals.set(d.capability, (laneTotals.get(d.capability) ?? 0) + 1);
		}
	}
	for (const c of changes) {
		for (const d of c.dots) {
			const cur = laneCursor.get(d.capability) ?? {
				count: 0,
				previousSlug: null,
			};
			d.lanePosition = cur.count + 1;
			d.previousChangeSlug = cur.previousSlug;
			d.laneTotal = laneTotals.get(d.capability) ?? 1;
			laneCursor.set(d.capability, {
				count: cur.count + 1,
				previousSlug: c.slug,
			});
		}
	}

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
