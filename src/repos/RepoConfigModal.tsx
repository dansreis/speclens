import CloseIcon from "@mui/icons-material/Close";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import {
	Box,
	Chip,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	IconButton,
	Tooltip,
	Typography,
} from "@mui/material";
import type { Change, Repo } from "../lib/repoLoader";
import type { OpenSpecSchema } from "../lib/schema";

interface Props {
	open: boolean;
	repo: Repo | null;
	change?: Change | null;
	onClose: () => void;
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

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<Box sx={{ mb: 3 }}>
			<Box
				sx={{
					display: "flex",
					alignItems: "baseline",
					gap: 1.5,
					mb: 1,
				}}
			>
				<Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
					{title}
				</Typography>
				{hint && (
					<Typography variant="caption" color="text.secondary">
						{hint}
					</Typography>
				)}
			</Box>
			{children}
		</Box>
	);
}

function SchemaHeader({ schema }: { schema: OpenSpecSchema }) {
	return (
		<>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
				<Chip
					label={schema.name}
					size="small"
					color="primary"
					variant="outlined"
					sx={{ fontWeight: 600 }}
				/>
				{schema.version !== undefined && (
					<Typography variant="caption" color="text.secondary">
						v{schema.version}
					</Typography>
				)}
			</Box>
			{schema.description && (
				<Typography variant="body2" color="text.secondary">
					{schema.description}
				</Typography>
			)}
		</>
	);
}

export function RepoConfigModal({ open, repo, change, onClose }: Props) {
	if (!repo) return null;
	const hasChangeOverride = !!change?.configYaml;

	const repoSchema = repo.schema;
	const changeSchema = change?.schema ?? repoSchema;
	const sameSchema = hasChangeOverride
		? changeSchema.name === repoSchema.name
		: true;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ pr: 6 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<SettingsApplicationsIcon />
					{hasChangeOverride
						? "Change configuration"
						: "Repository configuration"}
				</Box>
				<Tooltip title="Close (Esc)">
					<IconButton
						onClick={onClose}
						aria-label="Close"
						sx={{ position: "absolute", right: 8, top: 8 }}
					>
						<CloseIcon />
					</IconButton>
				</Tooltip>
			</DialogTitle>
			<DialogContent dividers>
				{hasChangeOverride && change && (
					<>
						<Box sx={{ mb: 2 }}>
							<Typography
								variant="overline"
								color="text.secondary"
								sx={{ letterSpacing: 0.5 }}
							>
								Change · {change.name}
							</Typography>
						</Box>
						<Section title="Active schema (change-level)">
							<SchemaHeader schema={changeSchema} />
							{!sameSchema && (
								<Typography
									variant="caption"
									color="warning.main"
									sx={{ display: "block", mt: 0.75 }}
								>
									Overrides the repository default ({repoSchema.name}).
								</Typography>
							)}
						</Section>

						<Section
							title={`openspec/changes/${change.archived ? "archive/" : ""}${change.slug}/.openspec.yaml`}
						>
							{change.configYaml ? (
								<YamlBlock text={change.configYaml} />
							) : (
								<Typography variant="body2" color="text.secondary">
									No per-change config file.
								</Typography>
							)}
						</Section>

						<Section
							title={`openspec/schemas/${changeSchema.name}/schema.yaml`}
							hint={change.schemaYaml ? undefined : "built-in default"}
						>
							{change.schemaYaml ? (
								<YamlBlock text={change.schemaYaml} />
							) : (
								<Typography variant="body2" color="text.secondary">
									No schema file shipped. SpecLens is using its bundled{" "}
									<strong>{changeSchema.name}</strong> definition.
								</Typography>
							)}
						</Section>

						<Divider sx={{ my: 3 }} />
						<Box sx={{ mb: 2 }}>
							<Typography
								variant="overline"
								color="text.secondary"
								sx={{ letterSpacing: 0.5 }}
							>
								Repository default
							</Typography>
						</Box>
					</>
				)}

				<Section title="Active schema (repo-level)">
					<SchemaHeader schema={repoSchema} />
				</Section>

				<Section
					title="openspec/config.yaml"
					hint={repo.configYaml ? undefined : "not present"}
				>
					{repo.configYaml ? (
						<YamlBlock text={repo.configYaml} />
					) : (
						<Typography variant="body2" color="text.secondary">
							This repository has no <code>openspec/config.yaml</code>. Falling
							back to the built-in <strong>{repoSchema.name}</strong> schema.
						</Typography>
					)}
				</Section>

				<Section
					title={`openspec/schemas/${repoSchema.name}/schema.yaml`}
					hint={repo.schemaYaml ? undefined : "built-in default"}
				>
					{repo.schemaYaml ? (
						<YamlBlock text={repo.schemaYaml} />
					) : (
						<Typography variant="body2" color="text.secondary">
							No schema file shipped with this repository. SpecLens is using its
							bundled <strong>{repoSchema.name}</strong> definition.
						</Typography>
					)}
				</Section>
			</DialogContent>
		</Dialog>
	);
}
