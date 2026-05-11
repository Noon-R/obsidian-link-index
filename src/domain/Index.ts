import type { App, TFile } from "obsidian";
import type { CardFrontmatter } from "../types";
import { CardRepository } from "./CardRepository";

const CACHE_PATH = "LinkIndex/.cache/index.json";

export class LinkIndex {
	private cards: Map<string, CardFrontmatter> = new Map();
	private repo: CardRepository;

	constructor(private app: App) {
		this.repo = new CardRepository(app);
	}

	async load(): Promise<void> {
		const cards = await this.repo.list();
		this.cards.clear();
		for (const card of cards) {
			this.cards.set(card.id, card);
		}
		await this.saveCache();
	}

	get(id: string): CardFrontmatter | undefined {
		return this.cards.get(id);
	}

	getAll(): CardFrontmatter[] {
		return Array.from(this.cards.values());
	}

	set(card: CardFrontmatter): void {
		this.cards.set(card.id, card);
		this.saveCache();
	}

	remove(id: string): void {
		this.cards.delete(id);
		this.saveCache();
	}

	search(query: string): CardFrontmatter[] {
		const q = query.toLowerCase();
		return this.getAll().filter(
			(c) =>
				c.title.toLowerCase().includes(q) ||
				c.description?.toLowerCase().includes(q) ||
				c.tags.some((t) => t.toLowerCase().includes(q)) ||
				c.url?.toLowerCase().includes(q)
		);
	}

	onModify(file: TFile): void {
		if (!file.path.startsWith("LinkIndex/cards/") || !file.path.endsWith(".md")) return;
		const id = file.basename;
		this.repo.read(id).then((card) => {
			if (card) {
				this.cards.set(card.id, card);
			} else {
				this.cards.delete(id);
			}
			this.saveCache();
		});
	}

	onDelete(file: TFile): void {
		if (!file.path.startsWith("LinkIndex/cards/") || !file.path.endsWith(".md")) return;
		this.cards.delete(file.basename);
		this.saveCache();
	}

	private saveCache(): void {
		const cacheDir = "LinkIndex/.cache";
		this.app.vault.adapter.exists(cacheDir).then(async (exists) => {
			if (!exists) await this.app.vault.adapter.mkdir(cacheDir);
			const data = JSON.stringify(Array.from(this.cards.values()), null, 2);
			await this.app.vault.adapter.write(CACHE_PATH, data);
		}).catch(() => { /* キャッシュ書き込み失敗は無視 */ });
	}
}
