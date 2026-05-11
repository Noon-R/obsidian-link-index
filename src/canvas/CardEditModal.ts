import { App, Modal, Setting } from "obsidian";
import type { CardFrontmatter } from "../types";

export class CardEditModal extends Modal {
	constructor(
		app: App,
		private card: CardFrontmatter,
		private onSave: (patch: Partial<CardFrontmatter>) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "カードを編集" });

		let title       = this.card.title;
		let description = this.card.description ?? "";
		let tagsStr     = this.card.tags.join(", ");
		let url         = this.card.url ?? "";

		new Setting(contentEl)
			.setName("タイトル")
			.addText((text) => {
				text.setValue(title);
				text.inputEl.style.width = "100%";
				text.onChange((v) => { title = v; });
				// フォーカス
				setTimeout(() => text.inputEl.focus(), 50);
			});

		new Setting(contentEl)
			.setName("説明")
			.addTextArea((ta) => {
				ta.setValue(description);
				ta.inputEl.style.width = "100%";
				ta.inputEl.rows = 3;
				ta.onChange((v) => { description = v; });
			});

		new Setting(contentEl)
			.setName("タグ")
			.setDesc("カンマ区切りで入力")
			.addText((text) => {
				text.setValue(tagsStr);
				text.setPlaceholder("tag1, tag2, tag3");
				text.inputEl.style.width = "100%";
				text.onChange((v) => { tagsStr = v; });
			});

		if (this.card.type === "web") {
			new Setting(contentEl)
				.setName("URL")
				.addText((text) => {
					text.setValue(url);
					text.inputEl.style.width = "100%";
					text.onChange((v) => { url = v; });
				});
		}

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("保存").setCta().onClick(() => this.save(title, description, tagsStr, url))
			)
			.addButton((btn) =>
				btn.setButtonText("キャンセル").onClick(() => this.close())
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private save(title: string, description: string, tagsStr: string, url: string): void {
		const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [];
		const patch: Partial<CardFrontmatter> = {
			title:       title.trim() || this.card.title,
			description: description.trim() || undefined,
			tags,
		};
		if (this.card.type === "web") {
			patch.url = url.trim() || undefined;
		}
		this.close();
		this.onSave(patch);
	}
}
