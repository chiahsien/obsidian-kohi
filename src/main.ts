import { Notice, Plugin } from "obsidian";
import { basename } from "path";
import type { BookData, PluginSettings } from "./types";
import { DEFAULT_SETTINGS, KohiSettingTab } from "./settings";
import { scan } from "./scanner";
import { parseBookData } from "./book-parser";
import { renderNote } from "./note-generator";
import { writeNote } from "./note-writer";
import { openBookSelectModal } from "./multi-select-modal";

/**
 * KOHi plugin — imports KOReader highlights into the Obsidian vault.
 *
 * Commands:
 * - **Import all highlights** — scan device, parse all `.sdr`, write notes
 * - **Import selected highlights** — scan, then let user pick books via modal
 */
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

	/** Load settings from disk, merging with defaults. */
	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	/** Persist current settings to disk. */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Scan the mounted device and parse all `.sdr` directories.
	 * Shows a live progress Notice during scanning/parsing.
	 * @returns Parsed books and parse failures, or `null` if mount path
	 *          is missing or no `.sdr` directories are found.
	 */
	private scanAndParse(): {
		books: BookData[];
		failures: string[];
	} | null {
		if (!this.settings.mountPath) {
			new Notice("KOHi: Mount path not configured");
			return null;
		}

		const progress = new Notice("KOHi: Scanning…", 0);

		const sdrPaths = scan(this.settings.mountPath);
		if (sdrPaths.length === 0) {
			progress.hide();
			new Notice("KOHi: No .sdr directories found");
			return null;
		}

		const books: BookData[] = [];
		const failures: string[] = [];

		for (let i = 0; i < sdrPaths.length; i++) {
			const sdrPath = sdrPaths[i]!;
			progress.setMessage(
				`KOHi: Parsing ${i + 1}/${sdrPaths.length}…`,
			);
			const bookData = parseBookData(sdrPath);
			if (!bookData) {
				failures.push(`${basename(sdrPath)} (parse error)`);
				continue;
			}
			if (bookData.highlights.length === 0) continue;
			books.push(bookData);
		}

		progress.hide();
		return { books, failures };
	}

	/**
	 * Render and write notes for the given books.
	 * Shows a live progress Notice and a summary Notice on completion.
	 * Template errors and write errors are tracked separately.
	 */
	private async writeBooks(
		books: BookData[],
		parseFailures: string[],
	): Promise<void> {
		const importDate = new Date().toISOString().slice(0, 10);
		let success = 0;
		let skipped = 0;
		const failures = [...parseFailures];
		const progress = new Notice(`KOHi: Importing 0/${books.length}…`, 0);

		for (const bookData of books) {
			progress.setMessage(
				`KOHi: Importing ${success + skipped + 1}/${books.length}…`,
			);
			let content: string;
			try {
				content = renderNote(
					bookData,
					this.settings.noteTemplate,
					importDate,
				);
			} catch {
				failures.push(`${bookData.book.title} (template error)`);
				continue;
			}
			try {
				const result = await writeNote(
					this.app,
					this.settings.outputFolder,
					bookData.book,
					content,
					this.settings.filenameTemplate,
					this.settings.overwriteExisting,
				);
				if (result === "skipped") {
					skipped++;
				} else {
					success++;
				}
			} catch {
				failures.push(`${bookData.book.title} (write error)`);
			}
		}

		progress.hide();

		const parts: string[] = [];
		if (success > 0)
			parts.push(`${success} imported`);
		if (skipped > 0)
			parts.push(`${skipped} skipped`);
		if (failures.length > 0)
			parts.push(`${failures.length} failed`);

		if (failures.length === 0) {
			new Notice(`KOHi: ${parts.join(", ")}`);
		} else {
			new Notice(`KOHi: ${parts.join(", ")}:\n${failures.join("\n")}`);
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
