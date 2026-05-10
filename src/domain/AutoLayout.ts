import type { Board, CardNode, FrameNode } from "../types";
import type { LinkIndex } from "./Index";
import { CARD_W, CARD_H, CARD_GAP, FRAME_LABEL_H } from "../types";

const FRAME_PAD = 80;
const ROW_MAX_W = 5200;
const PALETTE = [
	"#6688cc", "#88aaff", "#cc6688", "#4caf50",
	"#ff9800", "#9c27b0", "#00bcd4", "#ff5722",
];

function tagColor(tag: string): string {
	let h = 0;
	for (const c of tag) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
	return PALETTE[Math.abs(h) % PALETTE.length];
}

/**
 * カードをタグでグルーピングしフレーム付き格子レイアウトに再配置する。
 * - 非システムフレームと既存カードノードは全て削除して再生成。
 * - タグなしカードは「未分類」フレームへ。
 * - システムフレーム（AI Inbox）は位置・サイズ共に保持。
 */
export function autoLayout(board: Board, index: LinkIndex): void {
	const cardNodes = board.nodes.filter((n): n is CardNode => n.type === "card");
	if (cardNodes.length === 0) return;

	// タグごとにグルーピング（最初のタグで分類）
	const groups = new Map<string, string[]>();
	for (const node of cardNodes) {
		const card = index.get(node.card_id);
		const tag = card?.tags?.[0] ?? "未分類";
		if (!groups.has(tag)) groups.set(tag, []);
		groups.get(tag)!.push(node.card_id);
	}

	// 非システムフレームとカードを全削除（textノードは残す）
	board.nodes = board.nodes.filter(
		(n) => n.type === "text" || (n.type === "frame" && (n as FrameNode).system)
	);

	let curX = 0, curY = 0, rowMaxH = 0;

	for (const [tag, cardIds] of groups) {
		const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(cardIds.length))));
		const rows = Math.ceil(cardIds.length / cols);
		const frameW = CARD_GAP + cols * (CARD_W + CARD_GAP);
		const frameH = FRAME_LABEL_H + CARD_GAP + rows * (CARD_H + CARD_GAP);

		if (curX > 0 && curX + frameW > ROW_MAX_W) {
			curX = 0;
			curY += rowMaxH + FRAME_PAD;
			rowMaxH = 0;
		}

		const frame: FrameNode = {
			id: `n_auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
			type: "frame",
			label: tag,
			x: curX,
			y: curY,
			w: frameW,
			h: frameH,
			color: tagColor(tag),
		};
		board.nodes.push(frame);

		cardIds.forEach((cardId, i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			board.nodes.push({
				id: `n_${cardId}`,
				type: "card",
				card_id: cardId,
				x: frame.x + CARD_GAP + col * (CARD_W + CARD_GAP),
				y: frame.y + FRAME_LABEL_H + CARD_GAP + row * (CARD_H + CARD_GAP),
				w: CARD_W,
				h: CARD_H,
				z: 1,
			});
		});

		curX += frameW + FRAME_PAD;
		rowMaxH = Math.max(rowMaxH, frameH);
	}
}
