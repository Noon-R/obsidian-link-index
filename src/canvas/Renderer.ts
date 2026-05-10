import type { Board, BoardNode, CardFrontmatter, CardNode, FrameNode, TextNode } from "../types";
import type { Viewport } from "./Viewport";
import type { LinkIndex } from "../domain/Index";
import type { ImageCache } from "./ImageCache";
import { FRAME_LABEL_H } from "../types";

function matchesQuery(card: CardFrontmatter, q: string): boolean {
	const lq = q.toLowerCase();
	return (
		card.title.toLowerCase().includes(lq) ||
		(card.description?.toLowerCase().includes(lq) ?? false) ||
		(card.url?.toLowerCase().includes(lq) ?? false) ||
		(card.domain?.toLowerCase().includes(lq) ?? false) ||
		card.tags.some((t) => t.toLowerCase().includes(lq))
	);
}

const CARD_RADIUS = 8;
const FRAME_RADIUS = 4;
const HANDLE_SIZE = 7;
const PAD = 12;

export interface SelectionBox {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
}

// ズームレベル別描画モード
type DrawMode = "dot" | "compact" | "normal" | "full";

function drawMode(zoom: number): DrawMode {
	if (zoom < 0.2)  return "dot";
	if (zoom < 0.45) return "compact";
	if (zoom < 0.8)  return "normal";
	return "full";
}

// CSS変数をキャッシュして getComputedStyle コールを最小化
let _cssCache: Record<string, string> | null = null;
function css(key: string): string {
	if (!_cssCache) {
		const s = getComputedStyle(document.body);
		_cssCache = {
			bg:       s.getPropertyValue("--background-primary").trim()          || "#1e1e1e",
			bgSec:    s.getPropertyValue("--background-secondary").trim()         || "#2a2a2a",
			border:   s.getPropertyValue("--background-modifier-border").trim()   || "#444",
			accent:   s.getPropertyValue("--interactive-accent").trim()           || "#7c6af7",
			textNorm: s.getPropertyValue("--text-normal").trim()                  || "#ddd",
			textMut:  s.getPropertyValue("--text-muted").trim()                   || "#888",
			grid:     s.getPropertyValue("--background-modifier-border").trim()   || "rgba(255,255,255,0.07)",
			font:     s.getPropertyValue("--font-interface").trim()               || "sans-serif",
			mono:     s.getPropertyValue("--font-monospace").trim()               || "monospace",
		};
	}
	return _cssCache[key] ?? "";
}

export function invalidateCssCache(): void {
	_cssCache = null;
}

export class Renderer {
	private ctx: CanvasRenderingContext2D;

	constructor(private canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Cannot get 2d context");
		this.ctx = ctx;
	}

	render(
		board: Board,
		viewport: Viewport,
		index: LinkIndex,
		imageCache: ImageCache,
		selectedIds: Set<string>,
		selBox?: SelectionBox | null,
		matchedCardIds?: Set<string> | null
	): void {
		const { width: cw, height: ch } = this.canvas;
		this.ctx.clearRect(0, 0, cw, ch);
		this.drawBackground(cw, ch, viewport);

		const { x: vx, y: vy, zoom } = viewport;
		this.ctx.save();
		this.ctx.scale(zoom, zoom);
		this.ctx.translate(-vx, -vy);

		const mode = drawMode(zoom);

		// 可視ワールド矩形を計算してカリング
		const visR = vx + cw / zoom;
		const visB = vy + ch / zoom;
		const isVis = (n: BoardNode) =>
			n.x < visR && n.x + n.w > vx && n.y < visB && n.y + n.h > vy;

		// 1パスで分類 + カリング
		const frames: FrameNode[] = [];
		const texts: TextNode[]   = [];
		const cards: CardNode[]   = [];
		for (const n of board.nodes) {
			if (!isVis(n)) continue;
			if (n.type === "frame")      frames.push(n as FrameNode);
			else if (n.type === "text")  texts.push(n as TextNode);
			else if (n.type === "card")  cards.push(n as CardNode);
		}

		// レイヤー順描画
		for (const n of frames) this.drawFrame(n, selectedIds, mode);
		for (const n of texts)  this.drawText(n, selectedIds);
		for (const n of cards) {
			const dimmed = matchedCardIds != null && !matchedCardIds.has(n.card_id);
			if (dimmed) { this.ctx.save(); this.ctx.globalAlpha = 0.12; }
			this.drawCard(n, index, imageCache, selectedIds, mode);
			if (dimmed) this.ctx.restore();
		}

		// 選択ハンドル（可視ノードのみ・最前面）
		for (const n of frames) { if (selectedIds.has(n.id)) this.drawResizeHandles(n); }
		for (const n of cards)  { if (selectedIds.has(n.id)) this.drawResizeHandles(n); }

		if (selBox) this.drawSelectionBox(selBox);
		this.ctx.restore();
	}

	// ─────────────── Background & Grid ───────────────

	private drawBackground(w: number, h: number, vp: Viewport): void {
		this.ctx.fillStyle = css("bg");
		this.ctx.fillRect(0, 0, w, h);

		const gs = 40 * vp.zoom;
		const ox = ((-vp.x * vp.zoom) % gs + gs) % gs;
		const oy = ((-vp.y * vp.zoom) % gs + gs) % gs;

		this.ctx.strokeStyle = css("grid");
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		for (let x = ox; x < w; x += gs) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); }
		for (let y = oy; y < h; y += gs) { this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); }
		this.ctx.stroke();
	}

	// ─────────────── Frame ───────────────

	private drawFrame(node: FrameNode, sel: Set<string>, mode: DrawMode): void {
		const { x, y, w, h, label, color, system } = node;
		const selected = sel.has(node.id);

		this.ctx.save();
		this.ctx.globalAlpha = 0.1;
		this.ctx.fillStyle = color;
		this.roundRect(x, y, w, h, FRAME_RADIUS);
		this.ctx.fill();
		this.ctx.restore();

		this.ctx.strokeStyle = selected ? "#fff" : color;
		this.ctx.lineWidth = selected ? 2 : 1.5;
		this.roundRect(x, y, w, h, FRAME_RADIUS);
		this.ctx.stroke();

		if (mode === "dot") return;

		// ラベル帯
		this.ctx.fillStyle = color;
		this.ctx.globalAlpha = 0.9;
		this.ctx.fillRect(x, y, w, FRAME_LABEL_H);
		this.ctx.globalAlpha = 1;
		this.ctx.fillStyle = "#fff";
		this.ctx.font = `bold 13px ${css("font")}`;
		this.ctx.textBaseline = "middle";
		this.ctx.fillText(`${system ? "📥 " : ""}${label}`, x + 12, y + FRAME_LABEL_H / 2);
	}

	// ─────────────── Card ───────────────

	private drawCard(
		node: CardNode,
		index: LinkIndex,
		imageCache: ImageCache,
		sel: Set<string>,
		mode: DrawMode
	): void {
		const { x, y, w, h } = node;
		const selected = sel.has(node.id);
		const card = index.get(node.card_id);

		// ── dot モード: ステータス色の小さな丸 ──
		if (mode === "dot") {
			const statusDot: Record<string, string> = {
				unread: "#666", reading: "#d4940a", done: "#4caf50", archive: "#444",
			};
			this.ctx.fillStyle = statusDot[card?.status ?? "unread"] ?? "#666";
			this.ctx.beginPath();
			this.ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, 0, Math.PI * 2);
			this.ctx.fill();
			if (selected) {
				this.ctx.strokeStyle = css("accent");
				this.ctx.lineWidth = 2;
				this.ctx.stroke();
			}
			return;
		}

		// ── 背景 & 枠 ──
		this.ctx.save();
		this.ctx.shadowColor = "rgba(0,0,0,0.35)";
		this.ctx.shadowBlur = selected ? 12 : 6;
		this.ctx.shadowOffsetY = 2;
		this.ctx.fillStyle = css("bgSec");
		this.roundRect(x, y, w, h, CARD_RADIUS);
		this.ctx.fill();
		this.ctx.restore();

		this.ctx.strokeStyle = selected ? css("accent") : css("border");
		this.ctx.lineWidth = selected ? 2 : 1;
		this.roundRect(x, y, w, h, CARD_RADIUS);
		this.ctx.stroke();

		if (!card) {
			this.ctx.fillStyle = css("textMut");
			this.ctx.font = `12px ${css("font")}`;
			this.ctx.textBaseline = "middle";
			this.ctx.fillText("読み込み中...", x + PAD, y + h / 2);
			return;
		}

		// ── compact モード: タイトルのみ ──
		if (mode === "compact") {
			this.ctx.fillStyle = css("textNorm");
			this.ctx.font = `bold 12px ${css("font")}`;
			this.ctx.textBaseline = "middle";
			const title = card.title.length > 28 ? card.title.slice(0, 27) + "…" : card.title;
			this.ctx.fillText(title, x + PAD, y + h / 2 - 4);
			// ステータスドット
			const sdot: Record<string, string> = {
				unread: "#666", reading: "#d4940a", done: "#4caf50", archive: "#444",
			};
			this.ctx.fillStyle = sdot[card.status] ?? "#666";
			this.ctx.beginPath();
			this.ctx.arc(x + w - PAD, y + h / 2 - 4, 4, 0, Math.PI * 2);
			this.ctx.fill();
			return;
		}

		// ── normal / full モード ──

		let contentY = y + PAD;

		// サムネイル（normal以上）
		if (card.thumbnail) {
			const bitmap = imageCache.get(card.thumbnail);
			const thumbH = Math.floor(h * 0.42);
			if (bitmap) {
				this.ctx.save();
				this.ctx.beginPath();
				this.roundRect(x + 1, y + 1, w - 2, thumbH, CARD_RADIUS);
				this.ctx.clip();
				// アスペクト比を保ちつつ中央トリミング
				const imgAspect = bitmap.width / bitmap.height;
				const boxAspect = (w - 2) / thumbH;
				let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
				if (imgAspect > boxAspect) {
					sw = bitmap.height * boxAspect;
					sx = (bitmap.width - sw) / 2;
				} else {
					sh = bitmap.width / boxAspect;
					sy = (bitmap.height - sh) / 2;
				}
				this.ctx.drawImage(bitmap, sx, sy, sw, sh, x + 1, y + 1, w - 2, thumbH);
				this.ctx.restore();
				contentY = y + thumbH + PAD * 0.75;
			} else {
				// ロード中プレースホルダー
				this.ctx.fillStyle = css("border");
				this.ctx.fillRect(x + 1, y + 1, w - 2, Math.floor(h * 0.42));
				this.ctx.fillStyle = css("textMut");
				this.ctx.font = `11px ${css("font")}`;
				this.ctx.textBaseline = "middle";
				this.ctx.textAlign = "center";
				this.ctx.fillText("⏳", x + w / 2, y + Math.floor(h * 0.21));
				this.ctx.textAlign = "start";
				contentY = y + Math.floor(h * 0.42) + PAD * 0.75;
			}
		}

		// ファビコン + ドメイン
		if (card.domain) {
			this.ctx.fillStyle = css("textMut");
			this.ctx.font = `10px ${css("mono")}`;
			this.ctx.textBaseline = "top";
			const domainText = card.domain.length > 32 ? card.domain.slice(0, 31) + "…" : card.domain;
			if (card.favicon) {
				const fav = imageCache.get(card.favicon);
				if (fav) {
					this.ctx.drawImage(fav, x + PAD, contentY, 12, 12);
					this.ctx.fillText(domainText, x + PAD + 16, contentY + 1);
				} else {
					this.ctx.fillText(domainText, x + PAD, contentY + 1);
				}
			} else {
				this.ctx.fillText(domainText, x + PAD, contentY + 1);
			}
			contentY += 16;
		}

		// タイトル
		const titleLines = mode === "full" ? 3 : 2;
		this.ctx.fillStyle = css("textNorm");
		this.ctx.font = `bold 13px ${css("font")}`;
		this.ctx.textBaseline = "top";
		this.wrapText(card.title, x + PAD, contentY, w - PAD * 2, 18, titleLines);
		contentY += titleLines * 18 + 4;

		// 説明文（full モードのみ）
		if (mode === "full" && card.description) {
			this.ctx.fillStyle = css("textMut");
			this.ctx.font = `11px ${css("font")}`;
			this.ctx.textBaseline = "top";
			this.wrapText(card.description, x + PAD, contentY, w - PAD * 2, 15, 2);
		}

		// ステータスバッジ（右下固定）
		const STATUS_COLORS: Record<string, string> = {
			unread: "#555", reading: "#d4940a", done: "#3c9440", archive: "#3a3a3a",
		};
		const sc = STATUS_COLORS[card.status] ?? "#555";
		const bw = 58, bh = 16;
		const bx = x + w - PAD - bw;
		const by = y + h - PAD - bh;
		this.ctx.fillStyle = sc;
		this.ctx.beginPath();
		this.ctx.roundRect(bx, by, bw, bh, 3);
		this.ctx.fill();
		this.ctx.fillStyle = "#fff";
		this.ctx.font = `10px ${css("font")}`;
		this.ctx.textBaseline = "middle";
		this.ctx.textAlign = "center";
		this.ctx.fillText(card.status, bx + bw / 2, by + bh / 2);
		this.ctx.textAlign = "start";
	}

	// ─────────────── Text node ───────────────

	private drawText(node: TextNode, sel: Set<string>): void {
		const { x, y, w, h, text } = node;
		if (sel.has(node.id)) {
			this.ctx.strokeStyle = "rgba(255,255,255,0.5)";
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash([4, 3]);
			this.roundRect(x, y, w, h, 4);
			this.ctx.stroke();
			this.ctx.setLineDash([]);
		}
		this.ctx.fillStyle = css("textNorm");
		this.ctx.font = `14px ${css("font")}`;
		this.ctx.textBaseline = "top";
		this.wrapText(text, x + 8, y + 8, w - 16, 20, Math.floor((h - 16) / 22));
	}

	// ─────────────── Resize handles ───────────────

	private drawResizeHandles(node: CardNode | FrameNode): void {
		const { x, y, w, h } = node;
		const hs = HANDLE_SIZE;
		const handles = [
			{ hx: x + w - hs / 2, hy: y + h - hs / 2 },       // SE
			{ hx: x + w - hs / 2, hy: y + h / 2 - hs / 2 },    // E
			{ hx: x + w / 2 - hs / 2, hy: y + h - hs / 2 },    // S
		];
		this.ctx.fillStyle = "#fff";
		this.ctx.strokeStyle = "#555";
		this.ctx.lineWidth = 1;
		for (const { hx, hy } of handles) {
			this.ctx.beginPath();
			this.ctx.rect(hx, hy, hs, hs);
			this.ctx.fill();
			this.ctx.stroke();
		}
	}

	// ─────────────── Selection box ───────────────

	private drawSelectionBox(box: SelectionBox): void {
		const x = Math.min(box.startX, box.endX);
		const y = Math.min(box.startY, box.endY);
		const w = Math.abs(box.endX - box.startX);
		const h = Math.abs(box.endY - box.startY);
		if (w < 2 && h < 2) return;

		this.ctx.save();
		this.ctx.fillStyle = "rgba(124,106,247,0.08)";
		this.ctx.fillRect(x, y, w, h);
		this.ctx.strokeStyle = "rgba(124,106,247,0.8)";
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash([5, 3]);
		this.ctx.strokeRect(x, y, w, h);
		this.ctx.setLineDash([]);
		this.ctx.restore();
	}

	// ─────────────── Helpers ───────────────

	private wrapText(text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number): void {
		const words = text.split(" ");
		let line = "";
		let count = 0;
		for (const word of words) {
			const test = line ? `${line} ${word}` : word;
			if (this.ctx.measureText(test).width > maxW && line) {
				if (count >= maxLines - 1) {
					this.ctx.fillText(line + "…", x, y + count * lineH);
					return;
				}
				this.ctx.fillText(line, x, y + count * lineH);
				line = word;
				count++;
			} else {
				line = test;
			}
		}
		if (line && count < maxLines) this.ctx.fillText(line, x, y + count * lineH);
	}

	private roundRect(x: number, y: number, w: number, h: number, r: number): void {
		this.ctx.beginPath();
		this.ctx.moveTo(x + r, y);
		this.ctx.lineTo(x + w - r, y);
		this.ctx.arcTo(x + w, y, x + w, y + r, r);
		this.ctx.lineTo(x + w, y + h - r);
		this.ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
		this.ctx.lineTo(x + r, y + h);
		this.ctx.arcTo(x, y + h, x, y + h - r, r);
		this.ctx.lineTo(x, y + r);
		this.ctx.arcTo(x, y, x + r, y, r);
		this.ctx.closePath();
	}
}
