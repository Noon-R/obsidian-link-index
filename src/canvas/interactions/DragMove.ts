import type { BoardNode } from "../../types";
import type { Viewport } from "../Viewport";

export class DragMove {
	private dragging = false;
	private startWorldX = 0;
	private startWorldY = 0;
	private origPositions: Map<string, { x: number; y: number }> = new Map();

	start(
		nodes: BoardNode[],
		worldX: number,
		worldY: number
	): void {
		this.dragging = true;
		this.startWorldX = worldX;
		this.startWorldY = worldY;
		this.origPositions.clear();
		for (const n of nodes) {
			const node = n as { id: string; x: number; y: number };
			this.origPositions.set(node.id, { x: node.x, y: node.y });
		}
	}

	move(
		nodes: BoardNode[],
		worldX: number,
		worldY: number
	): void {
		if (!this.dragging) return;
		const dx = worldX - this.startWorldX;
		const dy = worldY - this.startWorldY;
		for (const n of nodes) {
			const orig = this.origPositions.get(n.id);
			if (!orig) continue;
			(n as unknown as { x: number; y: number }).x = orig.x + dx;
			(n as unknown as { x: number; y: number }).y = orig.y + dy;
		}
	}

	end(): boolean {
		const wasDragging = this.dragging;
		this.dragging = false;
		return wasDragging;
	}

	get active(): boolean { return this.dragging; }
}
