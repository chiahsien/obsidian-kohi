import { describe, it, expect } from "vitest";
import { sanitizeFilename, renderFilename } from "./note-writer";
import type { Book } from "./types";

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

	it("returns Untitled for empty string", () => {
		expect(sanitizeFilename("")).toBe("Untitled");
	});

	it("returns Untitled for all dots", () => {
		expect(sanitizeFilename("...")).toBe("Untitled");
	});

	it("returns Untitled for all whitespace", () => {
		expect(sanitizeFilename("   ")).toBe("Untitled");
	});
});

function book(overrides: Partial<Book> = {}): Book {
	return {
		title: "Alice's Adventures",
		author: "Lewis Carroll",
		filePath: "/tmp/test.sdr",
		...overrides,
	};
}

describe("renderFilename", () => {
	it("renders title-only template", () => {
		expect(renderFilename("{{title}}", book())).toBe(
			"Alice's Adventures",
		);
	});

	it("renders author-title template", () => {
		expect(renderFilename("{{author}} - {{title}}", book())).toBe(
			"Lewis Carroll - Alice's Adventures",
		);
	});

	it("sanitizes rendered result", () => {
		expect(
			renderFilename("{{title}}", book({ title: 'A/B: "C"' })),
		).toBe("A-B- -C-");
	});

	it("falls back to Untitled when template renders empty", () => {
		expect(renderFilename("{{series}}", book())).toBe("Untitled");
	});

	it("handles series and seriesIndex", () => {
		expect(
			renderFilename(
				"{{series}} {{seriesIndex}} - {{title}}",
				book({ series: "Wonderland", seriesIndex: 1 }),
			),
		).toBe("Wonderland 1 - Alice's Adventures");
	});
});
