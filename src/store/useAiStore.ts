import { create } from "zustand";
import {
	type AiModelStatus,
	aiDeleteModel,
	aiDownloadModel,
	aiModelStatus,
} from "../lib/ai";

export interface AiDownloadProgress {
	bytesDone: number;
	bytesTotal: number | null;
}

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
}));
