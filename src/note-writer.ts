import { App, TFile, normalizePath } from "obsidian";
import type { Book } from "./types";

export function sanitizeFilename(name: string): string {
	return name
		.replace(/[/\\:*?"<>|]/g, "-")
		.replace(/\s+/g, " ")
		.replace(/^\.+/, "")
		.replace(/\.+$/, "")
		.trim()
		.slice(0, 200);
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
		const folderPath = normalizePath(outputFolder);
		if (!app.vault.getAbstractFileByPath(folderPath)) {
			await app.vault.createFolder(folderPath);
		}
		await app.vault.create(path, content);
	}
}
