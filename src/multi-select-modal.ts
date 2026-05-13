import { App, Modal, prepareFuzzySearch } from "obsidian";
import type { BookData } from "./types";

/**
 * Open a modal for the user to pick books from a list.
 *
 * Supports fuzzy search, select all/clear, and per-book checkboxes.
 * Resolves with the selected books, or an empty array if cancelled.
 */
export function openBookSelectModal(
	app: App,
	books: BookData[],
	skippedImportedCount = 0,
): Promise<BookData[]> {
	return new Promise((resolve) => {
		new BookSelectModal(app, books, skippedImportedCount, resolve).open();
	});
}

class BookSelectModal extends Modal {
	private books: BookData[];
	private skippedImportedCount: number;
	private selected: Set<BookData> = new Set();
	private resolve: (value: BookData[]) => void;
	private query = "";
	private listEl!: HTMLElement;
	private countEl!: HTMLElement;

	constructor(
		app: App,
		books: BookData[],
		skippedImportedCount: number,
		resolve: (value: BookData[]) => void,
	) {
		super(app);
		this.books = books;
		this.skippedImportedCount = skippedImportedCount;
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("kohi-book-select");

		const searchInput = contentEl.createEl("input", {
			type: "text",
			placeholder: "Search books...",
			cls: "kohi-search-input",
		});
		searchInput.addEventListener("input", () => {
			this.query = searchInput.value;
			this.renderList();
		});

		if (this.skippedImportedCount > 0) {
			contentEl.createDiv({
				cls: "kohi-skip-hint",
				text: `${this.skippedImportedCount} previously imported book${this.skippedImportedCount === 1 ? "" : "s"} hidden`,
			});
		}

		this.listEl = contentEl.createDiv({ cls: "kohi-book-list" });

		const footer = contentEl.createDiv({ cls: "kohi-footer" });

		this.countEl = footer.createSpan();

		const buttons = footer.createDiv({ cls: "kohi-footer-buttons" });

		const selectAllBtn = buttons.createEl("button", {
			text: "Select all",
		});
		selectAllBtn.addEventListener("click", () => {
			for (const b of this.books) this.selected.add(b);
			this.updateCount();
			this.renderList();
		});

		const clearBtn = buttons.createEl("button", { text: "Clear" });
		clearBtn.addEventListener("click", () => {
			this.selected.clear();
			this.updateCount();
			this.renderList();
		});

		const importBtn = buttons.createEl("button", {
			text: "Import",
			cls: "mod-cta",
		});
		importBtn.addEventListener("click", () => {
			this.close();
			this.resolve([...this.selected]);
		});

		this.updateCount();
		this.renderList();
		searchInput.focus();
	}

	onClose(): void {
		if (this.selected.size === 0) {
			this.resolve([]);
		}
	}

	private updateCount(): void {
		this.countEl.textContent = `${this.selected.size} / ${this.books.length} selected`;
	}

	private renderList(): void {
		this.listEl.empty();

		let filtered: BookData[];
		if (this.query.trim()) {
			const fuzzy = prepareFuzzySearch(this.query);
			filtered = this.books.filter((b) => {
				const label = `${b.book.title} — ${b.book.author}`;
				return fuzzy(label) !== null;
			});
		} else {
			filtered = this.books;
		}

		for (const b of filtered) {
			const row = this.listEl.createDiv({ cls: "kohi-book-row" });

			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selected.has(b);

			const label = row.createSpan({ cls: "kohi-book-label" });
			label.textContent = `${b.book.title} — ${b.book.author}`;

			const hlCount = row.createSpan({ cls: "kohi-highlight-count" });
			hlCount.textContent = ` (${b.highlights.length})`;

			row.addEventListener("click", (e) => {
				if (e.target === checkbox) return;
				if (this.selected.has(b)) {
					this.selected.delete(b);
				} else {
					this.selected.add(b);
				}
				this.updateCount();
				this.renderList();
			});

			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selected.add(b);
				} else {
					this.selected.delete(b);
				}
				this.updateCount();
				this.renderList();
			});
		}

		if (filtered.length === 0) {
			const empty = this.listEl.createDiv({ cls: "kohi-empty-state" });
			empty.textContent = this.query
				? "No matching books"
				: "No books found";
		}
	}
}
