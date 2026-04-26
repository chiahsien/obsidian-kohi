import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "./note-writer";

describe("sanitizeFilename", () => {
	it("replaces illegal characters", () => {
		expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe(
			"a-b-c-d-e-f-g-h-i-j",
		);
	});

	it("collapses whitespace", () => {
		expect(sanitizeFilename("hello   world")).toBe("hello world");
	});

	it("strips leading dots", () => {
		expect(sanitizeFilename("...hidden")).toBe("hidden");
	});

	it("strips trailing dots", () => {
		expect(sanitizeFilename("file...")).toBe("file");
	});

	it("trims", () => {
		expect(sanitizeFilename("  hello  ")).toBe("hello");
	});

	it("truncates to 200 chars", () => {
		expect(sanitizeFilename("a".repeat(250))).toHaveLength(200);
	});

	it("preserves normal filenames", () => {
		expect(sanitizeFilename("Alice's Adventures in Wonderland")).toBe(
			"Alice's Adventures in Wonderland",
		);
	});

	it("handles all-illegal input", () => {
		expect(sanitizeFilename('/:*?"<>|')).toBe("--------");
	});
});
