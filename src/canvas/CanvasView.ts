import { ItemView, Menu, Notice, WorkspaceLeaf, debounce } from "obsidian";
import type LinkIndexPlugin from "../../main";
import type { Board, CardNode, CardStatus, FrameNode } from "../types";
import { CARD_W, CARD_H } from "../types";
import { Viewport } from "./Viewport";
import { Renderer, invalidateCssCache } from "./Renderer";
import type { SelectionBox } from "./Renderer";
import { ImageCache } from "./ImageCache";
import { SearchOverlay } from "./SearchOverlay";
import { FrameEditModal } from "./FrameEditModal";
import { hitTest, nodesInBox } from "./HitTest";
import { PanZoom } from "./interactions/PanZoom";
import { Selection } from "./interactions/Selection";
import { DragMove } from "./interactions/DragMove";
import { Resize } from "./interactions/Resize";
import { PasteDrop } from "./interactions/PasteDrop";
import { QuickAddModal } from "./QuickAddModal";
import { BoardRepository } from "../domain/BoardRepository";
import { CardRepository } from "../domain/CardRepository";
import { LinkIndex } from "../domain/Index";
import { placeCenterViewport } from "../domain/Layout";
import { autoLayout } from "../domain/AutoLayout";
import { fetchOgp, downloadThumbnail } from "../ingest/UrlIngestor";
import { normalizePath } from "../ingest/PathNormalizer";
import { ingestPdf } from "../ingest/PdfIngestor";

export const VIEW_TYPE_LINK_INDEX = "link-index-canvas";

const CURSOR: Record<string, string> = {
	se: "se-resize", e: "ew-resize", s: "ns-resize",
	node: "grab", dragging: "grabbing", none: "default",
};

export class CanvasView extends ItemView {
	private canvas!: HTMLCanvasElement;
	private container!: HTMLElement;
	private viewport: Viewport = new Viewport();
	private renderer!: Renderer;
	private imageCache!: ImageCache;
	private searchOverlay!: SearchOverlay;
	private board: Board | null = null;
	private index: LinkIndex;
	private selection: Selection = new Selection();
	private dragMove: DragMove = new DragMove();
	private resize: Resize = new Resize();
	private panZoom!: PanZoom;
	private pasteDrop!: PasteDrop;
	private boardRepo: BoardRepository;
	private cardRepo: CardRepository;
	private rafId: number | null = null;
	private dirty = false;
	private selBox: SelectionBox | null = null;
	private filterQuery = "";
	private matchedCardIds: Set<string> | null = null;
	private lastFilterQuery = "";
	private _ownSaveCount = 0;

	private readonly saveDebounced = debounce(async () => {
		if (this.board) {
			this.board.viewport = this.viewport.toState();
			await this.boardRepo.save(this.board);
			this._ownSaveCount++;
		}
	}, 200);

	constructor(leaf: WorkspaceLeaf, private plugin: LinkIndexPlugin) {
		super(leaf);
		this.boardRepo = new BoardRepository(this.app);
		this.cardRepo = new CardRepository(this.app);
		this.index = new LinkIndex(this.app);
	}

	getViewType(): string { return VIEW_TYPE_LINK_INDEX; }
	getDisplayText(): string { return "Link Index"; }
	getIcon(): string { return "network"; }

	async onOpen(): Promise<void> {
		this.container = this.containerEl.children[1] as HTMLElement;
		this.container.empty();
		this.container.style.padding = "0";
		this.container.style.overflow = "hidden";
		this.container.style.position = "relative";

		this.canvas = this.container.createEl("canvas");
		this.canvas.style.display = "block";
		this.canvas.style.width = "100%";
		this.canvas.style.height = "100%";
		this.canvas.tabIndex = 0;

		this.renderer = new Renderer(this.canvas);
		this.imageCache = new ImageCache(this.app, () => this.scheduleRender());
		this.searchOverlay = new SearchOverlay(
			this.container,
			(q) => { this.filterQuery = q; this.updateSearchCount(); this.scheduleRender(); },
			() => { this.filterQuery = ""; this.lastFilterQuery = ""; this.matchedCardIds = null; this.scheduleRender(); }
		);

		this.panZoom = new PanZoom(this.canvas, this.viewport, () => {
			this.scheduleRender();
			this.saveDebounced();
		});
		this.panZoom.attach();

		this.pasteDrop = new PasteDrop(
			this.canvas,
			(url, sx, sy) => this.addFromUrl(url, sx, sy),
			(paths, sx, sy) => this.addFromFiles(paths, sx, sy)
		);
		this.pasteDrop.attach();

		this.canvas.addEventListener("pointerdown", this.onPointerDown.bind(this));
		this.canvas.addEventListener("pointermove", this.onPointerMove.bind(this));
		this.canvas.addEventListener("pointerup", this.onPointerUp.bind(this));
		this.canvas.addEventListener("keydown", this.onKeyDown.bind(this));
		this.canvas.addEventListener("dblclick", this.onDblClick.bind(this));
		this.canvas.addEventListener("contextmenu", this.onContextMenu.bind(this));

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				invalidateCssCache();
				this.scheduleRender();
			})
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file.path === "LinkIndex/board.json") {
					if (this._ownSaveCount > 0) {
						this._ownSaveCount--;
						return; // 自身の保存によるイベントはスキップ
					}
					this.boardRepo.load().then((b) => { this.board = b; this.scheduleRender(); });
				} else if (file.path.startsWith("LinkIndex/thumbnails/")) {
					this.imageCache.invalidate(file.path);
					this.scheduleRender();
				} else {
					this.index.onModify(file as Parameters<typeof this.index.onModify>[0]);
					this.lastFilterQuery = ""; // インデックス変更時に検索キャッシュを無効化
					this.scheduleRender();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.index.onDelete(file as Parameters<typeof this.index.onDelete>[0]);
				this.lastFilterQuery = "";
				this.scheduleRender();
			})
		);

		const ro = new ResizeObserver(() => this.onResize());
		ro.observe(this.canvas);
		this.register(() => ro.disconnect());

		await this.index.load();
		this.board = await this.boardRepo.load();
		this.viewport.fromState(this.board.viewport);

		// インデックスにないカードノードを復旧または削除
		await this.recoverOrphanedNodes();

		this.onResize();
		this.scheduleRender();
	}

	async onClose(): Promise<void> {
		this.panZoom.detach();
		this.pasteDrop.detach();
		this.imageCache.destroy();
		this.searchOverlay.destroy();
		if (this.rafId !== null) cancelAnimationFrame(this.rafId);
		if (this.board) {
			this.board.viewport = this.viewport.toState();
			await this.boardRepo.save(this.board);
		}
	}

	onResize(): void {
		const rect = this.canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		this.canvas.width = rect.width;
		this.canvas.height = rect.height;
		this.scheduleRender();
	}

	// ────────────────────────────── カード追加 ──────────────────────────────

	async addFromUrl(url: string, sx?: number, sy?: number): Promise<void> {
		if (!this.board) return;
		const notice = new Notice("リンクを追加中...", 0);
		try {
			const ogp = await fetchOgp(url);
			const card = await this.cardRepo.create({
				type: "web", url,
				title: ogp.title, description: ogp.description,
				favicon: ogp.favicon, domain: ogp.domain,
				tags: [], source: "manual",
			});
			this.board.nodes.push(this.makeCardNode(card.id, sx, sy));
			this.index.set(card);
			this.saveDebounced();
			this.scheduleRender();
			notice.hide();
			new Notice(`"${card.title}" を追加しました`);

			if (ogp.thumbnail) {
				void downloadThumbnail(this.app, ogp.thumbnail, card.id).then(async (p) => {
					if (!p) return;
					await this.cardRepo.update(card.id, { thumbnail: p });
					const up = await this.cardRepo.read(card.id);
					if (up) { this.index.set(up); this.scheduleRender(); }
				});
			}
		} catch (e) {
			notice.hide();
			new Notice(`追加に失敗しました: ${String(e)}`);
		}
	}

	async addFromFiles(paths: string[], sx?: number, sy?: number): Promise<void> {
		if (!this.board) return;
		const vaultBase = (this.app.vault.adapter as unknown as { basePath?: string }).basePath ?? "";
		let offsetY = 0;
		for (const fp of paths) {
			const norm = normalizePath(fp, vaultBase);
			const card = await this.cardRepo.create({
				type: norm.type, path: norm.path,
				title: norm.title, tags: [],
				mime: norm.mime, source: "manual",
			});
			this.board.nodes.push(this.makeCardNode(card.id, sx, sy !== undefined ? sy + offsetY : undefined));
			this.index.set(card);
			offsetY += CARD_H + 16;

			if (norm.mime === "application/pdf") {
				void ingestPdf(this.app, norm.path, card.id).then(async (p) => {
					if (!p) return;
					await this.cardRepo.update(card.id, { thumbnail: p });
					const up = await this.cardRepo.read(card.id);
					if (up) { this.index.set(up); this.scheduleRender(); }
				});
			}
		}
		this.saveDebounced();
		this.scheduleRender();
		new Notice(`${paths.length} 件追加しました`);
	}

	openQuickAdd(): void {
		new QuickAddModal(this.app, (v) => {
			if (/^https?:\/\//.test(v)) void this.addFromUrl(v);
			else void this.addFromFiles([v]);
		}).open();
	}

	// ────────────────────────────── フレーム操作 ──────────────────────────────

	private createFrame(sx: number, sy: number): void {
		if (!this.board) return;
		const { x, y } = this.viewport.screenToWorld(sx, sy);
		const frame: FrameNode = {
			id: `n_frame_${Date.now()}`,
			type: "frame", label: "新しいフレーム",
			x: x - 400, y: y - 200,
			w: 800, h: 500, color: "#88aaff",
		};
		this.board.nodes.push(frame);
		this.saveDebounced();
		this.scheduleRender();
		this.openFrameEdit(frame);
	}

	private openFrameEdit(frame: FrameNode): void {
		new FrameEditModal(this.app, frame, (label, color) => {
			frame.label = label;
			frame.color = color;
			this.saveDebounced();
			this.scheduleRender();
		}).open();
	}

	// ────────────────────────────── 自動レイアウト ──────────────────────────────

	runAutoLayout(): void {
		if (!this.board) return;
		autoLayout(this.board, this.index);
		this.saveDebounced();
		this.fitToContent();
		new Notice("自動レイアウトを適用しました");
	}

	// ────────────────────────────── Render ──────────────────────────────

	private scheduleRender(): void {
		this.dirty = true;
		if (this.rafId !== null) return;
		this.rafId = requestAnimationFrame(() => {
			this.rafId = null;
			if (this.dirty) { this.dirty = false; this.doRender(); }
		});
	}

	private updateMatched(): void {
		if (this.filterQuery === this.lastFilterQuery) return;
		this.lastFilterQuery = this.filterQuery;
		this.matchedCardIds = this.filterQuery
			? new Set(this.index.search(this.filterQuery).map((c) => c.id))
			: null;
	}

	private doRender(): void {
		if (!this.board) return;
		this.updateMatched();
		this.renderer.render(
			this.board, this.viewport, this.index, this.imageCache,
			this.selection.getIds(), this.selBox,
			this.matchedCardIds
		);
	}

	private updateSearchCount(): void {
		if (!this.board || !this.filterQuery) return;
		this.updateMatched();
		const total = this.board.nodes.filter((n) => n.type === "card").length;
		this.searchOverlay.setCount(this.matchedCardIds?.size ?? 0, total);
	}

	// ────────────────────────────── Context Menu ──────────────────────────────

	private onContextMenu(e: MouseEvent): void {
		e.preventDefault();
		if (!this.board) return;

		const { sx, sy } = this.screenXY(e);
		const hit = hitTest(this.board.nodes, this.viewport, sx, sy);
		const menu = new Menu();

		if (hit.kind === "node" && hit.node.type === "frame") {
			const frame = hit.node as FrameNode;
			if (!frame.system) {
				menu.addItem((i) =>
					i.setTitle("フレームを編集").setIcon("pencil")
						.onClick(() => this.openFrameEdit(frame))
				);
			}
			menu.addItem((i) =>
				i.setTitle("フレーム内を全選択").setIcon("check-square")
					.onClick(() => {
						this.board!.nodes
							.filter((n) => n.type === "card" &&
								(n as CardNode).x >= frame.x &&
								(n as CardNode).x + (n as CardNode).w <= frame.x + frame.w &&
								(n as CardNode).y >= frame.y &&
								(n as CardNode).y + (n as CardNode).h <= frame.y + frame.h)
							.forEach((n) => this.selection.add(n.id));
						this.scheduleRender();
					})
			);
			if (!frame.system) {
				menu.addSeparator();
				menu.addItem((i) =>
					i.setTitle("フレームを削除").setIcon("trash")
						.onClick(() => { this.selection.set(frame.id); this.deleteSelected(); })
				);
			}

		} else if (hit.kind === "node" && hit.node.type === "card") {
			const cardNode = hit.node as CardNode;
			const card = this.index.get(cardNode.card_id);

			if (card?.url) {
				menu.addItem((i) =>
					i.setTitle("ブラウザで開く").setIcon("external-link")
						.onClick(() => window.open(card.url, "_blank"))
				);
			}
			if (card?.type === "vault-note" && card.path) {
				menu.addItem((i) =>
					i.setTitle("Obsidianで開く").setIcon("file-text")
						.onClick(() => this.app.workspace.openLinkText(card.path!, "", false))
				);
			}

			// ステータス変更（フラット項目）
			if (card) {
				const statuses: CardStatus[] = ["unread", "reading", "done", "archive"];
				for (const st of statuses) {
					menu.addItem((si) =>
						si.setTitle((st === card.status ? "✓ " : "   ") + st)
							.onClick(async () => {
								await this.cardRepo.update(cardNode.card_id, { status: st });
								const up = await this.cardRepo.read(cardNode.card_id);
								if (up) { this.index.set(up); this.scheduleRender(); }
							})
					);
				}
			}

			menu.addSeparator();
			menu.addItem((i) =>
				i.setTitle("削除").setIcon("trash")
					.onClick(() => { this.selection.set(hit.node.id); this.deleteSelected(); })
			);

		} else {
			// 空白エリア
			menu.addItem((i) =>
				i.setTitle("リンクを追加...").setIcon("plus")
					.onClick(() => this.openQuickAdd())
			);
			menu.addItem((i) =>
				i.setTitle("フレームを作成").setIcon("square")
					.onClick(() => this.createFrame(sx, sy))
			);
			menu.addSeparator();
			menu.addItem((i) =>
				i.setTitle("自動レイアウト").setIcon("layout-grid")
					.onClick(() => this.runAutoLayout())
			);
			menu.addItem((i) =>
				i.setTitle("全体を表示 (F)").setIcon("maximize")
					.onClick(() => this.fitToContent())
			);
		}

		menu.showAtMouseEvent(e);
	}

	// ────────────────────────────── Pointer ──────────────────────────────

	private onPointerDown(e: PointerEvent): void {
		if (e.button !== 0 || e.altKey) return;
		if (!this.board) return;

		const { sx, sy } = this.screenXY(e);
		const world = this.viewport.screenToWorld(sx, sy);
		const hit = hitTest(this.board.nodes, this.viewport, sx, sy);

		if (hit.kind === "resize") {
			if (!this.selection.has(hit.node.id)) this.selection.set(hit.node.id);
			this.resize.start(hit.node, hit.edge, world.x, world.y);
			this.canvas.style.cursor = CURSOR[hit.edge];
		} else if (hit.kind === "node") {
			if (e.shiftKey) this.selection.toggle(hit.node.id);
			else if (!this.selection.has(hit.node.id)) this.selection.set(hit.node.id);
			this.dragMove.start(this.selection.getNodes(this.board.nodes), world.x, world.y);
			this.canvas.style.cursor = CURSOR.dragging;
		} else {
			if (!e.shiftKey) this.selection.clear();
			this.selBox = { startX: world.x, startY: world.y, endX: world.x, endY: world.y };
		}

		this.canvas.setPointerCapture(e.pointerId);
		this.scheduleRender();
	}

	private onPointerMove(e: PointerEvent): void {
		const { sx, sy } = this.screenXY(e);
		const world = this.viewport.screenToWorld(sx, sy);

		if (this.resize.active) {
			this.resize.move(world.x, world.y);
			this.scheduleRender();
			return;
		}
		if (this.dragMove.active && this.board) {
			this.dragMove.move(this.selection.getNodes(this.board.nodes), world.x, world.y);
			this.scheduleRender();
			return;
		}
		if (this.selBox && this.board) {
			this.selBox.endX = world.x;
			this.selBox.endY = world.y;
			const minX = Math.min(this.selBox.startX, world.x);
			const maxX = Math.max(this.selBox.startX, world.x);
			const minY = Math.min(this.selBox.startY, world.y);
			const maxY = Math.max(this.selBox.startY, world.y);
			this.selection.clear();
			nodesInBox(this.board.nodes, minX, minY, maxX, maxY)
				.forEach((id) => this.selection.add(id));
			this.scheduleRender();
			return;
		}
		if (this.board) {
			const hit = hitTest(this.board.nodes, this.viewport, sx, sy);
			this.canvas.style.cursor =
				hit.kind === "resize" ? CURSOR[hit.edge] :
				hit.kind === "node"   ? CURSOR.node : CURSOR.none;
		}
	}

	private onPointerUp(e: PointerEvent): void {
		const wasResize = this.resize.end();
		const wasDrag   = this.dragMove.end();
		const wasBox    = this.selBox !== null;
		if (wasResize || wasDrag) this.saveDebounced();
		this.selBox = null;
		this.canvas.style.cursor = CURSOR.none;
		if (wasBox || wasResize || wasDrag) this.scheduleRender();
		this.canvas.releasePointerCapture(e.pointerId);
	}

	private onDblClick(e: MouseEvent): void {
		if (!this.board) return;
		const { sx, sy } = this.screenXY(e);
		const hit = hitTest(this.board.nodes, this.viewport, sx, sy);
		if (hit.kind !== "node" || hit.node.type !== "card") return;
		const card = this.index.get((hit.node as CardNode).card_id);
		if (!card) return;
		if (card.url) window.open(card.url, "_blank");
		else if (card.type === "vault-note" && card.path)
			this.app.workspace.openLinkText(card.path, "", false);
	}

	// ────────────────────────────── Keyboard ──────────────────────────────

	private onKeyDown(e: KeyboardEvent): void {
		if (!this.board) return;

		if (e.key === "Delete" || e.key === "Backspace") {
			this.deleteSelected();
		} else if (e.key === "f" || e.key === "F") {
			this.fitToContent();
		} else if (e.key === "Escape") {
			if (this.searchOverlay.isVisible) {
				this.searchOverlay.hide();
				this.filterQuery = "";
			} else {
				this.selection.clear();
			}
			this.scheduleRender();
		} else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
			e.preventDefault();
			this.board.nodes.forEach((n) => this.selection.add(n.id));
			this.scheduleRender();
		} else if ((e.ctrlKey || e.metaKey) && e.key === "n") {
			e.preventDefault();
			this.openQuickAdd();
		} else if ((e.ctrlKey || e.metaKey) && e.key === "f") {
			e.preventDefault();
			if (this.searchOverlay.isVisible) {
				this.searchOverlay.hide();
				this.filterQuery = "";
				this.scheduleRender();
			} else {
				this.searchOverlay.show();
			}
		} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "L") {
			e.preventDefault();
			this.runAutoLayout();
		}
	}

	// ────────────────────────────── Public API ──────────────────────────────

	private async recoverOrphanedNodes(): Promise<void> {
		if (!this.board) return;
		const orphanIds = new Set<string>();
		for (const node of this.board.nodes) {
			if (node.type !== "card") continue;
			const cn = node as CardNode;
			if (!this.index.get(cn.card_id)) {
				const card = await this.cardRepo.read(cn.card_id);
				if (card) {
					this.index.set(card);
				} else {
					orphanIds.add(cn.id);
				}
			}
		}
		if (orphanIds.size > 0) {
			this.board.nodes = this.board.nodes.filter((n) => !orphanIds.has(n.id));
			await this.boardRepo.save(this.board);
		}
	}

	fitToContent(): void {
		if (!this.board || this.board.nodes.length === 0) return;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const n of this.board.nodes) {
			const nd = n as { x: number; y: number; w: number; h: number };
			minX = Math.min(minX, nd.x);       minY = Math.min(minY, nd.y);
			maxX = Math.max(maxX, nd.x + nd.w); maxY = Math.max(maxY, nd.y + nd.h);
		}
		const rect = this.canvas.getBoundingClientRect();
		this.viewport.fitToContent(minX, minY, maxX, maxY, rect.width, rect.height);
		this.scheduleRender();
	}

	private deleteSelected(): void {
		if (!this.board) return;
		const ids = this.selection.getIds();
		this.board.nodes = this.board.nodes.filter(
			(n) => !ids.has(n.id) || (n.type === "frame" && (n as FrameNode).system)
		);
		this.selection.clear();
		this.saveDebounced();
		this.scheduleRender();
	}

	private makeCardNode(cardId: string, sx?: number, sy?: number): CardNode {
		if (sx !== undefined && sy !== undefined) {
			const { x, y } = this.viewport.screenToWorld(sx, sy);
			return { id: `n_${cardId}`, type: "card", card_id: cardId,
				x: x - CARD_W / 2, y: y - CARD_H / 2, w: CARD_W, h: CARD_H, z: 1 };
		}
		return placeCenterViewport(this.viewport.toState(), cardId);
	}

	private screenXY(e: PointerEvent | MouseEvent): { sx: number; sy: number } {
		const rect = this.canvas.getBoundingClientRect();
		return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
	}
}
