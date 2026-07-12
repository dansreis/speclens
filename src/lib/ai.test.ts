import { describe, expect, it } from "vitest";
import { isValidAiModelId, OLLAMA_ID_PREFIX } from "./ai";

describe("isValidAiModelId", () => {
	it("accepts registry ids and custom (file-stem) ids", () => {
		expect(isValidAiModelId("gemma-4-e2b-it")).toBe(true);
		expect(isValidAiModelId("qwen3.5-4b")).toBe(true);
		expect(isValidAiModelId("My-Model.Q4_K_M")).toBe(true);
	});

	it("rejects non-strings, empties, and overlong ids", () => {
		expect(isValidAiModelId(undefined)).toBe(false);
		expect(isValidAiModelId(null)).toBe(false);
		expect(isValidAiModelId(42)).toBe(false);
		expect(isValidAiModelId("")).toBe(false);
		expect(isValidAiModelId("x".repeat(129))).toBe(false);
	});

	it("rejects path separators in non-ollama ids (they become file stems)", () => {
		expect(isValidAiModelId("a/b")).toBe(false);
		expect(isValidAiModelId("a\\b")).toBe(false);
		expect(isValidAiModelId("../evil")).toBe(false);
	});

	it("accepts ollama ids, whose names may contain '/' and ':'", () => {
		expect(isValidAiModelId("ollama:llama3.2:3b")).toBe(true);
		expect(isValidAiModelId("ollama:hf.co/user/model:tag")).toBe(true);
		expect(isValidAiModelId("ollama:gemma3")).toBe(true);
	});

	it("still bounds ollama ids: non-empty name, length <= 200", () => {
		expect(isValidAiModelId(OLLAMA_ID_PREFIX)).toBe(false);
		expect(isValidAiModelId(`${OLLAMA_ID_PREFIX}${"x".repeat(193)}`)).toBe(
			true,
		);
		expect(isValidAiModelId(`${OLLAMA_ID_PREFIX}${"x".repeat(194)}`)).toBe(
			false,
		);
	});
});
