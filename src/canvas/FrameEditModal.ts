import { App, Modal, Setting } from "obsidian";
import type { FrameNode } from "../types";

const PALETTE = [
	"#6688cc", "#88aaff", "#cc6688", "#4caf50",
	"#ff9800", "#9c27b0", "#00bcd4", "#ff5722",
	"#795548", "#607d8b",
];

export class FrameEditModal extends Modal {
	private labelVal: string;
	private colorVal: string;

	constructor(
		app: App,
		private frame: FrameNode,
		private onSave: (label: string, color: string) => void
	) {
		super(app);
		this.labelVal = frame.label;
		this.colorVal = frame.color;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "フレームを編集" });

		let labelInput!: HTMLInputElement;

		new Setting(contentEl)
			.setName("ラベル")
			.addText((t) => {
				labelInput = t.inputEl;
				t.setValue(this.labelVal);
				t.inputEl.style.width = "100%";
				t.onChange((v) => { this.labelVal = v; });
				t.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") this.save();
				});
			});

		// カラースウォッチ
		const colorSetting = new Setting(contentEl).setName("カラー");
		const swatches = colorSetting.controlEl.createDiv();
		Object.assign(swatches.style, {
			display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px",
		});

		for (const color of PALETTE) {
			const s = swatches.createDiv();
			Object.assign(s.style, {
				width: "24px", height: "24px",
				borderRadius: "5px",
				background: color,
				cursor: "pointer",
				border: color === this.colorVal ? "2px solid #fff" : "2px solid transparent",
				boxSizing: "border-box",
			});
			s.addEventListener("click", () => {
				this.colorVal = color;
				swatches.querySelectorAll<HTMLDivElement>("div").forEach((el) => {
					el.style.border = "2px solid transparent";
				});
				s.style.border = "2px solid #fff";
			});
		}

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("保存").setCta().onClick(() => this.save())
			)
			.addButton((btn) =>
				btn.setButtonText("キャンセル").onClick(() => this.close())
			);

		setTimeout(() => labelInput?.focus(), 50);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private save(): void {
		if (!this.labelVal.trim()) return;
		this.close();
		this.onSave(this.labelVal.trim(), this.colorVal);
	}
}
