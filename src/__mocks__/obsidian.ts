export class Notice {
	constructor(public message: string) {}
}

export class Plugin {}
export class ItemView {
	containerEl = { children: [null, { empty: () => {}, createEl: () => ({}), style: {} }] };
	constructor(public leaf: unknown) {}
	register(_: () => void) {}
	registerEvent(_: unknown) {}
}
export class WorkspaceLeaf {}
export class PluginSettingTab {
	containerEl = { empty: () => {}, createEl: () => ({}) };
	constructor(public app: unknown, public plugin: unknown) {}
}
export class Setting {
	constructor(_el: unknown) {}
	setName(_: string) { return this; }
	setDesc(_: string) { return this; }
	addText(_: unknown) { return this; }
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): T {
	return fn;
}

export function requestUrl(_opts: unknown): Promise<{ text: string }> {
	return Promise.resolve({ text: "" });
}
