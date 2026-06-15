import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { DocumentKind } from "../lib/comments";
import type { DocAuthorship } from "../lib/repoLoader";
import { AttributionLine } from "../specs/AttributionLine";
import { MarkdownView } from "../specs/MarkdownView";

interface Props {
	title: string;
	subtitle?: ReactNode;
	authorship?: DocAuthorship | null;
	source: string;
	documentId: string;
	documentKind: DocumentKind;
}

export function RepoDocLayout({
	title,
	subtitle,
	authorship,
	source,
	documentId,
	documentKind,
}: Props) {
	return (
		<Box>
			<Box
				sx={{
					px: 4,
					pt: 3,
					pb: 2,
					borderBottom: 1,
					borderColor: "divider",
				}}
			>
				<Typography
					variant="h4"
					component="h1"
					sx={{ fontWeight: 700, mb: 0.5 }}
				>
					{title}
				</Typography>
				{subtitle && (
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						{subtitle}
					</Typography>
				)}
				{authorship && <AttributionLine authorship={authorship} size="sm" />}
			</Box>
			<Box sx={{ px: 4, py: 3 }}>
				<MarkdownView
					source={source}
					documentId={documentId}
					documentKind={documentKind}
				/>
			</Box>
		</Box>
	);
}
