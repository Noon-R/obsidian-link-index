import type { App } from "obsidian";

/**
 * PDF の1ページ目をサムネイルPNGに変換して vault に保存する。
 *
 * pdfjs-dist が利用可能な環境でのみ動作する。
 * 利用するには: npm install pdfjs-dist@3
 * その後 esbuild.config.mjs の external から 'pdfjs-dist' を除外してリビルド。
 *
 * 利用不可の場合は undefined を返し、呼び出し元はフォールバックする。
 */
export async function ingestPdf(
	app: App,
	vaultRelativePath: string,
	cardId: string
): Promise<string | undefined> {
	const thumbDir = "LinkIndex/thumbnails";
	const thumbPath = `${thumbDir}/${cardId}.png`;

	try {
		// pdfjs-dist が global にあるか（Obsidian が内部でロード済みの場合）、
		// または Electron の require 経由で取得を試みる。
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const g = globalThis as Record<string, any>;
		const pdfjsLib =
			g["pdfjs-dist"] ??
			g["pdfjsLib"] ??
			// Electron 環境での動的 require（node_modules に存在する場合のみ有効）
			(typeof g["require"] === "function"
				? (() => {
						try { return g["require"]("pdfjs-dist/legacy/build/pdf"); } catch { return undefined; }
					})()
				: undefined);

		if (!pdfjsLib?.getDocument) return undefined;

		pdfjsLib.GlobalWorkerOptions.workerSrc = "";

		const rawData = await app.vault.adapter.readBinary(vaultRelativePath);
		const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(rawData) }).promise;
		const page = await pdf.getPage(1);

		const scale = 1.5;
		const viewport = page.getViewport({ scale });
		const oc = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
		const ctx = oc.getContext("2d") as unknown as CanvasRenderingContext2D;

		await page.render({ canvasContext: ctx, viewport }).promise;

		const blob = await oc.convertToBlob({ type: "image/png" });
		const buf = await blob.arrayBuffer();

		if (!(await app.vault.adapter.exists("LinkIndex"))) {
			await app.vault.adapter.mkdir("LinkIndex");
		}
		if (!(await app.vault.adapter.exists(thumbDir))) {
			await app.vault.adapter.mkdir(thumbDir);
		}
		await app.vault.adapter.writeBinary(thumbPath, buf);
		return thumbPath;
	} catch {
		return undefined;
	}
}
