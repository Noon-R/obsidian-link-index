import type { Viewport as ViewportState } from "../types";

export class Viewport {
	private state: ViewportState;

	constructor(initial?: Partial<ViewportState>) {
		this.state = {
			x: initial?.x ?? 0,
			y: initial?.y ?? 0,
			zoom: initial?.zoom ?? 1.0,
		};
	}

	get x(): number { return this.state.x; }
	get y(): number { return this.state.y; }
	get zoom(): number { return this.state.zoom; }

	toState(): ViewportState {
		return { ...this.state };
	}

	fromState(s: ViewportState): void {
		this.state = { ...s };
	}

	screenToWorld(sx: number, sy: number): { x: number; y: number } {
		return {
			x: sx / this.state.zoom + this.state.x,
			y: sy / this.state.zoom + this.state.y,
		};
	}

	worldToScreen(wx: number, wy: number): { x: number; y: number } {
		return {
			x: (wx - this.state.x) * this.state.zoom,
			y: (wy - this.state.y) * this.state.zoom,
		};
	}

	pan(dx: number, dy: number): void {
		this.state.x -= dx / this.state.zoom;
		this.state.y -= dy / this.state.zoom;
	}

	zoomAt(factor: number, cx: number, cy: number): void {
		const MIN = 0.1;
		const MAX = 4.0;
		const newZoom = Math.max(MIN, Math.min(MAX, this.state.zoom * factor));
		const ratio = newZoom / this.state.zoom;
		this.state.x = cx / newZoom - (cx / this.state.zoom - this.state.x) / ratio * ratio;
		this.state.y = cy / newZoom - (cy / this.state.zoom - this.state.y) / ratio * ratio;
		this.state.zoom = newZoom;
	}

	fitToContent(worldMinX: number, worldMinY: number, worldMaxX: number, worldMaxY: number, viewW: number, viewH: number): void {
		const padPx = 80;
		const contentW = worldMaxX - worldMinX;
		const contentH = worldMaxY - worldMinY;
		if (contentW <= 0 || contentH <= 0) return;
		const zoom = Math.min(
			(viewW - padPx * 2) / contentW,
			(viewH - padPx * 2) / contentH,
			2.0
		);
		this.state.zoom = zoom;
		this.state.x = worldMinX - padPx / zoom;
		this.state.y = worldMinY - padPx / zoom;
	}
}
