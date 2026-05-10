export type PathType = "vault-note" | "local-file";

export interface NormalizedPath {
	type: PathType;
	path: string;
	title: string;
	mime?: string;
}

export function normalizePath(rawPath: string, vaultPath: string): NormalizedPath {
	const normalized = rawPath.replace(/\\/g, "/");
	const vaultNorm = vaultPath.replace(/\\/g, "/");

	if (normalized.startsWith(vaultNorm)) {
		const rel = normalized.slice(vaultNorm.length).replace(/^\//, "");
		const title = rel.split("/").pop()?.replace(/\.md$/, "") ?? rel;
		return { type: "vault-note", path: rel, title };
	}

	const title = normalized.split("/").pop() ?? normalized;
	const mime = guessMime(title);
	return { type: "local-file", path: normalized, title, mime };
}

function guessMime(filename: string): string | undefined {
	const ext = filename.split(".").pop()?.toLowerCase();
	const map: Record<string, string> = {
		pdf: "application/pdf",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
		mp4: "video/mp4",
		mp3: "audio/mpeg",
		txt: "text/plain",
		md: "text/markdown",
	};
	return ext ? map[ext] : undefined;
}
