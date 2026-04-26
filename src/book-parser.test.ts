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

	it("extracts book metadata from doc_props", () => {
		const p = sdr(
			"Alice.epub.sdr",
			`return {
			["doc_props"] = {
				["title"] = "Alice's Adventures in Wonderland",
				["authors"] = "Lewis Carroll",
				["language"] = "en",
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
					["notes"] = "My note",
					["chapter"] = "Ch1",
					["page"] = 10,
					["datetime"] = "2024-01-15 10:30:00",
					["percent"] = 0.05,
				},
				[2] = {
					["text"] = "Second",
					["chapter"] = "Ch2",
					["page"] = 20,
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
		expect(r.highlights[0]!.percent).toBe(0.05);
		expect(r.highlights[1]!.text).toBe("Second");
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

	it("empty notes → undefined", () => {
		const p = sdr(
			"test.epub.sdr",
			`return {
			["doc_props"] = { ["title"] = "T", ["authors"] = "A" },
			["annotations"] = {
				[1] = { ["text"] = "H1", ["notes"] = "" },
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
