import { App, TFile, TFolder, normalizePath } from "obsidian";
import * as nunjucks from "nunjucks";
import type { Book } from "./types";

const env = new nunjucks.Environment(null, { autoescape: false });

/**
 * Sanitize a string for use as a filename.
 *
 * Replaces illegal characters (`/\\:*?"<>|`) with `-`, collapses whitespace,
 * strips leading/trailing dots, trims, and truncates to 200 chars.
 * Returns `"Untitled"` if the result is empty.
 */
export function sanitizeFilename(name: string): string {
	return (
		name
			.replace(/[/\\:*?"<>|]/g, "-")
			.replace(/\s+/g, " ")
			.replace(/^\.+/, "")
			.replace(/\.+$/, "")
			.trim()
			.slice(0, 200) || "Untitled"
	);
}

export function renderFilename(template: string, book: Book): string {
	const raw = env.renderString(template, book);
	return sanitizeFilename(raw);
}

/** Recursively create vault folders for a nested path (e.g. `"A/B/C"`). */
async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const normalized = normalizePath(folderPath);
	if (app.vault.getAbstractFileByPath(normalized) instanceof TFolder) return;

	const parts = normalized.split("/");
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(current);
		if (!existing) {
			await app.vault.createFolder(current);
		}
	}
}

/**
 * Write a book's note in the vault.
 *
 * @returns `"written"` if the note was created/updated,
 *          `"skipped"` if it already exists and `overwrite` is false.
 */
export async function writeNote(
	app: App,
	outputFolder: string,
	book: Book,
	content: string,
	filenameTemplate: string,
	overwrite: boolean,
): Promise<"written" | "skipped"> {
	const filename = renderFilename(filenameTemplate, book);
	const path = normalizePath(`${outputFolder}/${filename}.md`);

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		if (!overwrite) return "skipped";
		await app.vault.modify(existing, content);
	} else {
		await ensureFolder(app, outputFolder);
		await app.vault.create(path, content);
	}
	return "written";
}
