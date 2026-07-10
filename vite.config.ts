import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [react()],

	build: {
		rollupOptions: {
			output: {
				// Bucket the big always-loaded vendors so the eager entry chunk
				// stays small and vendor updates don't bust the whole cache.
				// NOTE: no mermaid bucket here - mermaid manages its own dynamic
				// chunks, and forcing it into one manualChunk would merge them
				// all into a single eager 3 MB file.
				manualChunks(id: string) {
					if (!id.includes("node_modules")) return undefined;
					if (/node_modules\/(@mui|@emotion)\//.test(id)) return "mui";
					if (/node_modules\/@xyflow\//.test(id)) return "xyflow";
					return undefined;
				},
			},
		},
		// The remaining over-limit chunks are lazy-loaded views (reagraph/three
		// for the graph view, mermaid diagram definitions) that only download
		// when the feature is used - not initial-load weight.
		chunkSizeWarningLimit: 1400,
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent Vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			// 3. tell Vite to ignore watching `src-tauri`
			ignored: ["**/src-tauri/**"],
		},
	},
}));
