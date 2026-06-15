import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

/**
 * Publishes the active documentId on mount/unmount so the CommentsPanel and
 * other consumers can derive `current document` filters without owning the
 * markdown container themselves.
 */
export function useCurrentDocument(documentId: string | null): void {
	const setCurrentDocument = useAppStore((s) => s.setCurrentDocument);

	useEffect(() => {
		setCurrentDocument(documentId);
		return () => setCurrentDocument(null);
	}, [documentId, setCurrentDocument]);
}
