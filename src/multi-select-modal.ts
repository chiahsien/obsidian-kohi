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
): Promise<BookData[]> {
	return new Promise((resolve) => {
		new BookSelectModal(app, books, resolve).open();
	});
}

class BookSelectModal extends Modal {
	private books: BookData[];
	private selected: Set<BookData> = new Set();
	private resolve: (value: BookData[]) => void;
	private query = "";
	private listEl!: HTMLElement;
	private countEl!: HTMLElement;

	constructor(
		app: App,
		books: BookData[],
		resolve: (value: BookData[]) => void,
	) {
		super(app);
		this.books = books;
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
		searchInput.style.width = "100%";
		searchInput.style.marginBottom = "8px";
		searchInput.addEventListener("input", () => {
			this.query = searchInput.value;
			this.renderList();
		});

		this.listEl = contentEl.createDiv({ cls: "kohi-book-list" });
		this.listEl.style.maxHeight = "300px";
		this.listEl.style.overflowY = "auto";
		this.listEl.style.marginBottom = "8px";

		const footer = contentEl.createDiv({ cls: "kohi-footer" });
		footer.style.display = "flex";
		footer.style.justifyContent = "space-between";
		footer.style.alignItems = "center";

		this.countEl = footer.createSpan();

		const buttons = footer.createDiv();
		buttons.style.display = "flex";
		buttons.style.gap = "6px";

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
			row.style.display = "flex";
			row.style.alignItems = "center";
			row.style.padding = "4px 0";
			row.style.cursor = "pointer";

			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selected.has(b);
			checkbox.style.marginRight = "8px";

			const label = row.createSpan();
			label.textContent = `${b.book.title} — ${b.book.author}`;
			label.style.fontSize = "0.9em";

			const hlCount = row.createSpan();
			hlCount.textContent = ` (${b.highlights.length})`;
			hlCount.style.color = "var(--text-muted)";
			hlCount.style.fontSize = "0.8em";

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
			const empty = this.listEl.createDiv();
			empty.textContent = this.query
				? "No matching books"
				: "No books found";
			empty.style.padding = "8px 0";
			empty.style.color = "var(--text-muted)";
		}
	}
}
