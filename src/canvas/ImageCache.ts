import type { App } from "obsidian";

type CacheEntry = ImageBitmap | null | "loading";

export class ImageCache {
	private store: Map<string, CacheEntry> = new Map();

	constructor(private app: App, private onLoad: () => void) {}

	/** 同期取得。未ロードなら null を返しつつバックグラウンドロードを開始する */
	get(vaultPath: string): ImageBitmap | null {
		const entry = this.store.get(vaultPath);
		if (entry === undefined) {
			this.store.set(vaultPath, "loading");
			void this.loadAsync(vaultPath);
			return null;
		}
		if (entry === "loading") return null;
		return entry;
	}

	/** ロード済みキャッシュを無効化（ファイル更新時に呼ぶ） */
	invalidate(vaultPath: string): void {
		const entry = this.store.get(vaultPath);
		if (entry && entry !== "loading") {
			(entry as ImageBitmap).close?.();
		}
		this.store.delete(vaultPath);
	}

	/** 全キャッシュ解放（View close時） */
	destroy(): void {
		for (const [, entry] of this.store) {
			if (entry && entry !== "loading") (entry as ImageBitmap).close?.();
		}
		this.store.clear();
	}

	private async loadAsync(vaultPath: string): Promise<void> {
		try {
			const data = await this.app.vault.adapter.readBinary(vaultPath);
			const blob = new Blob([data]);
			const bitmap = await createImageBitmap(blob);
			this.store.set(vaultPath, bitmap);
			this.onLoad();
		} catch {
			this.store.set(vaultPath, null);
		}
	}
}
