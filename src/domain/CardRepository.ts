import type { App, TFile } from "obsidian";
import { ulid } from "ulid";
import type { CardFrontmatter, CardStatus, CardSource } from "../types";

const CARDS_DIR = "LinkIndex/cards";

export class CardRepository {
	constructor(private app: App) {}

	async ensureDir(): Promise<void> {
		if (!(await this.app.vault.adapter.exists("LinkIndex"))) {
			await this.app.vault.adapter.mkdir("LinkIndex");
		}
		if (!(await this.app.vault.adapter.exists(CARDS_DIR))) {
			await this.app.vault.adapter.mkdir(CARDS_DIR);
		}
	}

	async create(
		partial: Omit<CardFrontmatter, "id" | "added" | "status" | "source"> & {
			status?: CardStatus;
			source?: CardSource;
		}
	): Promise<CardFrontmatter> {
		await this.ensureDir();
		const id = ulid();
		const card: CardFrontmatter = {
			id,
			status: "unread",
			source: "manual",
			...partial,
			added: new Date().toISOString(),
		};
		await this.app.vault.adapter.write(`${CARDS_DIR}/${id}.md`, this.serialize(card));
		return card;
	}

	async read(id: string): Promise<CardFrontmatter | null> {
		try {
			const raw = await this.app.vault.adapter.read(`${CARDS_DIR}/${id}.md`);
			return this.parse(raw);
		} catch {
			return null;
		}
	}

	async update(id: string, patch: Partial<CardFrontmatter>): Promise<void> {
		const card = await this.read(id);
		if (!card) throw new Error(`Card not found: ${id}`);
		await this.app.vault.adapter.write(
			`${CARDS_DIR}/${id}.md`,
			this.serialize({ ...card, ...patch, id })
		);
	}

	async delete(id: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(`${CARDS_DIR}/${id}.md`) as TFile | null;
		if (file) await this.app.vault.trash(file, true);
	}

	async list(): Promise<CardFrontmatter[]> {
		if (!(await this.app.vault.adapter.exists(CARDS_DIR))) return [];
		const listed = await this.app.vault.adapter.list(CARDS_DIR);
		const cards: CardFrontmatter[] = [];
		for (const filePath of listed.files) {
			if (!filePath.endsWith(".md")) continue;
			try {
				const raw = await this.app.vault.adapter.read(filePath);
				const card = this.parse(raw);
				if (card) cards.push(card);
			} catch {
				// 読み取り失敗のファイルはスキップ
			}
		}
		return cards;
	}

	private serialize(card: CardFrontmatter): string {
		const fm = (Object.entries(card) as [string, unknown][])
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => {
				if (Array.isArray(v)) return `${k}: [${(v as string[]).join(", ")}]`;
				if (typeof v === "string" && (v.includes('"') || v.includes("'"))) {
					return `${k}: ${JSON.stringify(v)}`;
				}
				return `${k}: ${JSON.stringify(v)}`;
			})
			.join("\n");
		return `---\n${fm}\n---\n\n## メモ\n`;
	}

	private parse(raw: string): CardFrontmatter | null {
		const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		const match = normalized.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return null;
		const obj: Record<string, unknown> = {};
		for (const line of match[1].split("\n")) {
			const colon = line.indexOf(":");
			if (colon === -1) continue;
			const key = line.slice(0, colon).trim();
			const rawVal = line.slice(colon + 1).trim();
			if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
				obj[key] = rawVal
					.slice(1, -1)
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
			} else {
				try {
					obj[key] = JSON.parse(rawVal);
				} catch {
					obj[key] = rawVal;
				}
			}
		}
		if (!obj.id || !obj.title) return null;
		return obj as unknown as CardFrontmatter;
	}
}
