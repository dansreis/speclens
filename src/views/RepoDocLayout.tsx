import BarChartIcon from "@mui/icons-material/BarChart";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { DocumentKind } from "../lib/comments";
import type { DocAuthorship } from "../lib/repoLoader";
import { artifactLabel } from "../lib/schema";
import { AiDocSummaryButton } from "../specs/AiDocSummaryButton";
import { AttributionLine } from "../specs/AttributionLine";
import { DocumentStatsTooltipContent } from "../specs/DocumentStatsTooltip";
import { MarkdownView } from "../specs/MarkdownView";

interface Props {
	title: string;
	subtitle?: ReactNode;
	authorship?: DocAuthorship | null;
	source: string;
	documentId: string;
	documentKind: DocumentKind;
	commentsOpen?: boolean;
	onToggleComments?: () => void;
	/** Document kind passed to the AI summary prompt (e.g. the folder name);
	 * when omitted the AI summary button is not rendered. */
	aiKind?: string;
}

export function RepoDocLayout({
	title,
	subtitle,
	authorship,
	source,
	documentId,
	documentKind,
	commentsOpen,
	onToggleComments,
	aiKind,
}: Props) {
	const statsLabel =
		documentKind === "repo-spec"
			? artifactLabel("specs")
			: documentKind === "folder-doc"
				? "Document"
				: "Document";
	return (
		<Box>
			<Box
				sx={{
					px: 4,
					pt: 3,
					pb: 2,
					borderBottom: 1,
					borderColor: "divider",
					display: "flex",
					alignItems: "flex-start",
					gap: 2,
				}}
			>
				<Box sx={{ flex: 1, minWidth: 0 }}>
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
				{onToggleComments && (
					<Box
						sx={{
							display: "flex",
							gap: 0.5,
							flexShrink: 0,
							alignItems: "center",
						}}
					>
						{aiKind && (
							<AiDocSummaryButton title={title} kind={aiKind} source={source} />
						)}
						<Tooltip
							title={
								<DocumentStatsTooltipContent
									sections={[{ label: statsLabel, source }]}
								/>
							}
							placement="bottom-end"
							slotProps={{
								tooltip: {
									sx: {
										maxWidth: "none",
										bgcolor: "background.paper",
										color: "text.primary",
										p: 1.5,
										border: 1,
										borderColor: "divider",
										boxShadow: 4,
										marginTop: "6px !important",
									},
								},
							}}
						>
							<IconButton
								aria-label="Document statistics"
								sx={{ color: "text.secondary" }}
							>
								<BarChartIcon fontSize="small" />
							</IconButton>
						</Tooltip>
						<Tooltip title="Comments">
							<IconButton
								onClick={onToggleComments}
								aria-label="Toggle comments"
								sx={{
									color: commentsOpen ? "primary.main" : "text.secondary",
								}}
							>
								<ChatBubbleOutlinedIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					</Box>
				)}
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
