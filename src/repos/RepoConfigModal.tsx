import CloseIcon from "@mui/icons-material/Close";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import {
	Box,
	Chip,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton,
	Tooltip,
	Typography,
} from "@mui/material";
import type { Repo } from "../lib/exampleLoader";

interface Props {
	open: boolean;
	repo: Repo | null;
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

export function RepoConfigModal({ open, repo, onClose }: Props) {
	if (!repo) return null;
	const { schema, configYaml, schemaYaml } = repo;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ pr: 6 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<SettingsApplicationsIcon />
					Repository configuration
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
				<Section title="Active schema">
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
				</Section>

				<Section
					title="openspec/config.yaml"
					hint={configYaml ? undefined : "not present"}
				>
					{configYaml ? (
						<YamlBlock text={configYaml} />
					) : (
						<Typography variant="body2" color="text.secondary">
							This repository has no <code>openspec/config.yaml</code>. Falling
							back to the built-in <strong>{schema.name}</strong> schema.
						</Typography>
					)}
				</Section>

				<Section
					title={`openspec/schemas/${schema.name}/schema.yaml`}
					hint={schemaYaml ? undefined : "built-in default"}
				>
					{schemaYaml ? (
						<YamlBlock text={schemaYaml} />
					) : (
						<Typography variant="body2" color="text.secondary">
							No schema file shipped with this repository. SpecLens is using its
							bundled <strong>{schema.name}</strong> definition.
						</Typography>
					)}
				</Section>
			</DialogContent>
		</Dialog>
	);
}
