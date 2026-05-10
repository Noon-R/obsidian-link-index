import type { BoardNode } from "../../types";

export class Selection {
	private ids: Set<string> = new Set();

	get size(): number { return this.ids.size; }

	has(id: string): boolean { return this.ids.has(id); }

	getIds(): Set<string> { return new Set(this.ids); }

	set(id: string): void {
		this.ids.clear();
		this.ids.add(id);
	}

	toggle(id: string): void {
		if (this.ids.has(id)) this.ids.delete(id);
		else this.ids.add(id);
	}

	add(id: string): void {
		this.ids.add(id);
	}

	clear(): void {
		this.ids.clear();
	}

	getNodes(nodes: BoardNode[]): BoardNode[] {
		return nodes.filter((n) => this.ids.has(n.id));
	}
}
