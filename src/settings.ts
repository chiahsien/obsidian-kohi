import { App, PluginSettingTab, Setting } from "obsidian";
import type KohiPlugin from "./main";
import type { PluginSettings } from "./types";
import { DEFAULT_TEMPLATE } from "./note-generator";

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

		new Setting(containerEl).addButton((button) =>
			button.setButtonText("Reset template to default").onClick(
				async () => {
					this.plugin.settings.noteTemplate = DEFAULT_TEMPLATE;
					await this.plugin.saveSettings();
					this.display();
				},
			),
		);
	}
}
