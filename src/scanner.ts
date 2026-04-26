import { readdirSync, existsSync } from "fs";
import { join, resolve } from "path";

/** Directories excluded from recursive .sdr search (system/KOReader internals). */
const EXCLUDE_DIRS = new Set([
	".kobo",
	".kobo-images",
	"koreader",
	".fseventsd",
	".Trashes",
	".Spotlight-V100",
	".Trash",
	"RECYCLED",
	"RECYCLER",
	"$Recycle.Bin",
	"System Volume Information",
]);

// KOReader installation prefixes vary by device:
// - Kobo: .adds/koreader/
// - PocketBook: applications/koreader/
// - Kindle / generic: koreader/
const KOREADER_PREFIXES = [
	"koreader",
	join(".adds", "koreader"),
	join("applications", "koreader"),
];

function findSdrDirs(dir: string, exclude: Set<string>): string[] {
	const results: string[] = [];
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return results;
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const full = join(dir, entry.name);
		if (entry.name.endsWith(".sdr")) {
			results.push(resolve(full));
		} else if (!exclude.has(entry.name)) {
			results.push(...findSdrDirs(full, exclude));
		}
	}
	return results;
}

/**
 * Scan a mounted KOReader device for `.sdr` metadata directories.
 *
 * Three-phase scan per KOReader prefix, deduplicated by resolved path:
 * 1. `{prefix}/docsettings` — centralized storage mode
 * 2. `{prefix}/hashdocsettings` — hash-based storage mode
 * 3. Recursive scan from mount root — per-book `.sdr` alongside the ebook file
 */
export function scan(mountPath: string): string[] {
	const found = new Set<string>();

	for (const prefix of KOREADER_PREFIXES) {
		const docsettings = join(mountPath, prefix, "docsettings");
		if (existsSync(docsettings)) {
			for (const p of findSdrDirs(docsettings, new Set())) found.add(p);
		}

		const hashdocsettings = join(mountPath, prefix, "hashdocsettings");
		if (existsSync(hashdocsettings)) {
			for (const p of findSdrDirs(hashdocsettings, new Set()))
				found.add(p);
		}
	}

	for (const p of findSdrDirs(mountPath, EXCLUDE_DIRS)) found.add(p);

	return [...found];
}
