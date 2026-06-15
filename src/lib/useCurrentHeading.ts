import { type RefObject, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

/**
 * Tracks the topmost heading currently in view within `containerRef` and
 * mirrors it to `useAppStore.currentHeadingSlug`. Also publishes the active
 * documentId on mount/unmount so the CommentsPanel and other consumers can
 * derive `current section` / `current document` filters without owning the
 * markdown container themselves.
 */
export function useCurrentHeading(
	containerRef: RefObject<HTMLElement | null>,
	documentId: string | null,
): void {
	const setCurrentDocument = useAppStore((s) => s.setCurrentDocument);
	const setCurrentHeadingSlug = useAppStore((s) => s.setCurrentHeadingSlug);

	useEffect(() => {
		setCurrentDocument(documentId);
		return () => setCurrentDocument(null);
	}, [documentId, setCurrentDocument]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: setter is stable
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const visible = new Set<string>();

		const recompute = () => {
			if (visible.size === 0) return;
			let topId: string | null = null;
			let topY = Infinity;
			for (const id of visible) {
				const el = container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
				if (!el) continue;
				const y = el.getBoundingClientRect().top;
				if (y < topY) {
					topY = y;
					topId = id;
				}
			}
			if (topId) setCurrentHeadingSlug(topId);
		};

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const id = (entry.target as HTMLElement).id;
					if (!id) continue;
					if (entry.isIntersecting) visible.add(id);
					else visible.delete(id);
				}
				recompute();
			},
			{ root: container, threshold: 0 },
		);

		const els = container.querySelectorAll<HTMLElement>(
			"h1, h2, h3, h4, h5, h6",
		);
		for (const el of els) {
			if (el.id) observer.observe(el);
		}

		return () => {
			observer.disconnect();
			setCurrentHeadingSlug(null);
		};
	}, [containerRef, documentId]);
}
