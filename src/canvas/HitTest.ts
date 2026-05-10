import type { BoardNode, CardNode, FrameNode } from "../types";
import type { Viewport } from "./Viewport";

const HANDLE = 10;

export type HitResult =
	| { kind: "node"; node: BoardNode }
	| { kind: "resize"; node: CardNode | FrameNode; edge: "se" | "e" | "s" }
	| { kind: "none" };

export function hitTest(
	nodes: BoardNode[],
	viewport: Viewport,
	sx: number,
	sy: number
): HitResult {
	const { x: wx, y: wy } = viewport.screenToWorld(sx, sy);

	// z-order降順で判定（前面優先）
	const sorted = [...nodes].sort((a, b) => {
		const za = "z" in a ? ((a as CardNode).z ?? 0) : 0;
		const zb = "z" in b ? ((b as CardNode).z ?? 0) : 0;
		return zb - za;
	});

	for (const node of sorted) {
		if (node.type === "text") {
			const { x, y, w, h } = node;
			if (wx >= x && wx <= x + w && wy >= y && wy <= y + h) {
				return { kind: "node", node };
			}
			continue;
		}

		const { x, y, w, h } = node as CardNode | FrameNode;

		// ノード外なら skip
		if (wx < x || wx > x + w || wy < y || wy > y + h) continue;

		// SE角（優先度最高）
		if (wx >= x + w - HANDLE && wy >= y + h - HANDLE) {
			return { kind: "resize", node: node as CardNode | FrameNode, edge: "se" };
		}

		// E辺（右辺、SE角より先に判定しているので重複なし）
		if (wx >= x + w - HANDLE && wy > y + HANDLE && wy < y + h - HANDLE) {
			return { kind: "resize", node: node as CardNode | FrameNode, edge: "e" };
		}

		// S辺（下辺）
		if (wy >= y + h - HANDLE && wx > x + HANDLE && wx < x + w - HANDLE) {
			return { kind: "resize", node: node as CardNode | FrameNode, edge: "s" };
		}

		return { kind: "node", node };
	}

	return { kind: "none" };
}

export function nodesInBox(
	nodes: BoardNode[],
	minX: number,
	minY: number,
	maxX: number,
	maxY: number
): string[] {
	return nodes
		.filter((n) => {
			const node = n as { x: number; y: number; w: number; h: number };
			return (
				node.x < maxX &&
				node.x + node.w > minX &&
				node.y < maxY &&
				node.y + node.h > minY
			);
		})
		.map((n) => n.id);
}
