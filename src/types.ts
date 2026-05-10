export type CardType = "web" | "local-file" | "vault-note";
export type CardStatus = "unread" | "reading" | "done" | "archive";
export type CardSource = "manual" | "clipper" | "mcp" | "hook";

export interface CardFrontmatter {
	id: string;
	type: CardType;
	url?: string;
	path?: string;
	title: string;
	description?: string;
	favicon?: string;
	thumbnail?: string;
	domain?: string;
	tags: string[];
	added: string;
	last_visited?: string;
	status: CardStatus;
	source: CardSource;
	mime?: string;
}

export interface CardNode {
	id: string;
	type: "card";
	card_id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	z: number;
}

export interface FrameNode {
	id: string;
	type: "frame";
	label: string;
	x: number;
	y: number;
	w: number;
	h: number;
	color: string;
	system?: boolean;
}

export interface TextNode {
	id: string;
	type: "text";
	text: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

export type BoardNode = CardNode | FrameNode | TextNode;

export interface Viewport {
	x: number;
	y: number;
	zoom: number;
}

export interface Board {
	version: 1;
	viewport: Viewport;
	nodes: BoardNode[];
}

export const CARD_W = 280;
export const CARD_H = 200;
export const CARD_GAP = 16;
export const FRAME_LABEL_H = 32;
export const AI_INBOX_FRAME_ID = "n_inbox";
export const AI_INBOX_LABEL = "AI Inbox";
