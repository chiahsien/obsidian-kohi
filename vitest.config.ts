import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
	resolve: {
		alias: {
			obsidian: fileURLToPath(
				new URL("./src/__mocks__/obsidian.ts", import.meta.url),
			),
		},
	},
});
