import { describe, it, expect } from "vitest";
import { renderNote, DEFAULT_TEMPLATE } from "./note-generator";
import type { BookData, Book, Highlight, ChapterGroup } from "./types";

function book(overrides?: Partial<Book>): Book {
	return {
		title: "Test Book",
		author: "Test Author",
		filePath: "/test",
		...overrides,
	};
}

function data(opts: {
	book?: Partial<Book>;
	highlights?: Highlight[];
	chapters?: ChapterGroup[];
}): BookData {
	return {
		book: book(opts.book),
		highlights: opts.highlights ?? [],
		chapters: opts.chapters ?? [],
	};
}

describe("renderNote", () => {
	describe("default template", () => {
		it("renders frontmatter", () => {
			const d = data({
				book: { title: "Alice", author: "Carroll", language: "en", pages: 107 },
			});
			const r = renderNote(d, DEFAULT_TEMPLATE, "2024-01-15");
			expect(r).toContain('title: "Alice"');
			expect(r).toContain('author: "Carroll"');
			expect(r).toContain("language: en");
			expect(r).toContain("pages: 107");
			expect(r).toContain("imported: 2024-01-15");
		});

		it("omits optional fields when missing", () => {
			const d = data({ book: { title: "T", author: "A" } });
			const r = renderNote(d, DEFAULT_TEMPLATE, "2024-01-15");
			expect(r).not.toContain("language:");
			expect(r).not.toContain("pages:");
		});

		it("renders chapter headings and highlights", () => {
			const d = data({
				chapters: [
					{
						name: "Chapter 1",
						highlights: [
							{ text: "First highlight" },
							{ text: "Second", note: "my note" },
						],
					},
				],
			});
			const r = renderNote(d, DEFAULT_TEMPLATE, "2024-01-15");
			expect(r).toContain("## Chapter 1");
			expect(r).toContain("> First highlight");
			expect(r).toContain("> Second");
			expect(r).toContain("**Note:** my note");
		});

		it("skips chapter heading for unnamed group", () => {
			const d = data({
				chapters: [
					{ name: "", highlights: [{ text: "H1" }] },
				],
			});
			const r = renderNote(d, DEFAULT_TEMPLATE, "2024-01-15");
			expect(r).toContain("> H1");
			expect(r).not.toContain("## ");
		});
	});

	describe("custom template", () => {
		it("renders flat highlight list", () => {
			const d = data({
				highlights: [{ text: "H1" }, { text: "H2" }],
			});
			const tmpl = "{% for h in highlights %}* {{ h.text }}\n{% endfor %}";
			const r = renderNote(d, tmpl, "2024-01-15");
			expect(r).toContain("* H1");
			expect(r).toContain("* H2");
		});

		it("accesses book-level variables", () => {
			const d = data({
				book: { title: "My Book", author: "Me", keywords: "sci-fi" },
			});
			const tmpl = "{{ title }} by {{ author }} [{{ keywords }}]";
			const r = renderNote(d, tmpl, "2024-01-15");
			expect(r).toBe("My Book by Me [sci-fi]\n");
		});
	});

	describe("percent filter", () => {
		it("formats decimal as percentage", () => {
			const d = data({
				highlights: [{ text: "H", percent: 0.074 }],
			});
			const tmpl = "{% for h in highlights %}{{ h.percent | percent }}{% endfor %}";
			expect(renderNote(d, tmpl, "")).toContain("7.4%");
		});

		it("handles null/undefined", () => {
			const d = data({ highlights: [{ text: "H" }] });
			const tmpl = "{% for h in highlights %}[{{ h.percent | percent }}]{% endfor %}";
			expect(renderNote(d, tmpl, "")).toContain("[]");
		});
	});

	it("collapses excessive blank lines", () => {
		const d = data({});
		expect(renderNote(d, "a\n\n\n\n\nb", "")).toBe("a\n\nb\n");
	});
});
