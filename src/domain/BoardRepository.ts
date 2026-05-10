import type { App } from "obsidian";
import { Notice } from "obsidian";
import type { Board, BoardNode } from "../types";
import { ensureSystemFrames } from "./Layout";

const BOARD_PATH = "LinkIndex/board.json";

function isValidBoard(parsed: unknown): parsed is Board {
	if (typeof parsed !== "object" || parsed === null) return false;
	const b = parsed as Record<string, unknown>;
	return b.version === 1 && Array.isArray(b.nodes);
}

function createEmptyBoard(): Board {
	return ensureSystemFrames({
		version: 1,
		viewport: { x: 0, y: 0, zoom: 1.0 },
		nodes: [],
	});
}

export class BoardRepository {
	constructor(private app: App) {}

	async load(): Promise<Board> {
		try {
			const raw = await this.app.vault.adapter.read(BOARD_PATH);
			const parsed = JSON.parse(raw) as unknown;
			if (!isValidBoard(parsed)) throw new Error("schema mismatch");
			return ensureSystemFrames(parsed);
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
				const ts = new Date().toISOString().replace(/[:.]/g, "-");
				const brokenPath = `LinkIndex/board.broken-${ts}.json`;
				try {
					await this.app.vault.adapter.rename(BOARD_PATH, brokenPath);
				} catch {
					// rename失敗は無視して空ボードで起動
				}
				new Notice("ボードが破損していたため空のボードで起動しました。");
			}
			return createEmptyBoard();
		}
	}

	async save(board: Board): Promise<void> {
		const dir = "LinkIndex";
		if (!(await this.app.vault.adapter.exists(dir))) {
			await this.app.vault.adapter.mkdir(dir);
		}

		const tmpPath = `${BOARD_PATH}.tmp`;
		const json = JSON.stringify(board, null, 2);
		await this.app.vault.adapter.write(tmpPath, json);
		await this.app.vault.adapter.rename(tmpPath, BOARD_PATH);
	}

	static isValidBoard = isValidBoard;
}
