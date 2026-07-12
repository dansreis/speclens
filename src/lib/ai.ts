import { Channel, invoke } from "@tauri-apps/api/core";

/**
 * Typed wrappers over the Rust `ai_*` commands (src-tauri/src/ai.rs).
 * Everything is opt-in: nothing here runs until a wrapper is called.
 */

// ───── model registry (mirror of MODELS in src-tauri/src/ai.rs) ─────

export interface AiModelInfo {
	/** Stable id; must match the Rust registry exactly. */
	id: string;
	displayName: string;
	/** Approximate download size in bytes (decimal, from Hugging Face). */
	sizeBytes: number;
	/** One-line character description shown in the model picker. */
	description: string;
}

/** Keep ids/sizes in sync with `MODELS` in src-tauri/src/ai.rs. */
export const AI_MODELS: readonly AiModelInfo[] = [
	{
		id: "gemma-4-e2b-it",
		displayName: "Gemma 4 E2B Instruct (Q4_K_M)",
		sizeBytes: 3_110_000_000,
		description: "Balanced all-rounder - the default",
	},
	{
		id: "qwen3.5-4b",
		displayName: "Qwen3.5 4B Instruct (Q4_K_M)",
		sizeBytes: 2_740_000_000,
		description: "Follows structured instructions closely",
	},
	{
		id: "gemma-4-e4b-it",
		displayName: "Gemma 4 E4B Instruct (Q4_K_M)",
		sizeBytes: 4_977_169_568,
		description: "Best quality prose; needs the most memory",
	},
	{
		id: "phi-4-mini",
		displayName: "Phi-4 Mini Instruct (Q4_K_M)",
		sizeBytes: 2_491_874_272,
		description: "Structured-output specialist",
	},
	{
		id: "smollm3-3b",
		displayName: "SmolLM3 3B (Q4_K_M)",
		sizeBytes: 1_915_306_528,
		description: "Smallest and fastest",
	},
];

/** Mirror of DEFAULT_MODEL_ID in src-tauri/src/ai.rs. */
export const DEFAULT_AI_MODEL_ID = "gemma-4-e2b-it";

/** Prefix marking a model served by a local Ollama instance
 * (`ollama:<name>`). Mirrors OLLAMA_ID_PREFIX in src-tauri/src/ai.rs. */
export const OLLAMA_ID_PREFIX = "ollama:";

/**
 * Whether `id` can safely be persisted as the selected model. Accepts any
 * registry id, custom (imported) model id, or Ollama id.
 *
 * Custom ids are file stems, so the hard rules are non-empty, bounded length,
 * and no path separators (mirrors `is_safe_model_id` in src-tauri/src/ai.rs).
 * Ollama ids (`ollama:<name>`) never touch the filesystem - names may contain
 * `/` and `:` (e.g. `ollama:hf.co/user/model:tag`), so only non-empty name
 * and bounded length apply.
 */
export function isValidAiModelId(id: unknown): id is string {
	if (typeof id !== "string" || id.length === 0 || id.length > 200) {
		return false;
	}
	if (id.startsWith(OLLAMA_ID_PREFIX)) {
		return id.length > OLLAMA_ID_PREFIX.length;
	}
	return id.length <= 128 && !id.includes("/") && !id.includes("\\");
}

export function aiModelInfo(id: string): AiModelInfo | null {
	return AI_MODELS.find((m) => m.id === id) ?? null;
}

// ───── wire types (match the serde shapes in ai.rs) ─────

export interface AiModelStatus {
	id: string;
	displayName: string;
	/** Approximate full size from the registry, for UI before download. */
	sizeBytes: number;
	isDefault: boolean;
	downloaded: boolean;
	/** Actual on-disk size when downloaded. */
	downloadedBytes: number | null;
	/** Size of a leftover `.part` file from an interrupted download, if any. */
	partialBytes: number | null;
	/** True for user-imported models found in the models dir (their id is the
	 * file stem and they are downloaded by definition). */
	custom?: boolean;
	/** True for models served by a local Ollama instance (`ollama:<name>` ids).
	 * Managed by Ollama - SpecLens never downloads or deletes them. */
	ollama?: boolean;
}

export type AiDownloadEvent =
	| { event: "progress"; bytesDone: number; bytesTotal: number | null }
	| { event: "done"; path: string };

export type AiGenerateEvent =
	| { event: "token"; text: string }
	| { event: "done"; reason: "eos" | "length" | "cancelled"; tokens: number };

// ───── commands ─────

export async function aiModelStatus(): Promise<AiModelStatus[]> {
	return await invoke<AiModelStatus[]>("ai_model_status");
}

/** Ensures the models folder exists and reveals it in the OS file manager
 * (Finder on macOS). It doubles as the drop-in folder for GGUF files. */
export async function aiRevealModelsDir(): Promise<void> {
	await invoke("ai_reveal_models_dir");
}

/**
 * Downloads a model, streaming progress events. Resolves when the file is
 * fully downloaded and verified; rejects with a string error otherwise.
 */
export async function aiDownloadModel(
	id: string,
	onEvent: (event: AiDownloadEvent) => void,
): Promise<void> {
	const channel = new Channel<AiDownloadEvent>();
	channel.onmessage = onEvent;
	await invoke("ai_download_model", { id, channel });
}

export async function aiDeleteModel(id: string): Promise<void> {
	await invoke("ai_delete_model", { id });
}

/**
 * Copies a local `.gguf` file into the app's models dir and returns the new
 * model id (the file stem). Rejects if a model file with that name already
 * exists - delete it first or rename the source file.
 */
export async function aiImportModel(sourcePath: string): Promise<string> {
	return await invoke<string>("ai_import_model", { sourcePath });
}

/**
 * Streams generated tokens for `prompt`. Resolves after the final `done`
 * event; rejects with a string error (model missing, busy, no local-llm
 * feature, ...).
 */
export async function aiGenerate(
	modelId: string,
	prompt: string,
	onEvent: (event: AiGenerateEvent) => void,
): Promise<void> {
	const channel = new Channel<AiGenerateEvent>();
	channel.onmessage = onEvent;
	// Thinking-model handling (e.g. Qwen's <think> blocks) lives in Rust: the
	// engine prefills a closed think block per the model registry.
	await invoke("ai_generate", { modelId, prompt, channel });
}

/** Best-effort cancellation of the in-flight generation. */
export async function aiCancelGenerate(): Promise<void> {
	await invoke("ai_cancel_generate");
}
