import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseBookData } from "./book-parser";

describe("parseBookData", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "kohi-book-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	function sdr(name: string, lua: string): string {
		const p = join(root, name);
		mkdirSync(p, { recursive: true });
		writeFileSync(join(p, "metadata.epub.lua"), lua, "utf-8");
		return p;
	}

	it("extracts book metadata from doc_props and stats", () => {
		const p = sdr(
			"Alice.epub.sdr",
			`return {
			["doc_props"] = {
				["title"] = "Alice's Adventures in Wonderland",
				["authors"] = "Lewis Carroll",
				["language"] = "en",
			},
			["stats"] = {
				["pages"] = 107,
			},
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p);
		expect(r).not.toBeNull();
		expect(r!.book.title).toBe("Alice's Adventures in Wonderland");
		expect(r!.book.author).toBe("Lewis Carroll");
		expect(r!.book.language).toBe("en");
		expect(r!.book.pages).toBe(107);
		expect(r!.book.filePath).toBe(p);
	});

	it("falls back to doc_props.pages when stats missing", () => {
		const p = sdr(
			"test.pdf.sdr",
			`return {
			["doc_props"] = { ["title"] = "T", ["authors"] = "A", ["pages"] = 50 },
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.pages).toBe(50);
	});

	it("custom_props overrides doc_props", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "Original", ["authors"] = "Author A" },
			["custom_props"] = { ["title"] = "Custom" },
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("Custom");
		expect(r.book.author).toBe("Author A");
	});

	it("extracts highlights", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "T", ["authors"] = "A" },
			["annotations"] = {
				[1] = {
					["text"] = "First",
					["note"] = "My note",
					["chapter"] = "Ch1",
					["pageno"] = 10,
					["datetime"] = "2024-01-15 10:30:00",
					["color"] = "yellow",
					["drawer"] = "lighten",
				},
				[2] = {
					["text"] = "Second",
					["chapter"] = "Ch2",
					["pageno"] = 20,
				},
			},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.highlights).toHaveLength(2);
		expect(r.highlights[0]!.text).toBe("First");
		expect(r.highlights[0]!.note).toBe("My note");
		expect(r.highlights[0]!.chapter).toBe("Ch1");
		expect(r.highlights[0]!.page).toBe(10);
		expect(r.highlights[0]!.color).toBe("yellow");
		expect(r.highlights[0]!.drawer).toBe("lighten");
		expect(r.highlights[1]!.text).toBe("Second");
		expect(r.highlights[1]!.color).toBeUndefined();
		expect(r.highlights[1]!.drawer).toBeUndefined();
	});

	it("groups highlights by chapter in appearance order", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "T", ["authors"] = "A" },
			["annotations"] = {
				[1] = { ["text"] = "H1", ["chapter"] = "Ch1" },
				[2] = { ["text"] = "H2", ["chapter"] = "Ch2" },
				[3] = { ["text"] = "H3", ["chapter"] = "Ch1" },
			},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.chapters).toHaveLength(2);
		expect(r.chapters[0]!.name).toBe("Ch1");
		expect(r.chapters[0]!.highlights).toHaveLength(2);
		expect(r.chapters[1]!.name).toBe("Ch2");
		expect(r.chapters[1]!.highlights).toHaveLength(1);
	});

	it("highlights without chapter go to unnamed group", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "T", ["authors"] = "A" },
			["annotations"] = {
				[1] = { ["text"] = "H1" },
				[2] = { ["text"] = "H2", ["chapter"] = "Ch1" },
				[3] = { ["text"] = "H3" },
			},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.chapters).toHaveLength(2);
		expect(r.chapters[0]!.name).toBe("");
		expect(r.chapters[0]!.highlights).toHaveLength(2);
		expect(r.chapters[1]!.name).toBe("Ch1");
	});

	it("empty note → undefined", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "T", ["authors"] = "A" },
			["annotations"] = {
				[1] = { ["text"] = "H1", ["note"] = "" },
			},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.highlights[0]!.note).toBeUndefined();
	});

	it("returns null for nonexistent path", () => {
		expect(parseBookData(join(root, "nope.sdr"))).toBeNull();
	});

	it("returns null for empty .sdr directory", () => {
		const p = join(root, "empty.sdr");
		mkdirSync(p);
		expect(parseBookData(p)).toBeNull();
	});

	it("returns null for invalid Lua", () => {
		const p = sdr("bad.epub.sdr", "not valid lua");
		expect(parseBookData(p)).toBeNull();
	});

	it("defaults to 'Unknown' when title/author missing", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = {},
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("Unknown");
		expect(r.book.author).toBe("Unknown");
	});

	it("falls back to stats.title when doc_props.title missing (PDF without metadata)", () => {
		const p = sdr(
			"Handbook.pdf.sdr",
			`return {
			["doc_props"] = {},
			["stats"] = { ["title"] = "The Startup CTO'S Handbook" },
			["doc_path"] = "/mnt/onboard/Books/The Startup CTO'S Handbook.pdf",
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("The Startup CTO'S Handbook");
	});

	it("falls back to doc_path filename when doc_props and stats both missing title", () => {
		const p = sdr(
			"MyBook.pdf.sdr",
			`return {
			["doc_props"] = {},
			["doc_path"] = "/mnt/onboard/Books/MyBook.pdf",
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("MyBook");
	});

	it("treats empty-string title as missing and falls through", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "", ["authors"] = "" },
			["stats"] = { ["title"] = "From Stats" },
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("From Stats");
		expect(r.book.author).toBe("Unknown");
	});

	it("empty custom_props.title falls through to doc_props.title", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "Doc Title", ["authors"] = "A" },
			["custom_props"] = { ["title"] = "" },
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("Doc Title");
	});

	it("empty custom_props.authors falls through to doc_props.authors", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "T", ["authors"] = "Doc Author" },
			["custom_props"] = { ["authors"] = "" },
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.author).toBe("Doc Author");
	});

	it("doc_path with multiple dots strips only the last extension", () => {
		const p = sdr(
			"test.sdr",
			`return {
			["doc_props"] = {},
			["doc_path"] = "/mnt/onboard/Books/archive.tar.gz",
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("archive.tar");
	});

	it("doc_path without extension uses full filename as title", () => {
		const p = sdr(
			"test.sdr",
			`return {
			["doc_props"] = {},
			["doc_path"] = "/mnt/onboard/Books/README",
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("README");
	});

	it("doc_path of '.' or '..' falls back to Unknown", () => {
		const p = sdr(
			"test.sdr",
			`return {
			["doc_props"] = {},
			["doc_path"] = ".",
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("Unknown");
	});

	it("numeric title in doc_props is preserved as string", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = 0, ["authors"] = false },
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.title).toBe("0");
		expect(r.book.author).toBe("false");
	});

	it("extracts description with raw HTML preserved", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = {
				["title"] = "T",
				["authors"] = "A",
				["description"] = "<div><p>A thrilling story.</p></div>",
			},
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.description).toBe("<div><p>A thrilling story.</p></div>");
	});

	it("extracts series and seriesIndex", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = {
				["title"] = "T",
				["authors"] = "A",
				["series"] = "Murder Maid",
				["series_index"] = 3,
			},
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.series).toBe("Murder Maid");
		expect(r.book.seriesIndex).toBe(3);
	});

	it("omits description/series/seriesIndex when absent", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "T", ["authors"] = "A" },
			["annotations"] = {},
		}`,
		);
		const r = parseBookData(p)!;
		expect(r.book.description).toBeUndefined();
		expect(r.book.series).toBeUndefined();
		expect(r.book.seriesIndex).toBeUndefined();
	});
});
