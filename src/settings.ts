import { App, PluginSettingTab, Setting } from "obsidian";
import type KohiPlugin from "./main";
import type { PluginSettings } from "./types";
import { DEFAULT_TEMPLATE, FLAT_TEMPLATE } from "./note-generator";

/** Default plugin settings. */
export const DEFAULT_SETTINGS: PluginSettings = {
	mountPath: "",
	outputFolder: "KOReader Highlights",
	noteTemplate: DEFAULT_TEMPLATE,
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
			.setDesc("Path to your KOReader device")
			.addText((text) =>
				text
					.setPlaceholder("/Volumes/KOBOeReader")
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
					.setPlaceholder("KOReader Highlights")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value;
						await this.plugin.saveSettings();
					}),
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

		const refEl = containerEl.createEl("details");
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
		];
		for (const [variable, desc] of rows) {
			const tr = table.createEl("tr");
			tr.createEl("td", { text: variable }).style.fontFamily =
				"monospace";
			tr.createEl("td", { text: desc });
		}
		const note = refEl.createEl("p");
		note.style.fontSize = "0.85em";
		note.style.color = "var(--text-muted)";
		note.setText(
			"Use highlights for a flat list, or chapters (each with .name and .highlights) for grouped output.",
		);

		new Setting(containerEl)
			.setName("Note template")
			.setDesc("Nunjucks template for note output")
			.addTextArea((text) => {
				text.inputEl.rows = 20;
				text.inputEl.style.width = "100%";
				text.inputEl.style.fontFamily = "monospace";
				text.inputEl.style.fontSize = "0.8em";
				text.setValue(this.plugin.settings.noteTemplate).onChange(
					async (value) => {
						this.plugin.settings.noteTemplate = value;
						await this.plugin.saveSettings();
					},
				);
			});
	}
}
