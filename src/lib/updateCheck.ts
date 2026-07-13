/**
 * Startup update check: one GET to the GitHub releases API (at most once per
 * day), compared against the running version. Pure helpers here; the fetch +
 * notification live in App.tsx. Disabled via the `updateCheck` setting.
 */

export const RELEASES_API =
	"https://api.github.com/repos/dansreis/speclens/releases/latest";
export const RELEASES_PAGE =
	"https://github.com/dansreis/speclens/releases/latest";

/** Once per day is plenty - this isn't a security-patch channel. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** "v1.2.3" / "1.2.3" → [1,2,3]; null when unparsable. */
export function parseVersion(tag: string): [number, number, number] | null {
	const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
	if (!m) return null;
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isNewerVersion(latestTag: string, current: string): boolean {
	const latest = parseVersion(latestTag);
	const cur = parseVersion(current);
	if (!latest || !cur) return false;
	for (let i = 0; i < 3; i++) {
		if (latest[i] !== cur[i]) return latest[i] > cur[i];
	}
	return false;
}

export interface UpdateCheckGate {
	/** ms epoch of the last check; null = never checked. */
	lastCheckedAt: number | null;
	/** Tag the user dismissed; never re-notify for it. */
	dismissedTag: string | null;
}

export function shouldCheck(gate: UpdateCheckGate, now: number): boolean {
	return (
		gate.lastCheckedAt === null || now - gate.lastCheckedAt >= CHECK_INTERVAL_MS
	);
}

export function shouldNotify(
	latestTag: string,
	current: string,
	dismissedTag: string | null,
): boolean {
	if (dismissedTag && dismissedTag === latestTag) return false;
	return isNewerVersion(latestTag, current);
}
