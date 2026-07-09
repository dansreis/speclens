import GitHubIcon from "@mui/icons-material/GitHub";
import LanguageIcon from "@mui/icons-material/Language";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import {
	Box,
	Button,
	Chip,
	Dialog,
	DialogActions,
	DialogContent,
	Divider,
	Stack,
	Typography,
} from "@mui/material";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import changelogRaw from "../../CHANGELOG.md?raw";

const REPO_URL = "https://github.com/dansreis/speclens";
const WEBSITE_URL = "https://dansreis.github.io/speclens/";

// Drop the "# Changelog" preamble - the dialog has its own heading.
const changelog = changelogRaw.slice(Math.max(changelogRaw.indexOf("## ["), 0));

function ExternalLinkButton({
	href,
	icon,
	children,
}: {
	href: string;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Button
			size="small"
			color="inherit"
			startIcon={icon}
			onClick={() => openUrl(href).catch(console.error)}
			sx={{ color: "text.secondary", textTransform: "none" }}
		>
			{children}
		</Button>
	);
}

interface Props {
	open: boolean;
	onClose: () => void;
}

export function AboutDialog({ open, onClose }: Props) {
	const [version, setVersion] = useState<string | null>(null);

	useEffect(() => {
		if (!open || version !== null) return;
		getVersion()
			.then(setVersion)
			.catch(() => setVersion(""));
	}, [open, version]);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogContent dividers sx={{ pt: 4 }}>
				<Stack spacing={1} sx={{ alignItems: "center" }}>
					<Box
						component="img"
						src="/speclens.png"
						alt=""
						sx={{ width: 72, height: 72 }}
					/>
					<Typography variant="h6" component="h2">
						SpecLens
					</Typography>
					{version && <Chip label={`Version ${version}`} size="small" />}
					<Typography
						variant="body2"
						color="text.secondary"
						align="center"
						sx={{ maxWidth: 380 }}
					>
						A desktop reader for OpenSpec projects - browse changes, trace how
						requirements evolved, and comment on specs, all from local folders.
					</Typography>
					<Stack direction="row" spacing={1} sx={{ pt: 0.5, flexWrap: "wrap" }}>
						<ExternalLinkButton
							href={REPO_URL}
							icon={<GitHubIcon fontSize="small" />}
						>
							GitHub
						</ExternalLinkButton>
						<ExternalLinkButton
							href={WEBSITE_URL}
							icon={<LanguageIcon fontSize="small" />}
						>
							Website
						</ExternalLinkButton>
						<ExternalLinkButton
							href={`${REPO_URL}/blob/main/LICENSE`}
							icon={<PolicyOutlinedIcon fontSize="small" />}
						>
							Apache 2.0
						</ExternalLinkButton>
					</Stack>
				</Stack>

				<Divider sx={{ my: 2.5 }}>
					<Typography variant="overline" color="text.secondary">
						What's new
					</Typography>
				</Divider>

				<Box
					sx={{
						maxHeight: 260,
						overflowY: "auto",
						pr: 1,
						"& h2": {
							fontSize: "1rem",
							fontWeight: 600,
							mt: 2,
							mb: 0.5,
							"&:first-of-type": { mt: 0 },
						},
						"& h3": { fontSize: "0.875rem", fontWeight: 600, mt: 1.5, mb: 0.5 },
						"& p, & li": {
							fontSize: "0.875rem",
							color: "text.secondary",
							lineHeight: 1.6,
						},
						"& ul": { pl: 2.5, my: 0.5 },
						"& code": {
							fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
							fontSize: "0.8em",
							bgcolor: "action.hover",
							px: 0.5,
							borderRadius: 0.5,
						},
						"& a": { color: "primary.main" },
					}}
				>
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{changelog}</ReactMarkdown>
				</Box>

				<Typography
					variant="caption"
					color="text.secondary"
					align="center"
					sx={{ display: "block", mt: 2 }}
				>
					© 2026 Daniel Reis
				</Typography>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Done</Button>
			</DialogActions>
		</Dialog>
	);
}
