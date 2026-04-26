import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { Book } from "./types";

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
 * Write (or overwrite) a book's note in the vault.
 *
 * Creates the output folder if it doesn't exist. If a note with the same
 * sanitized filename already exists, it is overwritten via `vault.modify`.
 */
export async function writeNote(
	app: App,
	outputFolder: string,
	book: Book,
	content: string,
): Promise<void> {
	const filename = sanitizeFilename(book.title);
	const path = normalizePath(`${outputFolder}/${filename}.md`);

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
	} else {
		await ensureFolder(app, outputFolder);
		await app.vault.create(path, content);
	}
}
