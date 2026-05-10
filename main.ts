import { Plugin } from "obsidian";
import { registerCommands } from "./src/commands/registerCommands";
import { CanvasView, VIEW_TYPE_LINK_INDEX } from "./src/canvas/CanvasView";
import { LinkIndexSettingsTab } from "./src/settings/SettingsTab";

export default class LinkIndexPlugin extends Plugin {
	async onload() {
		this.registerView(VIEW_TYPE_LINK_INDEX, (leaf) => new CanvasView(leaf, this));

		this.addRibbonIcon("network", "Link Index", () => {
			this.activateView();
		});

		registerCommands(this);
		this.addSettingTab(new LinkIndexSettingsTab(this.app, this));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_LINK_INDEX);
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_LINK_INDEX)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_LINK_INDEX, active: true });
		}
		workspace.revealLeaf(leaf);
	}
}
