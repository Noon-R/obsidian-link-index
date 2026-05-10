export class SearchOverlay {
	private el: HTMLDivElement;
	private inputEl: HTMLInputElement;
	private countEl: HTMLSpanElement;

	constructor(
		parent: HTMLElement,
		private onQuery: (q: string) => void,
		private onClose: () => void
	) {
		this.el = parent.createDiv();
		Object.assign(this.el.style, {
			position: "absolute",
			top: "12px",
			left: "50%",
			transform: "translateX(-50%)",
			zIndex: "20",
			display: "none",
			background: "var(--background-secondary)",
			border: "1px solid var(--background-modifier-border)",
			borderRadius: "8px",
			padding: "6px 12px",
			minWidth: "300px",
			boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
			userSelect: "none",
		});

		const row = this.el.createDiv();
		Object.assign(row.style, { display: "flex", alignItems: "center", gap: "8px" });

		const icon = row.createSpan({ text: "🔍" });
		icon.style.opacity = "0.5";
		icon.style.fontSize = "13px";

		this.inputEl = row.createEl("input");
		Object.assign(this.inputEl.style, {
			border: "none",
			outline: "none",
			background: "transparent",
			flex: "1",
			fontSize: "14px",
			color: "var(--text-normal)",
		});
		this.inputEl.placeholder = "カードを絞り込む...";

		this.countEl = row.createSpan();
		Object.assign(this.countEl.style, {
			fontSize: "11px",
			color: "var(--text-muted)",
			minWidth: "40px",
			textAlign: "right",
		});

		const closeBtn = row.createEl("button", { text: "✕" });
		Object.assign(closeBtn.style, {
			background: "none",
			border: "none",
			cursor: "pointer",
			color: "var(--text-muted)",
			fontSize: "13px",
			padding: "0 2px",
		});
		closeBtn.addEventListener("click", () => { this.hide(); this.onClose(); });

		this.inputEl.addEventListener("input", () => {
			this.onQuery(this.inputEl.value);
		});

		this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			e.stopPropagation();
			if (e.key === "Escape") { this.hide(); this.onClose(); }
		});
	}

	show(): void {
		this.el.style.display = "block";
		this.inputEl.value = "";
		this.countEl.textContent = "";
		setTimeout(() => this.inputEl.focus(), 30);
	}

	hide(): void {
		this.el.style.display = "none";
		this.onQuery("");
	}

	setCount(matched: number, total: number): void {
		this.countEl.textContent = `${matched} / ${total}`;
	}

	get isVisible(): boolean {
		return this.el.style.display !== "none";
	}

	get query(): string {
		return this.inputEl.value;
	}

	destroy(): void {
		this.el.remove();
	}
}
