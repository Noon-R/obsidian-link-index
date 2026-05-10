import { App, PluginSettingTab, Setting } from "obsidian";
import type LinkIndexPlugin from "../../main";

export class LinkIndexSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: LinkIndexPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Link Index 設定" });

		new Setting(containerEl)
			.setName("Link Index について")
			.setDesc("PureRef風の無限キャンバスでリンクを管理するプラグインです。");
	}
}
