import { create } from "zustand";
import {
	type AiModelStatus,
	aiCancelGenerate,
	aiDeleteModel,
	aiDownloadModel,
	aiGenerate,
	aiModelStatus,
} from "../lib/ai";
import { buildDocSummaryPrompt, docSummaryCacheKey } from "../lib/aiDocSummary";
import { stripThinkBlocks } from "../lib/aiSummary";
import { useAppStore } from "./useAppStore";

export interface AiDownloadProgress {
	bytesDone: number;
	bytesTotal: number | null;
}

export interface DocSummaryInput {
	/** Human document title, e.g. the change or capability name. */
	title: string;
	/** What kind of document this is: "proposal", "tasks", "spec delta", ... */
	kind: string;
	/** Full markdown source of the document being summarized. */
	source: string;
}

/**
 * State of the (single) per-document AI summary. Generation is detached from
 * any component: navigating away or closing the panel does NOT cancel it, so
 * a summary can finish in the background and announce itself via `unseen`.
 */
export interface DocSummaryState {
	/** Whether the right-side summary panel is visible. */
	open: boolean;
	title: string;
	kind: string;
	/** Session cache key (model + source hash) for the current document. */
	docKey: string;
	/** Original markdown source, kept so Regenerate can rebuild the prompt. */
	source: string;
	/** Stripped (think-block-free) summary text: streaming or final. */
	text: string;
	/** True once any raw token arrived - distinguishes "Thinking…" from
	 * "Loading the model…" while `text` is still empty. */
	/** Raw token events received this run - live progress signal. */
	tokens: number;
	generating: boolean;
	error: string | null;
	/** Set when a generation finishes while the panel is closed. */
	unseen: boolean;
}

const EMPTY_DOC_SUMMARY: DocSummaryState = {
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
};

/**
 * Session-level summary cache keyed by model + source hash: re-summarizing an
 * unchanged document reuses the text; any edit or model switch produces a new
 * key. Intentionally not persisted to SQLite.
 */
const docSummaryCache = new Map<string, string>();

/** Test hook: the cache is module state and survives store resets. */
export function clearDocSummaryCache(): void {
	docSummaryCache.clear();
}

/**
 * Monotonic token identifying the latest generation. Callbacks from an older
 * (cancelled/replaced) run compare against it and drop their updates.
 */
let docSummaryGeneration = 0;

/**
 * Transient (not persisted) AI state. Lives outside the settings dialog so a
 * multi-GB download keeps reporting progress even if the dialog is closed and
 * reopened, and so the overview card can share the same model status.
 */
interface AiStoreState {
	/** null until the first ai_model_status fetch resolves. */
	models: AiModelStatus[] | null;
	modelsError: string | null;
	/** Keyed by model id; present only while a download is in flight. */
	downloads: Record<string, AiDownloadProgress>;
	/** Last download/delete error per model id; cleared on retry. */
	downloadErrors: Record<string, string>;
	refreshModels: () => Promise<void>;
	startDownload: (id: string) => void;
	removeModel: (id: string) => Promise<void>;
	docSummary: DocSummaryState;
	/**
	 * Summarizes a document and opens the panel. Cache hit → instant text, no
	 * generation. Model not downloaded → panel opens with the download hint.
	 * Otherwise starts a detached background generation, replacing (and
	 * cancelling) any in-flight one.
	 */
	summarizeDoc: (input: DocSummaryInput) => Promise<void>;
	/** Re-runs generation for the current document, bypassing the cache. */
	regenerateDocSummary: () => Promise<void>;
	/** Best-effort cancel of the in-flight generation (keeps partial text). */
	cancelDocSummary: () => void;
	/** Opens the panel and clears the `unseen` notification flag. */
	openDocSummaryPanel: () => void;
	/** Hides the panel. Does NOT cancel a running generation. */
	closeDocSummaryPanel: () => void;
	/** Dismisses the "summary ready" notification without opening the panel. */
	clearDocSummaryUnseen: () => void;
}

export const useAiStore = create<AiStoreState>()((set, get) => ({
	models: null,
	modelsError: null,
	downloads: {},
	downloadErrors: {},

	refreshModels: async () => {
		try {
			const models = await aiModelStatus();
			set({ models, modelsError: null });
		} catch (e) {
			set({ modelsError: String(e) });
		}
	},

	startDownload: (id) => {
		if (get().downloads[id]) return;
		set((state) => {
			const { [id]: _cleared, ...restErrors } = state.downloadErrors;
			return {
				downloads: {
					...state.downloads,
					[id]: { bytesDone: 0, bytesTotal: null },
				},
				downloadErrors: restErrors,
			};
		});
		void aiDownloadModel(id, (event) => {
			if (event.event !== "progress") return;
			set((state) => ({
				downloads: {
					...state.downloads,
					[id]: { bytesDone: event.bytesDone, bytesTotal: event.bytesTotal },
				},
			}));
		})
			.catch((err) => {
				set((state) => ({
					downloadErrors: { ...state.downloadErrors, [id]: String(err) },
				}));
			})
			.finally(() => {
				set((state) => {
					const { [id]: _done, ...rest } = state.downloads;
					return { downloads: rest };
				});
				void get().refreshModels();
			});
	},

	removeModel: async (id) => {
		try {
			await aiDeleteModel(id);
		} catch (e) {
			set((state) => ({
				downloadErrors: { ...state.downloadErrors, [id]: String(e) },
			}));
		}
		await get().refreshModels();
	},

	docSummary: EMPTY_DOC_SUMMARY,

	summarizeDoc: async (input) => {
		const model = useAppStore.getState().settings.aiModel;
		const docKey = docSummaryCacheKey(model, input.source);
		const cached = docSummaryCache.get(docKey);
		if (cached !== undefined) {
			// Instant open from cache. This replaces whatever was showing, so any
			// in-flight generation is discarded (single doc summary at a time).
			if (get().docSummary.generating) {
				docSummaryGeneration++;
				void aiCancelGenerate();
			}
			set({
				docSummary: {
					...EMPTY_DOC_SUMMARY,
					open: true,
					title: input.title,
					kind: input.kind,
					docKey,
					source: input.source,
					text: cached,
				},
			});
			return;
		}
		// Model readiness gate: fetch statuses on first use, and never attempt
		// generation against a model that isn't downloaded - the panel shows the
		// "download it in Settings → AI" hint instead.
		if (get().models === null) await get().refreshModels();
		const ready =
			get().models?.some((m) => m.id === model && m.downloaded) ?? false;
		if (!ready) {
			set({
				docSummary: {
					...EMPTY_DOC_SUMMARY,
					open: true,
					title: input.title,
					kind: input.kind,
					docKey,
					source: input.source,
				},
			});
			return;
		}
		await startDocGeneration(input, model, docKey, set, get);
	},

	regenerateDocSummary: async () => {
		const { title, kind, source } = get().docSummary;
		if (!source) return;
		const model = useAppStore.getState().settings.aiModel;
		const docKey = docSummaryCacheKey(model, source);
		await startDocGeneration({ title, kind, source }, model, docKey, set, get);
	},

	cancelDocSummary: () => {
		if (!get().docSummary.generating) return;
		void aiCancelGenerate();
		// The stream's `done(cancelled)` event also flips `generating`, but the
		// backend may take a moment - update eagerly so the UI reacts at once.
		set((state) => ({
			docSummary: { ...state.docSummary, generating: false },
		}));
	},

	openDocSummaryPanel: () => {
		set((state) => ({
			docSummary: { ...state.docSummary, open: true, unseen: false },
		}));
	},

	closeDocSummaryPanel: () => {
		set((state) => ({ docSummary: { ...state.docSummary, open: false } }));
	},

	clearDocSummaryUnseen: () => {
		set((state) => ({ docSummary: { ...state.docSummary, unseen: false } }));
	},
}));

/**
 * Kicks off a detached generation: the async work lives on the store module,
 * not in a component effect, so unmounts and navigation never cancel it. The
 * panel opens immediately in the streaming state; if it has been closed by
 * the time the run finishes, `unseen` flips true (→ "summary ready" snackbar).
 */
async function startDocGeneration(
	input: DocSummaryInput,
	model: string,
	docKey: string,
	set: (partial: (state: AiStoreState) => Partial<AiStoreState>) => void,
	get: () => AiStoreState,
): Promise<void> {
	const generation = ++docSummaryGeneration;
	if (get().docSummary.generating) {
		// Replace the previous run. Best-effort: the old channel's late events
		// are dropped via the generation token either way.
		await aiCancelGenerate();
	}
	set(() => ({
		docSummary: {
			...EMPTY_DOC_SUMMARY,
			open: true,
			title: input.title,
			kind: input.kind,
			docKey,
			source: input.source,
			generating: true,
		},
	}));
	let acc = "";
	let reason = "";
	try {
		await aiGenerate(model, buildDocSummaryPrompt(input), (event) => {
			if (generation !== docSummaryGeneration) return;
			if (event.event === "token") {
				acc += event.text;
				const visible = stripThinkBlocks(acc);
				set((state) => ({
					docSummary: {
						...state.docSummary,
						text: visible,
						tokens: state.docSummary.tokens + 1,
					},
				}));
			} else {
				reason = event.reason;
			}
		});
		if (generation !== docSummaryGeneration) return;
		const finalText = stripThinkBlocks(acc).trim();
		if (reason !== "cancelled" && finalText.length > 0) {
			docSummaryCache.set(docKey, finalText);
			set((state) => ({
				docSummary: {
					...state.docSummary,
					text: finalText,
					generating: false,
					unseen: !state.docSummary.open,
				},
			}));
		} else if (reason === "cancelled") {
			set((state) => ({
				docSummary: { ...state.docSummary, generating: false },
			}));
		} else {
			// Finished but nothing visible survived think-stripping: say so
			// instead of silently resetting to the idle state.
			set((state) => ({
				docSummary: {
					...state.docSummary,
					generating: false,
					error: `The model finished (${reason || "eos"}) without a visible answer - thinking models can spend the whole output budget reasoning. Try Regenerate, or pick a different model in Settings → AI.`,
				},
			}));
		}
	} catch (e) {
		if (generation !== docSummaryGeneration) return;
		set((state) => ({
			docSummary: { ...state.docSummary, generating: false, error: String(e) },
		}));
	}
}
