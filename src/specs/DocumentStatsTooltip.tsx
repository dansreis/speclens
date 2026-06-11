import { Box, Divider, Typography } from "@mui/material";
import type { StatsSection } from "../lib/documentSource";
import { computeDocumentStats } from "../lib/documentStats";

function StatRow({ label, value }: { label: string; value: string }) {
	return (
		<Box
			sx={{
				display: "flex",
				justifyContent: "space-between",
				gap: 2,
				fontSize: "0.75rem",
			}}
		>
			<Typography
				variant="caption"
				sx={{ color: "text.secondary", lineHeight: 1.6 }}
			>
				{label}
			</Typography>
			<Typography
				variant="caption"
				sx={{
					fontWeight: 600,
					color: "text.primary",
					fontFamily: "ui-monospace, monospace",
					lineHeight: 1.6,
				}}
			>
				{value}
			</Typography>
		</Box>
	);
}

function SectionBlock({ section }: { section: StatsSection }) {
	const stats = computeDocumentStats(section.source);
	return (
		<Box>
			<Typography
				variant="overline"
				sx={{
					display: "block",
					mb: 0.5,
					color: "text.secondary",
					fontWeight: 600,
					letterSpacing: "0.05em",
					lineHeight: 1.4,
					fontSize: "0.65rem",
				}}
			>
				{section.label}
			</Typography>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
				<StatRow label="Words" value={stats.words.toLocaleString()} />
				<StatRow label="Characters" value={stats.characters.toLocaleString()} />
				<StatRow label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
				<StatRow label="Sentences" value={stats.sentences.toLocaleString()} />
				<StatRow label="Headings" value={stats.headings.toLocaleString()} />
				<StatRow
					label="Reading time"
					value={`${stats.readingTimeMinutes} min`}
				/>
			</Box>
		</Box>
	);
}

export function DocumentStatsTooltipContent({
	sections,
}: {
	sections: StatsSection[];
}) {
	if (sections.length === 0) {
		return (
			<Typography variant="caption" sx={{ color: "text.secondary" }}>
				No content to analyze.
			</Typography>
		);
	}
	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: "column",
				gap: 1.25,
				minWidth: 220,
			}}
		>
			{sections.map((s, i) => (
				<Box key={s.label || `s-${i}`}>
					{i > 0 && <Divider sx={{ mb: 1.25 }} />}
					<SectionBlock section={s} />
				</Box>
			))}
		</Box>
	);
}
