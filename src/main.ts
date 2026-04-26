import { Notice, Plugin } from "obsidian";
import { basename } from "path";
import type { BookData, PluginSettings } from "./types";
import { DEFAULT_SETTINGS, KohiSettingTab } from "./settings";
import { scan } from "./scanner";
import { parseBookData } from "./book-parser";
import { renderNote } from "./note-generator";
import { writeNote } from "./note-writer";
import { openBookSelectModal } from "./multi-select-modal";

export default class KohiPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "import-all",
			name: "Import all highlights",
			callback: () => this.importAll(),
		});

		this.addCommand({
			id: "import-selected",
			name: "Import selected highlights",
			callback: () => this.importSelected(),
		});

		this.addSettingTab(new KohiSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private scanAndParse(): {
		books: BookData[];
		failures: string[];
	} | null {
		if (!this.settings.mountPath) {
			new Notice("KOHi: Mount path not configured");
			return null;
		}

		const sdrPaths = scan(this.settings.mountPath);
		if (sdrPaths.length === 0) {
			new Notice("KOHi: No .sdr directories found");
			return null;
		}

		const books: BookData[] = [];
		const failures: string[] = [];

		for (const sdrPath of sdrPaths) {
			const bookData = parseBookData(sdrPath);
			if (!bookData) {
				failures.push(`${basename(sdrPath)} (parse error)`);
				continue;
			}
			if (bookData.highlights.length === 0) continue;
			books.push(bookData);
		}

		return { books, failures };
	}

	private async writeBooks(
		books: BookData[],
		parseFailures: string[],
	): Promise<void> {
		const importDate = new Date().toISOString().slice(0, 10);
		let success = 0;
		const failures = [...parseFailures];

		for (const bookData of books) {
			try {
				const content = renderNote(
					bookData,
					this.settings.noteTemplate,
					importDate,
				);
				await writeNote(
					this.app,
					this.settings.outputFolder,
					bookData.book,
					content,
				);
				success++;
			} catch {
				failures.push(`${bookData.book.title} (write error)`);
			}
		}

		if (failures.length === 0) {
			new Notice(
				`KOHi: Imported ${success} book${success !== 1 ? "s" : ""} successfully`,
			);
		} else if (success > 0) {
			new Notice(
				`KOHi: Imported ${success} book${success !== 1 ? "s" : ""}. ${failures.length} failed:\n${failures.join("\n")}`,
			);
		} else {
			new Notice(`KOHi: Import failed:\n${failures.join("\n")}`);
		}
	}

	async importAll(): Promise<void> {
		const result = this.scanAndParse();
		if (!result) return;
		await this.writeBooks(result.books, result.failures);
	}

	async importSelected(): Promise<void> {
		const result = this.scanAndParse();
		if (!result) return;

		if (result.books.length === 0) {
			new Notice("KOHi: No books with highlights found");
			return;
		}

		const selected = await openBookSelectModal(this.app, result.books);
		if (selected.length === 0) return;

		await this.writeBooks(selected, []);
	}
}
