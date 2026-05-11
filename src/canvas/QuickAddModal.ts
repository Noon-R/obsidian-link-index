import { App, Modal, Setting } from "obsidian";

export class QuickAddModal extends Modal {
	private urlEl!: HTMLInputElement;
	private cardTitleEl!: HTMLInputElement;
	private tagsEl!: HTMLInputElement;

	constructor(
		app: App,
		private onSubmit: (value: string, title: string, tags: string[]) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "リンクを追加" });

		new Setting(contentEl)
			.setName("URL またはファイルパス")
			.addText((text) => {
				this.urlEl = text.inputEl;
				text.setPlaceholder("https://example.com  または  C:/path/to/file.pdf");
				text.inputEl.style.width = "100%";
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") { e.preventDefault(); this.cardTitleEl?.focus(); }
				});
			});

		new Setting(contentEl)
			.setName("タイトル")
			.setDesc("空欄の場合はページタイトルまたはファイル名を使用")
			.addText((text) => {
				this.cardTitleEl = text.inputEl;
				text.setPlaceholder("カスタムタイトル（省略可）");
				text.inputEl.style.width = "100%";
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") { e.preventDefault(); this.tagsEl?.focus(); }
				});
			});

		new Setting(contentEl)
			.setName("タグ")
			.setDesc("カンマ区切りで入力")
			.addText((text) => {
				this.tagsEl = text.inputEl;
				text.setPlaceholder("tag1, tag2, tag3");
				text.inputEl.style.width = "100%";
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") { e.preventDefault(); this.submit(); }
				});
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("追加").setCta().onClick(() => this.submit())
			)
			.addButton((btn) =>
				btn.setButtonText("キャンセル").onClick(() => this.close())
			);

		setTimeout(() => this.urlEl?.focus(), 50);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private submit(): void {
		const value = this.urlEl?.value?.trim();
		if (!value) return;
		const title = this.cardTitleEl?.value?.trim() ?? "";
		const tagsRaw = this.tagsEl?.value?.trim() ?? "";
		const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
		this.close();
		this.onSubmit(value, title, tags);
	}
}
