import { useEffect, useState } from "react";

// Captured when this module is first imported — i.e. at app launch — so the
// elapsed time spans bootstrap + initial load, not just when a hook mounts.
const APP_START = Date.now();

/**
 * Returns false until `ms` have elapsed since app launch, then true. Used to
 * hold the splash screen for a minimum duration so it doesn't flicker away
 * instantly on fast cold starts. Because it measures from launch, time already
 * spent loading counts toward the minimum (no extra delay is stacked on top).
 */
export function useMinDelay(ms: number): boolean {
	const [elapsed, setElapsed] = useState(() => Date.now() - APP_START >= ms);
	useEffect(() => {
		if (elapsed) return;
		const remaining = ms - (Date.now() - APP_START);
		const timer = window.setTimeout(
			() => setElapsed(true),
			Math.max(0, remaining),
		);
		return () => window.clearTimeout(timer);
	}, [elapsed, ms]);
	return elapsed;
}
