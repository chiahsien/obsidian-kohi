import { readdirSync, readFileSync } from "fs";
import { basename, join } from "path";
import { parseLuaTable } from "./lua-parser";
import type { Book, Highlight, ChapterGroup, BookData } from "./types";

/**
 * Parse a `.sdr` directory into structured book data.
 *
 * Reads the first `metadata.*.lua` file found, extracts book properties
 * (`custom_props` overrides `doc_props`), and groups highlights by chapter
 * in first-appearance order.
 *
 * @returns Parsed book data, or `null` if the directory is unreadable or
 *          contains no valid metadata.
 */
export function parseBookData(sdrPath: string): BookData | null {
	let metadataFile: string | undefined;
	try {
		const files = readdirSync(sdrPath);
		metadataFile = files.find(
			(f) => f.startsWith("metadata.") && f.endsWith(".lua"),
		);
	} catch {
		return null;
	}
	if (!metadataFile) return null;

	let raw: Record<string, unknown>;
	try {
		const content = readFileSync(join(sdrPath, metadataFile), "utf-8");
		raw = parseLuaTable(content);
	} catch {
		return null;
	}

	const docProps = (raw["doc_props"] as Record<string, unknown>) ?? {};
	const customProps = (raw["custom_props"] as Record<string, unknown>) ?? {};
	const stats = (raw["stats"] as Record<string, unknown>) ?? {};

	const book: Book = {
		title: str(
			present(customProps["title"]) ??
				present(docProps["title"]) ??
				present(stats["title"]) ??
				titleFromDocPath(raw["doc_path"]),
			"Unknown",
		),
		author: str(
			present(customProps["authors"]) ?? present(docProps["authors"]),
			"Unknown",
		),
		language: optStr(customProps["language"] ?? docProps["language"]),
		pages: optNum(stats["pages"] ?? docProps["pages"]),
		keywords: optStr(customProps["keywords"] ?? docProps["keywords"]),
		description: optStr(docProps["description"]),
		series: optStr(customProps["series"] ?? docProps["series"]),
		seriesIndex: optNum(
			customProps["series_index"] ?? docProps["series_index"],
		),
		filePath: sdrPath,
	};

	const rawAnnotations = raw["annotations"];
	const items: Record<string, unknown>[] = Array.isArray(rawAnnotations)
		? (rawAnnotations as Record<string, unknown>[])
		: [];

	const highlights: Highlight[] = items.map((a) => ({
		text: str(a["text"], ""),
		note: optStr(a["note"]),
		chapter: optStr(a["chapter"]),
		page: optNum(a["pageno"]),
		datetime: optStr(a["datetime"]),
		color: optStr(a["color"]),
		drawer: optStr(a["drawer"]),
	}));

	return { book, highlights, chapters: groupByChapter(highlights) };
}

/** Group highlights by chapter name, preserving first-appearance order. */
function groupByChapter(highlights: Highlight[]): ChapterGroup[] {
	const groups: ChapterGroup[] = [];
	const map = new Map<string, ChapterGroup>();

	for (const h of highlights) {
		const name = h.chapter ?? "";
		let group = map.get(name);
		if (!group) {
			group = { name, highlights: [] };
			map.set(name, group);
			groups.push(group);
		}
		group.highlights.push(h);
	}

	return groups;
}

function str(value: unknown, fallback: string): string {
	if (typeof value === "string") return value === "" ? fallback : value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	return fallback;
}

function present(value: unknown): unknown {
	if (value == null || value === "") return undefined;
	return value;
}

function optStr(value: unknown): string | undefined {
	if (typeof value === "string") return value === "" ? undefined : value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	return undefined;
}

function optNum(value: unknown): number | undefined {
	if (value === null || value === undefined) return undefined;
	const n = Number(value);
	return isNaN(n) ? undefined : n;
}

/** Extract a display title from a KOReader `doc_path` (strip directory and extension). */
function titleFromDocPath(value: unknown): string | undefined {
	if (typeof value !== "string" || value === "") return undefined;
	const name = basename(value);
	if (name === "." || name === "..") return undefined;
	const dot = name.lastIndexOf(".");
	const stem = dot > 0 ? name.slice(0, dot) : name;
	return stem === "" ? undefined : stem;
}
