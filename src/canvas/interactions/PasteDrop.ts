const URL_PATTERN = /^https?:\/\/.+/;

function isUrl(text: string): boolean {
	return URL_PATTERN.test(text.trim());
}

export class PasteDrop {
	private pasteHandler: (e: ClipboardEvent) => void;
	private dragOverHandler: (e: DragEvent) => void;
	private dropHandler: (e: DragEvent) => void;

	constructor(
		private el: HTMLElement,
		private onUrl: (url: string, sx?: number, sy?: number) => Promise<void>,
		private onFiles: (paths: string[], sx?: number, sy?: number) => Promise<void>
	) {
		this.pasteHandler = this.onPaste.bind(this);
		this.dragOverHandler = this.onDragOver.bind(this);
		this.dropHandler = this.onDrop.bind(this);
	}

	attach(): void {
		this.el.addEventListener("paste", this.pasteHandler as EventListener);
		this.el.addEventListener("dragover", this.dragOverHandler as EventListener);
		this.el.addEventListener("drop", this.dropHandler as EventListener);
	}

	detach(): void {
		this.el.removeEventListener("paste", this.pasteHandler as EventListener);
		this.el.removeEventListener("dragover", this.dragOverHandler as EventListener);
		this.el.removeEventListener("drop", this.dropHandler as EventListener);
	}

	private onPaste(e: ClipboardEvent): void {
		const text = e.clipboardData?.getData("text") ?? "";
		if (isUrl(text.trim())) {
			e.preventDefault();
			e.stopPropagation();
			void this.onUrl(text.trim());
		}
	}

	private onDragOver(e: DragEvent): void {
		const hasFiles = (e.dataTransfer?.types ?? []).includes("Files");
		const hasText =
			(e.dataTransfer?.types ?? []).includes("text/plain") ||
			(e.dataTransfer?.types ?? []).includes("text/uri-list");
		if (hasFiles || hasText) {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
		}
	}

	private onDrop(e: DragEvent): void {
		e.preventDefault();
		const rect = this.el.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;

		// text/uri-list (ブラウザからのリンクドロップ)
		const uriList = e.dataTransfer?.getData("text/uri-list") ?? "";
		if (uriList) {
			const urls = uriList
				.split(/[\r\n]+/)
				.map((l) => l.trim())
				.filter((l) => isUrl(l));
			if (urls.length > 0) {
				void this.onUrl(urls[0], sx, sy);
				return;
			}
		}

		// plain text がURL
		const text = e.dataTransfer?.getData("text/plain") ?? "";
		if (isUrl(text.trim())) {
			void this.onUrl(text.trim(), sx, sy);
			return;
		}

		// ファイルシステムからのドロップ
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const paths = Array.from(files)
				.map((f) => {
					// Electron では File オブジェクトに path プロパティが存在する
					const ep = (f as unknown as { path?: string }).path;
					return ep ?? f.name;
				})
				.filter(Boolean) as string[];
			if (paths.length > 0) {
				void this.onFiles(paths, sx, sy);
			}
		}
	}
}
