import type {
	Board,
	BoardNode,
	CardNode,
	FrameNode,
	CardFrontmatter,
	Viewport,
} from "../types";
import {
	CARD_W,
	CARD_H,
	CARD_GAP,
	FRAME_LABEL_H,
	AI_INBOX_LABEL,
} from "../types";

export function findFrameByLabel(board: Board, label: string): FrameNode | undefined {
	return board.nodes.find(
		(n): n is FrameNode => n.type === "frame" && n.label === label
	);
}

export function findSystemFrame(board: Board, label: string): FrameNode | undefined {
	return board.nodes.find(
		(n): n is FrameNode => n.type === "frame" && n.system === true && n.label === label
	);
}

export function getCardsOverlappingFrame(board: Board, frame: FrameNode): CardNode[] {
	return board.nodes.filter((n): n is CardNode => {
		if (n.type !== "card") return false;
		return (
			n.x >= frame.x &&
			n.y >= frame.y &&
			n.x + n.w <= frame.x + frame.w &&
			n.y + n.h <= frame.y + frame.h
		);
	});
}

export function placeInFrame(board: Board, frame: FrameNode, cardId: string): CardNode {
	const existing = getCardsOverlappingFrame(board, frame);
	const cols = Math.max(1, Math.floor((frame.w - CARD_GAP) / (CARD_W + CARD_GAP)));
	const idx = existing.length;
	const col = idx % cols;
	const row = Math.floor(idx / cols);

	const neededH = FRAME_LABEL_H + CARD_GAP + (row + 1) * (CARD_H + CARD_GAP);
	if (neededH > frame.h) {
		frame.h = neededH;
	}

	return {
		id: `n_${cardId}`,
		type: "card",
		card_id: cardId,
		x: frame.x + CARD_GAP + col * (CARD_W + CARD_GAP),
		y: frame.y + FRAME_LABEL_H + CARD_GAP + row * (CARD_H + CARD_GAP),
		w: CARD_W,
		h: CARD_H,
		z: 1,
	};
}

export function createFrameNearViewport(viewport: Viewport, label: string): FrameNode {
	const x = viewport.x + Math.round(1200 / viewport.zoom);
	const y = viewport.y;
	return {
		id: `n_frame_${Date.now()}`,
		type: "frame",
		label,
		x,
		y,
		w: 1000,
		h: 600,
		color: "#88aaff",
	};
}

export function placeNewCard(
	board: Board,
	card: CardFrontmatter,
	group?: string
): { node: CardNode; newFrame?: FrameNode } {
	let targetFrame: FrameNode | undefined;
	let newFrame: FrameNode | undefined;

	if (group) {
		targetFrame = findFrameByLabel(board, group);
		if (!targetFrame) {
			newFrame = createFrameNearViewport(board.viewport, group);
			board.nodes.push(newFrame);
			targetFrame = newFrame;
		}
	} else {
		targetFrame = findSystemFrame(board, AI_INBOX_LABEL);
	}

	if (!targetFrame) {
		throw new Error(`AI Inbox frame not found in board`);
	}

	const node = placeInFrame(board, targetFrame, card.id);
	return { node, newFrame };
}

export function placeCenterViewport(viewport: Viewport, cardId: string): CardNode {
	return {
		id: `n_${cardId}`,
		type: "card",
		card_id: cardId,
		x: viewport.x + Math.round((800 - CARD_W) / 2 / viewport.zoom),
		y: viewport.y + Math.round((600 - CARD_H) / 2 / viewport.zoom),
		w: CARD_W,
		h: CARD_H,
		z: 1,
	};
}

export function ensureSystemFrames(board: Board): Board {
	const hasInbox = board.nodes.some(
		(n): n is FrameNode =>
			n.type === "frame" && n.system === true && n.label === AI_INBOX_LABEL
	);
	if (!hasInbox) {
		board.nodes.push({
			id: "n_inbox",
			type: "frame",
			label: AI_INBOX_LABEL,
			x: -1200,
			y: -400,
			w: 1000,
			h: 600,
			color: "#6688cc",
			system: true,
		});
	}
	return board;
}
