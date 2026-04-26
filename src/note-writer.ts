import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { Book } from "./types";

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
