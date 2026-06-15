const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const absoluteFormatter = new Intl.DateTimeFormat(undefined, {
	weekday: "long",
	year: "numeric",
	month: "long",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

export function formatAbsoluteDateTime(date: Date): string {
	return absoluteFormatter.format(date);
}

export function formatCompactDateTime(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate(),
	)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDuration(ms: number): string {
	if (ms < 0) return "-";
	const minutes = Math.floor(ms / 60000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	return `${days}d`;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
	const diffSec = (date.getTime() - now.getTime()) / 1000;
	const abs = Math.abs(diffSec);

	if (abs < MINUTE) return rtf.format(Math.round(diffSec), "second");
	if (abs < HOUR) return rtf.format(Math.round(diffSec / MINUTE), "minute");
	if (abs < DAY) return rtf.format(Math.round(diffSec / HOUR), "hour");
	if (abs < MONTH) return rtf.format(Math.round(diffSec / DAY), "day");
	if (abs < YEAR) return rtf.format(Math.round(diffSec / MONTH), "month");
	return rtf.format(Math.round(diffSec / YEAR), "year");
}
