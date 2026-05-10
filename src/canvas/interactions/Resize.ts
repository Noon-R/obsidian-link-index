import type { CardNode, FrameNode } from "../../types";

const MIN_W = 120;
const MIN_H = 80;

export type ResizeEdge = "se" | "e" | "s";

export class Resize {
	private resizing = false;
	private edge: ResizeEdge = "se";
	private origW = 0;
	private origH = 0;
	private startWorldX = 0;
	private startWorldY = 0;
	private target: CardNode | FrameNode | null = null;

	start(node: CardNode | FrameNode, edge: ResizeEdge, worldX: number, worldY: number): void {
		this.resizing = true;
		this.edge = edge;
		this.origW = node.w;
		this.origH = node.h;
		this.startWorldX = worldX;
		this.startWorldY = worldY;
		this.target = node;
	}

	move(worldX: number, worldY: number): void {
		if (!this.resizing || !this.target) return;
		const dx = worldX - this.startWorldX;
		const dy = worldY - this.startWorldY;
		if (this.edge === "se" || this.edge === "e") {
			this.target.w = Math.max(MIN_W, this.origW + dx);
		}
		if (this.edge === "se" || this.edge === "s") {
			this.target.h = Math.max(MIN_H, this.origH + dy);
		}
	}

	end(): boolean {
		const was = this.resizing;
		this.resizing = false;
		this.target = null;
		return was;
	}

	get active(): boolean { return this.resizing; }
	get currentEdge(): ResizeEdge { return this.edge; }
}
