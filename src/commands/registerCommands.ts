import type LinkIndexPlugin from "../../main";
import { CanvasView, VIEW_TYPE_LINK_INDEX } from "../canvas/CanvasView";

function getCanvasView(plugin: LinkIndexPlugin): CanvasView | undefined {
	const leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_LINK_INDEX)[0];
	return leaf?.view instanceof CanvasView ? leaf.view : undefined;
}

export function registerCommands(plugin: LinkIndexPlugin): void {
	plugin.addCommand({
		id: "open-link-index",
		name: "Link Index を開く",
		callback: () => plugin.activateView(),
	});

	plugin.addCommand({
		id: "quick-add-link",
		name: "リンクを追加...",
		hotkeys: [{ modifiers: ["Mod"], key: "n" }],
		callback: async () => {
			await plugin.activateView();
			getCanvasView(plugin)?.openQuickAdd();
		},
	});

	plugin.addCommand({
		id: "auto-layout",
		name: "自動レイアウト（タグでグルーピング）",
		hotkeys: [{ modifiers: ["Mod", "Shift"], key: "l" }],
		callback: async () => {
			await plugin.activateView();
			getCanvasView(plugin)?.runAutoLayout();
		},
	});

	plugin.addCommand({
		id: "fit-to-content",
		name: "全体を表示",
		hotkeys: [{ modifiers: [], key: "f" }],
		checkCallback: (checking) => {
			const view = getCanvasView(plugin);
			if (!view) return false;
			if (!checking) view.fitToContent();
			return true;
		},
	});
}
