import { App, Modal, Setting } from "obsidian";

export class QuickAddModal extends Modal {
	private inputEl!: HTMLInputElement;

	constructor(
		app: App,
		private onSubmit: (value: string) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "リンクを追加" });

		new Setting(contentEl)
			.setName("URL またはファイルパス")
			.addText((text) => {
				this.inputEl = text.inputEl;
				text.setPlaceholder("https://example.com  または  C:/path/to/file.pdf");
				text.inputEl.style.width = "100%";
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						this.submit();
					}
				});
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("追加")
					.setCta()
					.onClick(() => this.submit())
			)
			.addButton((btn) =>
				btn.setButtonText("キャンセル").onClick(() => this.close())
			);

		// モーダルが開いた直後にフォーカス
		setTimeout(() => this.inputEl?.focus(), 50);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private submit(): void {
		const value = this.inputEl?.value?.trim();
		if (!value) return;
		this.close();
		this.onSubmit(value);
	}
}
