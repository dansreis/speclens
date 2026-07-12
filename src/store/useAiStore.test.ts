import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiGenerateEvent } from "../lib/ai";

const mocks = vi.hoisted(() => ({
	aiGenerate: vi.fn(),
	aiCancelGenerate: vi.fn(async () => {}),
	aiModelStatus: vi.fn(),
	aiDeleteModel: vi.fn(async () => {}),
	aiDownloadModel: vi.fn(async () => {}),
}));

vi.mock("../lib/ai", () => mocks);
vi.mock("./useAppStore", () => ({
	useAppStore: {
		getState: () => ({ settings: { aiModel: "test-model" } }),
	},
}));

import { clearDocSummaryCache, useAiStore } from "./useAiStore";

interface GenerateRun {
	emit: (event: AiGenerateEvent) => void;
	finish: () => void;
	fail: (error: unknown) => void;
}

/** Every aiGenerate call becomes a controllable run pushed onto this list. */
let runs: GenerateRun[];

function modelStatus(downloaded: boolean) {
	return [
		{
			id: "test-model",
			displayName: "Test model",
			sizeBytes: 1,
			isDefault: true,
			downloaded,
			downloadedBytes: downloaded ? 1 : null,
			partialBytes: null,
		},
	];
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const docSummary = () => useAiStore.getState().docSummary;

beforeEach(() => {
	vi.clearAllMocks();
	clearDocSummaryCache();
	useAiStore.setState({
		models: null,
		modelsError: null,
		downloads: {},
		downloadErrors: {},
		docSummary: {
			open: false,
			title: "",
			kind: "",
			docKey: "",
			source: "",
			text: "",
			tokens: 0,
			generating: false,
			error: null,
			unseen: false,
		},
	});
	mocks.aiModelStatus.mockResolvedValue(modelStatus(true));
	runs = [];
	mocks.aiGenerate.mockImplementation(
		(_model: string, _prompt: string, onEvent: (e: AiGenerateEvent) => void) =>
			new Promise<void>((resolve, reject) => {
				runs.push({
					emit: onEvent,
					finish: () => resolve(),
					fail: reject,
				});
			}),
	);
});

describe("summarizeDoc", () => {
	it("opens the panel, streams stripped tokens, and stores the final text", async () => {
		const promise = useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "proposal", source: "body" });
		await flush();

		expect(mocks.aiGenerate).toHaveBeenCalledTimes(1);
		expect(docSummary().open).toBe(true);
		expect(docSummary().generating).toBe(true);
		expect(docSummary().tokens).toBe(0);

		// A pure <think> prefix streams as no visible text but marks tokens seen.
		runs[0].emit({ event: "token", text: "<think>reasoning</think>" });
		expect(docSummary().text).toBe("");
		expect(docSummary().tokens).toBeGreaterThan(0);

		runs[0].emit({ event: "token", text: "Summary " });
		runs[0].emit({ event: "token", text: "text" });
		expect(docSummary().text).toBe("Summary text");

		runs[0].emit({ event: "done", reason: "eos", tokens: 3 });
		runs[0].finish();
		await promise;

		expect(docSummary().generating).toBe(false);
		expect(docSummary().text).toBe("Summary text");
		expect(docSummary().error).toBeNull();
		// Panel was open the whole time, so no "ready" notification.
		expect(docSummary().unseen).toBe(false);
	});

	it("serves a cached summary instantly without regenerating", async () => {
		const first = useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "proposal", source: "body" });
		await flush();
		runs[0].emit({ event: "token", text: "Cached result" });
		runs[0].emit({ event: "done", reason: "eos", tokens: 2 });
		runs[0].finish();
		await first;

		useAiStore.getState().closeDocSummaryPanel();
		await useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "proposal", source: "body" });

		expect(mocks.aiGenerate).toHaveBeenCalledTimes(1);
		expect(docSummary().open).toBe(true);
		expect(docSummary().generating).toBe(false);
		expect(docSummary().text).toBe("Cached result");
	});

	it("opens the panel without generating when the model is not downloaded", async () => {
		mocks.aiModelStatus.mockResolvedValue(modelStatus(false));
		await useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "spec", source: "body" });

		expect(mocks.aiGenerate).not.toHaveBeenCalled();
		expect(docSummary().open).toBe(true);
		expect(docSummary().generating).toBe(false);
		expect(docSummary().text).toBe("");
	});

	it("flags unseen when generation finishes while the panel is closed", async () => {
		const promise = useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "tasks", source: "body" });
		await flush();

		useAiStore.getState().closeDocSummaryPanel();
		runs[0].emit({ event: "token", text: "Done in background" });
		runs[0].emit({ event: "done", reason: "eos", tokens: 3 });
		runs[0].finish();
		await promise;

		expect(docSummary().open).toBe(false);
		expect(docSummary().unseen).toBe(true);
		expect(docSummary().text).toBe("Done in background");

		useAiStore.getState().openDocSummaryPanel();
		expect(docSummary().open).toBe(true);
		expect(docSummary().unseen).toBe(false);
	});

	it("replaces an in-flight generation and drops its late events", async () => {
		const first = useAiStore
			.getState()
			.summarizeDoc({ title: "One", kind: "proposal", source: "one" });
		await flush();

		const second = useAiStore
			.getState()
			.summarizeDoc({ title: "Two", kind: "proposal", source: "two" });
		await flush();

		expect(mocks.aiCancelGenerate).toHaveBeenCalled();
		expect(runs).toHaveLength(2);
		expect(docSummary().title).toBe("Two");

		// The stale run's events must not leak into the new summary.
		runs[0].emit({ event: "token", text: "stale" });
		runs[0].emit({ event: "done", reason: "cancelled", tokens: 1 });
		runs[0].finish();
		await first;
		expect(docSummary().text).toBe("");
		expect(docSummary().generating).toBe(true);

		runs[1].emit({ event: "token", text: "fresh" });
		runs[1].emit({ event: "done", reason: "eos", tokens: 1 });
		runs[1].finish();
		await second;
		expect(docSummary().text).toBe("fresh");
		expect(docSummary().generating).toBe(false);
	});

	it("does not cache or notify a cancelled generation", async () => {
		const promise = useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "design", source: "body" });
		await flush();

		useAiStore.getState().closeDocSummaryPanel();
		useAiStore.getState().cancelDocSummary();
		expect(mocks.aiCancelGenerate).toHaveBeenCalledTimes(1);
		expect(docSummary().generating).toBe(false);

		runs[0].emit({ event: "token", text: "partial" });
		runs[0].emit({ event: "done", reason: "cancelled", tokens: 1 });
		runs[0].finish();
		await promise;
		expect(docSummary().unseen).toBe(false);

		// Not cached: summarizing the same source generates again.
		void useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "design", source: "body" });
		await flush();
		expect(mocks.aiGenerate).toHaveBeenCalledTimes(2);
	});

	it("surfaces generation failures as an error", async () => {
		const promise = useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "proposal", source: "body" });
		await flush();

		runs[0].fail("model exploded");
		await promise;
		expect(docSummary().generating).toBe(false);
		expect(docSummary().error).toBe("model exploded");
		expect(docSummary().unseen).toBe(false);
	});
});

describe("regenerateDocSummary", () => {
	it("bypasses the cache and overwrites it on success", async () => {
		const first = useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "proposal", source: "body" });
		await flush();
		runs[0].emit({ event: "token", text: "v1" });
		runs[0].emit({ event: "done", reason: "eos", tokens: 1 });
		runs[0].finish();
		await first;

		const second = useAiStore.getState().regenerateDocSummary();
		await flush();
		expect(mocks.aiGenerate).toHaveBeenCalledTimes(2);
		runs[1].emit({ event: "token", text: "v2" });
		runs[1].emit({ event: "done", reason: "eos", tokens: 1 });
		runs[1].finish();
		await second;
		expect(docSummary().text).toBe("v2");

		// Cache now holds v2.
		await useAiStore
			.getState()
			.summarizeDoc({ title: "Doc", kind: "proposal", source: "body" });
		expect(mocks.aiGenerate).toHaveBeenCalledTimes(2);
		expect(docSummary().text).toBe("v2");
	});
});
