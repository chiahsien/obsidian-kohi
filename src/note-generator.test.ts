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
			expect(r).not.toContain("series:");
			expect(r).not.toContain("series_index:");
		});

		it("renders series in frontmatter when present", () => {
			const d = data({
				book: { title: "T", author: "A", series: "Murder Maid", seriesIndex: 3 },
			});
			const r = renderNote(d, DEFAULT_TEMPLATE, "2024-01-15");
			expect(r).toContain('series: "Murder Maid"');
			expect(r).toContain("series_index: 3");
		});

		it("renders seriesIndex and pages when value is 0", () => {
			const d = data({
				book: { title: "T", author: "A", seriesIndex: 0, pages: 0 },
			});
			const r = renderNote(d, DEFAULT_TEMPLATE, "2024-01-15");
			expect(r).toContain("series_index: 0");
			expect(r).toContain("pages: 0");
		});

		it("renders description after frontmatter with separator", () => {
			const d = data({
				book: { title: "T", author: "A", description: "<p>A thrilling story.</p>" },
			});
			const r = renderNote(d, DEFAULT_TEMPLATE, "2024-01-15");
			expect(r).toContain("---\n\n<p>A thrilling story.</p>\n\n---");
		});

		it("omits description block when absent", () => {
			const d = data({ book: { title: "T", author: "A" } });
			const r = renderNote(d, DEFAULT_TEMPLATE, "2024-01-15");
			const afterFrontmatter = r.split("---\n").slice(2).join("---\n");
			expect(afterFrontmatter).not.toContain("undefined");
			expect(afterFrontmatter).not.toContain("null");
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
			expect(r).toContain("> [!note]\n> my note");
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

	it("collapses excessive blank lines", () => {
		const d = data({});
		expect(renderNote(d, "a\n\n\n\n\nb", "")).toBe("a\n\nb\n");
	});

	describe("default template output quality", () => {
		it("produces clean output with full data", () => {
			const d = data({
				book: {
					title: "Thinking, Fast and Slow",
					author: "Daniel Kahneman",
					language: "en",
					pages: 499,
					keywords: "psychology",
				},
				chapters: [
					{
						name: "Part I: Two Systems",
						highlights: [
							{
								text: "A reliable way to make people believe in falsehoods is frequent repetition.",
								note: "Availability heuristic",
								chapter: "Part I: Two Systems",
								page: 62,
								datetime: "2024-03-15 10:30:00",
							},
							{
								text: "Nothing in life is as important as you think it is.",
								chapter: "Part I: Two Systems",
								page: 71,
							},
						],
					},
					{
						name: "Part II: Heuristics and Biases",
						highlights: [
							{
								text: "We are pattern seekers.",
								chapter: "Part II: Heuristics and Biases",
								page: 115,
							},
						],
					},
				],
				highlights: [],
			});

			const result = renderNote(d, DEFAULT_TEMPLATE, "2024-06-01");

			// frontmatter is clean
			expect(result).toMatch(/^---\n/);
			expect(result).toMatch(/\n---\n/);
			expect(result).toContain('title: "Thinking, Fast and Slow"');
			expect(result).toContain('author: "Daniel Kahneman"');
			expect(result).toContain("language: en");
			expect(result).toContain("pages: 499");
			expect(result).toContain("imported: 2024-06-01");

			// chapter headings present
			expect(result).toContain("## Part I: Two Systems");
			expect(result).toContain("## Part II: Heuristics and Biases");

			// highlights as blockquotes
			expect(result).toContain(
				"> A reliable way to make people believe in falsehoods is frequent repetition.",
			);
			expect(result).toContain("> [!note]\n> Availability heuristic");
			expect(result).toContain(
				"> Nothing in life is as important as you think it is.",
			);
			expect(result).toContain("> We are pattern seekers.");

			// no triple+ blank lines
			expect(result).not.toMatch(/\n{3,}/);

			// ends with single newline
			expect(result).toMatch(/[^\n]\n$/);
		});

		it("handles book with no chapters gracefully", () => {
			const d = data({
				chapters: [
					{
						name: "",
						highlights: [{ text: "Standalone highlight" }],
					},
				],
			});
			const result = renderNote(d, DEFAULT_TEMPLATE, "2024-01-01");
			expect(result).toContain("> Standalone highlight");
			expect(result).not.toContain("## ");
			expect(result).not.toMatch(/\n{3,}/);
		});
	});
});
