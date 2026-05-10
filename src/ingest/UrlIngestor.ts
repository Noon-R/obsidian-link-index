import { App, requestUrl } from "obsidian";

export interface OgpResult {
	title: string;
	description?: string;
	favicon?: string;
	thumbnail?: string;
	domain: string;
}

export async function fetchOgp(url: string): Promise<OgpResult> {
	const domain = new URL(url).hostname;
	const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

	try {
		const res = await requestUrl({ url, method: "GET" });
		const html = res.text;

		const title =
			extractMeta(html, ["og:title", "twitter:title"]) ||
			html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
			domain;

		const description = extractMeta(html, [
			"og:description",
			"twitter:description",
			"description",
		]);
		const thumbnail = extractMeta(html, ["og:image", "twitter:image"]);

		return { title, description, favicon, thumbnail, domain };
	} catch {
		return { title: domain, favicon, domain };
	}
}

export async function downloadThumbnail(
	app: App,
	thumbnailUrl: string,
	cardId: string
): Promise<string | undefined> {
	const thumbDir = "LinkIndex/thumbnails";
	try {
		if (!(await app.vault.adapter.exists("LinkIndex"))) {
			await app.vault.adapter.mkdir("LinkIndex");
		}
		if (!(await app.vault.adapter.exists(thumbDir))) {
			await app.vault.adapter.mkdir(thumbDir);
		}

		const res = await requestUrl({ url: thumbnailUrl, method: "GET" });
		const ct = res.headers?.["content-type"] ?? "";
		const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
		const path = `${thumbDir}/${cardId}.${ext}`;
		await app.vault.adapter.writeBinary(path, res.arrayBuffer);
		return path;
	} catch {
		return undefined;
	}
}

function extractMeta(html: string, properties: string[]): string | undefined {
	for (const prop of properties) {
		const patterns = [
			new RegExp(
				`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
				"i"
			),
			new RegExp(
				`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`,
				"i"
			),
			new RegExp(
				`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`,
				"i"
			),
			new RegExp(
				`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`,
				"i"
			),
		];
		for (const re of patterns) {
			const m = html.match(re);
			if (m?.[1]) return m[1].trim();
		}
	}
	return undefined;
}
