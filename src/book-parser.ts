import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseLuaTable } from "./lua-parser";
import type { Book, Highlight, ChapterGroup, BookData } from "./types";

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

	const book: Book = {
		title: str(customProps["title"] ?? docProps["title"], "Unknown"),
		author: str(customProps["authors"] ?? docProps["authors"], "Unknown"),
		language: optStr(customProps["language"] ?? docProps["language"]),
		pages: optNum(docProps["pages"]),
		keywords: optStr(customProps["keywords"] ?? docProps["keywords"]),
		filePath: sdrPath,
	};

	const rawAnnotations = raw["annotations"];
	const items: Record<string, unknown>[] = Array.isArray(rawAnnotations)
		? (rawAnnotations as Record<string, unknown>[])
		: [];

	const highlights: Highlight[] = items.map((a) => ({
		text: str(a["text"], ""),
		note: optStr(a["notes"]),
		chapter: optStr(a["chapter"]),
		page: optNum(a["page"]),
		datetime: optStr(a["datetime"]),
		percent: optNum(a["percent"]),
	}));

	return { book, highlights, chapters: groupByChapter(highlights) };
}

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
	if (value === null || value === undefined) return fallback;
	return String(value);
}

function optStr(value: unknown): string | undefined {
	if (value === null || value === undefined || value === "") return undefined;
	return String(value);
}

function optNum(value: unknown): number | undefined {
	if (value === null || value === undefined) return undefined;
	const n = Number(value);
	return isNaN(n) ? undefined : n;
}
