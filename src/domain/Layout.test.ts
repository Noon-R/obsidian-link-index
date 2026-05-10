import { describe, it, expect } from "vitest";
import type { Board, FrameNode } from "../types";
import {
	findFrameByLabel,
	findSystemFrame,
	placeInFrame,
	placeNewCard,
	ensureSystemFrames,
	getCardsOverlappingFrame,
} from "./Layout";
import { BoardRepository } from "./BoardRepository";

const makeBoard = (nodes: Board["nodes"] = []): Board => ({
	version: 1,
	viewport: { x: 0, y: 0, zoom: 1.0 },
	nodes,
});

const makeFrame = (label: string, system?: boolean): FrameNode => ({
	id: `f_${label}`,
	type: "frame",
	label,
	x: 0,
	y: 0,
	w: 1000,
	h: 600,
	color: "#88aaff",
	system,
});

describe("findFrameByLabel", () => {
	it("ラベルが一致するフレームを返す", () => {
		const board = makeBoard([makeFrame("Rust"), makeFrame("TypeScript")]);
		const f = findFrameByLabel(board, "Rust");
		expect(f?.label).toBe("Rust");
	});

	it("存在しない場合は undefined", () => {
		const board = makeBoard([makeFrame("Rust")]);
		expect(findFrameByLabel(board, "Go")).toBeUndefined();
	});
});

describe("findSystemFrame", () => {
	it("system:true のフレームを返す", () => {
		const board = makeBoard([makeFrame("Regular"), makeFrame("AI Inbox", true)]);
		const f = findSystemFrame(board, "AI Inbox");
		expect(f?.system).toBe(true);
	});

	it("system:true でないフレームはヒットしない", () => {
		const board = makeBoard([makeFrame("AI Inbox", false)]);
		expect(findSystemFrame(board, "AI Inbox")).toBeUndefined();
	});
});

describe("ensureSystemFrames", () => {
	it("AI Inboxが存在しない場合に追加する", () => {
		const board = makeBoard([]);
		ensureSystemFrames(board);
		const inbox = findSystemFrame(board, "AI Inbox");
		expect(inbox).toBeDefined();
		expect(inbox?.system).toBe(true);
	});

	it("AI Inboxが既に存在する場合は追加しない", () => {
		const board = makeBoard([makeFrame("AI Inbox", true)]);
		ensureSystemFrames(board);
		const inboxNodes = board.nodes.filter(
			(n): n is FrameNode => n.type === "frame" && n.label === "AI Inbox"
		);
		expect(inboxNodes).toHaveLength(1);
	});
});

describe("placeInFrame", () => {
	it("最初のカードはフレーム左上に配置される", () => {
		const frame = makeFrame("Test");
		const board = makeBoard([frame]);
		const node = placeInFrame(board, frame, "card001");
		expect(node.type).toBe("card");
		expect(node.card_id).toBe("card001");
		expect(node.x).toBeGreaterThanOrEqual(frame.x);
		expect(node.y).toBeGreaterThanOrEqual(frame.y);
	});

	it("複数カードは格子状に配置される", () => {
		const frame = makeFrame("Test");
		frame.w = 2000;
		const board = makeBoard([frame]);
		const node1 = placeInFrame(board, frame, "c1");
		board.nodes.push(node1);
		const node2 = placeInFrame(board, frame, "c2");
		expect(node2.x).toBeGreaterThan(node1.x);
	});

	it("フレームが溢れたら高さを拡張する", () => {
		const frame: FrameNode = { ...makeFrame("Test"), w: 300, h: 300 };
		const board = makeBoard([frame]);
		// 1枚目を置いてframeに追加
		for (let i = 0; i < 5; i++) {
			const node = placeInFrame(board, frame, `c${i}`);
			board.nodes.push(node);
		}
		expect(frame.h).toBeGreaterThan(300);
	});
});

describe("placeNewCard", () => {
	it("group未指定でAI Inboxに配置", () => {
		const board = makeBoard([makeFrame("AI Inbox", true)]);
		const card = { id: "xyz", title: "test", type: "web" as const, tags: [], added: "", status: "unread" as const, source: "manual" as const };
		const { node } = placeNewCard(board, card);
		expect(node.card_id).toBe("xyz");
	});

	it("group指定でフレームに配置", () => {
		const board = makeBoard([makeFrame("Rust"), makeFrame("AI Inbox", true)]);
		const card = { id: "abc", title: "test", type: "web" as const, tags: [], added: "", status: "unread" as const, source: "manual" as const };
		const { node } = placeNewCard(board, card, "Rust");
		expect(node.card_id).toBe("abc");
	});

	it("存在しないgroupは新規フレームを作成", () => {
		const board = makeBoard([makeFrame("AI Inbox", true)]);
		const card = { id: "new", title: "test", type: "web" as const, tags: [], added: "", status: "unread" as const, source: "manual" as const };
		const { newFrame } = placeNewCard(board, card, "NewGroup");
		expect(newFrame?.label).toBe("NewGroup");
	});
});

describe("BoardRepository.isValidBoard", () => {
	it("正常なボードはtrue", () => {
		expect(BoardRepository.isValidBoard({ version: 1, nodes: [] })).toBe(true);
	});

	it("versionなしはfalse", () => {
		expect(BoardRepository.isValidBoard({ nodes: [] })).toBe(false);
	});

	it("nodesが配列でなければfalse", () => {
		expect(BoardRepository.isValidBoard({ version: 1, nodes: {} })).toBe(false);
	});

	it("nullはfalse", () => {
		expect(BoardRepository.isValidBoard(null)).toBe(false);
	});
});
