import { Box, Chip, Typography } from "@mui/material";
import { useMemo } from "react";
import { firstParagraphPreview } from "../lib/markdownPreview";
import type { Repo } from "../lib/repoLoader";
import { useAppStore } from "../store/useAppStore";
import { RepoDocLayout } from "./RepoDocLayout";
import { RepoDocList } from "./RepoDocList";

interface Props {
	repo: Repo | null;
}

function folderTitle(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

export function FolderView({ repo }: Props) {
	const selectedFolder = useAppStore((s) => s.selectedFolder);
	const selectedFolderDoc = useAppStore((s) => s.selectedFolderDoc);
	const setSelectedFolderDoc = useAppStore((s) => s.setSelectedFolderDoc);

	const folder = useMemo(
		() => repo?.folders.find((f) => f.name === selectedFolder) ?? null,
		[repo, selectedFolder],
	);

	const items = useMemo(() => {
		if (!folder) return [];
		return folder.docs.map((d) => ({
			key: d.slug,
			primary: (
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					{d.number && (
						<Chip
							label={d.number}
							size="small"
							variant="outlined"
							sx={{
								height: 18,
								fontSize: "0.6875rem",
								fontFamily: "ui-monospace, monospace",
							}}
						/>
					)}
					<Box component="span">{d.name}</Box>
				</Box>
			),
			preview: firstParagraphPreview(d.content),
		}));
	}, [folder]);

	if (!repo || !selectedFolder || !folder) {
		return (
			<Box sx={{ p: 4 }}>
				<Typography color="text.secondary">
					{selectedFolder
						? `Folder "${selectedFolder}" not found.`
						: "Select a folder from the sidebar."}
				</Typography>
			</Box>
		);
	}

	if (selectedFolderDoc) {
		const doc = folder.docs.find((d) => d.slug === selectedFolderDoc);
		if (!doc) {
			return (
				<Box sx={{ p: 4 }}>
					<Typography color="text.secondary">
						"{selectedFolderDoc}" not found in {folder.name}/.
					</Typography>
				</Box>
			);
		}
		return (
			<RepoDocLayout
				title={doc.number ? `${doc.number}: ${doc.name}` : doc.name}
				subtitle={doc.path}
				authorship={doc.authorship}
				source={doc.content}
				documentId={`repo-doc:${doc.path}`}
				documentKind="folder-doc"
			/>
		);
	}

	return (
		<Box sx={{ p: 4 }}>
			<Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
				{folderTitle(folder.name)}
			</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
				From <Box component="code">openspec/{folder.name}/</Box>.
			</Typography>
			<RepoDocList
				items={items}
				emptyMessage={`No documents in openspec/${folder.name}/.`}
				onSelect={setSelectedFolderDoc}
			/>
		</Box>
	);
}
