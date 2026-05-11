import type { Viewport } from "../Viewport";

export class PanZoom {
	private isPanning = false;
	private lastX = 0;
	private lastY = 0;

	constructor(
		private el: HTMLElement,
		private viewport: Viewport,
		private onUpdate: () => void
	) {
		this.onWheel = this.onWheel.bind(this);
		this.onPointerDown = this.onPointerDown.bind(this);
		this.onPointerMove = this.onPointerMove.bind(this);
		this.onPointerUp = this.onPointerUp.bind(this);
	}

	attach(): void {
		this.el.addEventListener("wheel", this.onWheel, { passive: false });
		this.el.addEventListener("pointerdown", this.onPointerDown);
		this.el.addEventListener("pointermove", this.onPointerMove);
		this.el.addEventListener("pointerup", this.onPointerUp);
		this.el.addEventListener("pointercancel", this.onPointerUp);
	}

	detach(): void {
		this.el.removeEventListener("wheel", this.onWheel);
		this.el.removeEventListener("pointerdown", this.onPointerDown);
		this.el.removeEventListener("pointermove", this.onPointerMove);
		this.el.removeEventListener("pointerup", this.onPointerUp);
		this.el.removeEventListener("pointercancel", this.onPointerUp);
	}

	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		if (e.ctrlKey || e.metaKey) {
			const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
			const rect = this.el.getBoundingClientRect();
			this.viewport.zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
		} else {
			this.viewport.pan(e.deltaX, e.deltaY);
		}
		this.onUpdate();
	}

	private onPointerDown(e: PointerEvent): void {
		if (e.button === 1 || (e.button === 0 && e.altKey)) {
			this.isPanning = true;
			this.lastX = e.clientX;
			this.lastY = e.clientY;
			this.el.setPointerCapture(e.pointerId);
			e.preventDefault();
		}
	}

	private onPointerMove(e: PointerEvent): void {
		if (!this.isPanning) return;
		const dx = e.clientX - this.lastX;
		const dy = e.clientY - this.lastY;
		this.viewport.pan(-dx, -dy);
		this.lastX = e.clientX;
		this.lastY = e.clientY;
		this.onUpdate();
	}

	private onPointerUp(e: PointerEvent): void {
		if (this.isPanning) {
			this.isPanning = false;
			this.el.releasePointerCapture(e.pointerId);
		}
	}
}
