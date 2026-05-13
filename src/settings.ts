import { App, PluginSettingTab, Setting } from "obsidian";
import type KohiPlugin from "./main";
import type { PluginSettings } from "./types";
import { DEFAULT_TEMPLATE, FLAT_TEMPLATE } from "./note-generator";

/** Default plugin settings. */
export const DEFAULT_SETTINGS: PluginSettings = {
	mountPath: "",
	outputFolder: "KOReader Highlights",
	noteTemplate: DEFAULT_TEMPLATE,
	filenameTemplate: "{{title}}",
	overwriteExisting: true,
};

/** Plugin settings tab: mount path, output folder, and Nunjucks template editor. */
export class KohiSettingTab extends PluginSettingTab {
	plugin: KohiPlugin;

	constructor(app: App, plugin: KohiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Mount path")
			.setDesc("Path to your KOReader device, e.g. /volumes/KOBOeReader")
			.addText((text) =>
				text
					.setPlaceholder("/path/to/device")
					.setValue(this.plugin.settings.mountPath)
					.onChange(async (value) => {
						this.plugin.settings.mountPath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Vault folder for generated notes")
			.addText((text) =>
				text
					.setPlaceholder("KOReader highlights")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Filename template")
			.setDesc(
				"Nunjucks template for note filenames (without .md extension). Available: {{title}}, {{author}}, {{series}}, etc.",
			)
			.addText((text) =>
				text
					.setPlaceholder("{{title}}")
					.setValue(this.plugin.settings.filenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.filenameTemplate =
							value.trim() || "{{title}}";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Overwrite existing notes")
			.setDesc(
				"When enabled, re-importing a book overwrites the existing note. When disabled, existing notes are skipped.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.overwriteExisting)
					.onChange(async (value) => {
						this.plugin.settings.overwriteExisting = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("hr");

		const refEl = containerEl.createEl("details", {
			cls: "kohi-template-ref",
		});
		refEl.createEl("summary", { text: "Available template variables" });
		const table = refEl.createEl("table");
		const rows: [string, string][] = [
			["{{title}}", "Book title"],
			["{{author}}", "Author name"],
			["{{language}}", "Language code"],
			["{{pages}}", "Total pages"],
			["{{keywords}}", "Keywords / tags"],
			["{{description}}", "Book description (raw HTML)"],
			["{{series}}", "Series name"],
			["{{seriesIndex}}", "Position in series"],
			["{{imported}}", "Import date (YYYY-MM-DD)"],
			["{{h.text}}", "Highlighted text"],
			["{{h.note}}", "User note"],
			["{{h.chapter}}", "Chapter name"],
			["{{h.page}}", "Page number"],
			["{{h.datetime}}", "Highlight timestamp"],
			["{{h.color}}", "Highlight color"],
			["{{h.drawer}}", "Highlight style"],
		];
		for (const [variable, desc] of rows) {
			const tr = table.createEl("tr");
			tr.createEl("td", { text: variable, cls: "kohi-var-cell" });
			tr.createEl("td", { text: desc });
		}
		const note = refEl.createEl("p", { cls: "kohi-help-note" });
		note.setText(
			"Use highlights for a flat list, or chapters (each with .name and .highlights) for grouped output.",
		);

		new Setting(containerEl)
			.setName("Template presets")
			.setDesc("Load a built-in template (overwrites current template)")
			.addButton((btn) =>
				btn.setButtonText("Grouped by chapter").onClick(async () => {
					this.plugin.settings.noteTemplate = DEFAULT_TEMPLATE;
					await this.plugin.saveSettings();
					this.display();
				}),
			)
			.addButton((btn) =>
				btn.setButtonText("Flat list").onClick(async () => {
					this.plugin.settings.noteTemplate = FLAT_TEMPLATE;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName("Note template")
			.setDesc("Nunjucks template for note output")
			.addTextArea((text) => {
				text.inputEl.rows = 20;
				text.inputEl.addClass("kohi-template-textarea");
				text.setValue(this.plugin.settings.noteTemplate).onChange(
					async (value) => {
						this.plugin.settings.noteTemplate = value;
						await this.plugin.saveSettings();
					},
				);
			});
	}
}
