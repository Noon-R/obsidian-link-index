import { App, PluginSettingTab, Setting } from "obsidian";
import type LinkIndexPlugin from "../../main";

const COMMANDS = [
	{ name: "Link Index を開く",               default: "—" },
	{ name: "リンクを追加...",                   default: "Ctrl + N" },
	{ name: "選択したカードを開く",               default: "（未設定）" },
	{ name: "検索バーを表示/非表示",              default: "Ctrl + F" },
	{ name: "自動レイアウト（タグでグルーピング）", default: "Ctrl + Shift + L" },
	{ name: "全体を表示",                        default: "F" },
];

export class LinkIndexSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: LinkIndexPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Link Index 設定" });

		// ── ショートカットの説明 ──
		containerEl.createEl("h3", { text: "キーボードショートカット" });

		new Setting(containerEl)
			.setName("ショートカットをカスタマイズするには")
			.setDesc("Obsidian の「設定 → ホットキー」画面で「Link Index」と検索すると、すべてのコマンドのショートカットを変更できます。")
			.addButton((btn) =>
				btn
					.setButtonText("ホットキー設定を開く")
					.onClick(() => {
						const setting = (this.app as unknown as {
							setting: { open(): void; openTabById(id: string): void };
						}).setting;
						setting.open();
						setting.openTabById("hotkeys");
					})
			);

		// コマンド一覧テーブル
		const table = containerEl.createEl("table");
		table.style.cssText = "width:100%;border-collapse:collapse;margin-top:8px;font-size:0.9em;";
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		for (const h of ["コマンド", "デフォルト"]) {
			const th = headRow.createEl("th", { text: h });
			th.style.cssText = "text-align:left;padding:6px 8px;border-bottom:1px solid var(--background-modifier-border);";
		}
		const tbody = table.createEl("tbody");
		for (const cmd of COMMANDS) {
			const tr = tbody.createEl("tr");
			const tdName = tr.createEl("td", { text: cmd.name });
			const tdKey  = tr.createEl("td", { text: cmd.default });
			tdName.style.cssText = "padding:5px 8px;border-bottom:1px solid var(--background-modifier-border-hover);";
			tdKey.style.cssText  = "padding:5px 8px;border-bottom:1px solid var(--background-modifier-border-hover);font-family:var(--font-monospace);";
		}
	}
}
