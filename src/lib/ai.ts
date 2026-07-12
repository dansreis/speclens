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

export function isKnownAiModelId(id: unknown): id is string {
	return typeof id === "string" && AI_MODELS.some((m) => m.id === id);
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
