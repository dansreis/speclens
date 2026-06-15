import { Box, Chip, Typography } from "@mui/material";
import { useMemo } from "react";
import type { Repo } from "../lib/repoLoader";
import { artifactLabel } from "../lib/schema";
import { AttributionLine } from "../specs/AttributionLine";
import { useAppStore } from "../store/useAppStore";
import { RepoDocList } from "./RepoDocList";

interface Props {
	repo: Repo | null;
}

function YamlBlock({ text }: { text: string }) {
	return (
		<Box
			component="pre"
			sx={{
				m: 0,
				p: 2,
				borderRadius: 1,
				bgcolor: "action.hover",
				fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
				fontSize: "0.8125rem",
				lineHeight: 1.5,
				overflowX: "auto",
				whiteSpace: "pre",
			}}
		>
			{text}
		</Box>
	);
}

export function SchemasView({ repo }: Props) {
	const selectedSchema = useAppStore((s) => s.selectedSchema);
	const setSelectedSchema = useAppStore((s) => s.setSelectedSchema);

	const items = useMemo(() => {
		if (!repo) return [];
		return repo.schemas.map((s) => ({
			key: s.name,
			primary: (
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<Box component="span">{s.name}</Box>
					{s.isActive && (
						<Chip
							label="active"
							size="small"
							color="primary"
							variant="outlined"
							sx={{ height: 18, fontSize: "0.6875rem" }}
						/>
					)}
				</Box>
			),
			secondary: s.schema.description,
			meta: (
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ fontFamily: "ui-monospace, monospace" }}
				>
					{s.schema.artifacts.length} artifact
					{s.schema.artifacts.length === 1 ? "" : "s"}
				</Typography>
			),
		}));
	}, [repo]);

	if (selectedSchema && repo) {
		const entry = repo.schemas.find((s) => s.name === selectedSchema);
		if (!entry) {
			return (
				<Box sx={{ p: 4 }}>
					<Typography color="text.secondary">
						Schema "{selectedSchema}" not found.
					</Typography>
				</Box>
			);
		}
		const { schema, yaml, isActive, authorship, path } = entry;
		return (
			<Box sx={{ p: 4 }}>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1.5,
						flexWrap: "wrap",
						mb: 0.5,
					}}
				>
					<Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
						{schema.name}
					</Typography>
					{isActive && (
						<Chip
							label="active"
							size="small"
							color="primary"
							variant="outlined"
						/>
					)}
					{schema.version !== undefined && (
						<Typography variant="caption" color="text.secondary">
							v{schema.version}
						</Typography>
					)}
				</Box>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
					{path}
				</Typography>
				{authorship && (
					<Box sx={{ mb: 2 }}>
						<AttributionLine authorship={authorship} size="sm" />
					</Box>
				)}
				{schema.description && (
					<Typography variant="body1" sx={{ mb: 3 }}>
						{schema.description}
					</Typography>
				)}
				<Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
					Artifacts
				</Typography>
				<Box
					sx={{
						border: 1,
						borderColor: "divider",
						borderRadius: 1,
						mb: 3,
						overflow: "hidden",
					}}
				>
					{schema.artifacts.map((artifact) => (
						<Box
							key={artifact.id}
							sx={{
								display: "flex",
								alignItems: "baseline",
								gap: 1.5,
								px: 2,
								py: 1,
								borderBottom: 1,
								borderColor: "divider",
								"&:last-of-type": { borderBottom: 0 },
							}}
						>
							<Typography
								variant="body2"
								sx={{ fontWeight: 600, minWidth: 100, flexShrink: 0 }}
							>
								{artifactLabel(artifact.id)}
							</Typography>
							<Typography
								variant="caption"
								sx={{
									fontFamily: "ui-monospace, monospace",
									color: "text.secondary",
									flexShrink: 0,
								}}
							>
								{artifact.generates}
							</Typography>
							{artifact.description && (
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{ flex: 1 }}
								>
									- {artifact.description}
								</Typography>
							)}
						</Box>
					))}
				</Box>
				<Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
					Raw YAML
				</Typography>
				<YamlBlock text={yaml} />
			</Box>
		);
	}

	return (
		<Box sx={{ p: 4 }}>
			<Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
				Schemas
			</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
				Schema definitions from <Box component="code">openspec/schemas/</Box>.
				The active schema is selected by <Box component="code">config.yaml</Box>
				.
			</Typography>
			<RepoDocList
				items={items}
				emptyMessage="No schemas in this repository."
				onSelect={setSelectedSchema}
			/>
		</Box>
	);
}
