import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { scan } from "./scanner";

describe("scan", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "kohi-scan-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	function mkdir(...segments: string[]): void {
		mkdirSync(join(root, ...segments), { recursive: true });
	}

	it("finds .sdr in book folder (default mode)", () => {
		mkdir("Books", "Alice.epub.sdr");
		const r = scan(root);
		expect(r).toHaveLength(1);
		expect(r[0]).toContain("Alice.epub.sdr");
	});

	it("finds .sdr in koreader/docsettings", () => {
		mkdir("koreader", "docsettings", "Alice.epub.sdr");
		const r = scan(root);
		expect(r).toHaveLength(1);
		expect(r[0]).toContain("Alice.epub.sdr");
	});

	it("finds .sdr in koreader/hashdocsettings", () => {
		mkdir("koreader", "hashdocsettings", "abc123.sdr");
		const r = scan(root);
		expect(r).toHaveLength(1);
		expect(r[0]).toContain("abc123.sdr");
	});

	it("finds across all three modes", () => {
		mkdir("koreader", "docsettings", "A.epub.sdr");
		mkdir("koreader", "hashdocsettings", "B.sdr");
		mkdir("Books", "C.epub.sdr");
		expect(scan(root)).toHaveLength(3);
	});

	it("excludes blacklisted directories", () => {
		mkdir(".kobo", "hidden.sdr");
		mkdir(".Trashes", "trash.sdr");
		mkdir(".adds", "koreader", "internal.sdr");
		mkdir("Books", "real.sdr");
		const r = scan(root);
		expect(r).toHaveLength(1);
		expect(r[0]).toContain("real.sdr");
	});

	it("finds nested .sdr", () => {
		mkdir("Books", "Fiction", "Sci-Fi", "Dune.epub.sdr");
		const r = scan(root);
		expect(r).toHaveLength(1);
		expect(r[0]).toContain("Dune.epub.sdr");
	});

	it("returns empty for nonexistent path", () => {
		expect(scan(join(root, "nope"))).toEqual([]);
	});

	it("returns empty when no .sdr found", () => {
		mkdir("Books");
		mkdir("Documents");
		expect(scan(root)).toEqual([]);
	});
});
