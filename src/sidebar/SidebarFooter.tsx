import CheckIcon from "@mui/icons-material/Check";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LightModeIcon from "@mui/icons-material/LightMode";
import PlayCircleOutlinedIcon from "@mui/icons-material/PlayCircleOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import {
	Badge,
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	FormControlLabel,
	IconButton,
	Slider,
	Stack,
	Switch,
	Tab,
	Tabs,
	Tooltip,
	Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState } from "react";
import { HIGHLIGHT_COLORS, useAppStore } from "../store/useAppStore";
import { AboutDialog } from "./AboutDialog";
import { AiSettingsSection } from "./AiSettingsSection";

interface Props {
	collapsed?: boolean;
}

/** One labelled setting row: title + optional caption above its control. */
function SettingRow({
	title,
	caption,
	children,
}: {
	title: string;
	caption?: string;
	children: React.ReactNode;
}) {
	return (
		<Box>
			<Typography variant="body2" sx={{ fontWeight: 500 }}>
				{title}
			</Typography>
			{caption && (
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ display: "block", mb: 1 }}
				>
					{caption}
				</Typography>
			)}
			<Box sx={{ mt: caption ? 0 : 1 }}>{children}</Box>
		</Box>
	);
}

export function SidebarFooter({ collapsed = false }: Props) {
	const themeMode = useAppStore((s) => s.themeMode);
	const toggleThemeMode = useAppStore((s) => s.toggleThemeMode);
	const highlightEars = useAppStore((s) => s.highlightEars);
	const toggleHighlightEars = useAppStore((s) => s.toggleHighlightEars);
	const settings = useAppStore((s) => s.settings);
	const setSetting = useAppStore((s) => s.setSetting);
	const resetSettings = useAppStore((s) => s.resetSettings);
	const openTutorial = useAppStore((s) => s.openTutorial);
	const updateAvailableTag = useAppStore((s) => s.updateAvailableTag);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [settingsTab, setSettingsTab] = useState(0);
	const [aboutOpen, setAboutOpen] = useState(false);

	const handleOpenSettings = () => {
		// Always land on the first tab when the dialog opens.
		setSettingsTab(0);
		setSettingsOpen(true);
	};

	const handleShowTutorial = () => {
		setSettingsOpen(false);
		openTutorial();
	};

	const handleReset = () => {
		resetSettings();
		// highlightEars is a separate top-level field; its default is `true`.
		if (!highlightEars) toggleHighlightEars();
	};

	const settingsBtn = (
		<Tooltip title="Settings" placement={collapsed ? "right" : "top"} arrow>
			<IconButton
				onClick={handleOpenSettings}
				aria-label="Settings"
				size="small"
				sx={{ color: "text.secondary" }}
			>
				<SettingsIcon fontSize="small" />
			</IconButton>
		</Tooltip>
	);

	const aboutBtn = (
		<Tooltip
			title={
				updateAvailableTag
					? `About SpecLens · ${updateAvailableTag} is available`
					: "About SpecLens"
			}
			placement={collapsed ? "right" : "top"}
			arrow
		>
			<IconButton
				onClick={() => setAboutOpen(true)}
				aria-label="About SpecLens"
				size="small"
				sx={{ color: "text.secondary" }}
			>
				<Badge
					color="info"
					variant="dot"
					invisible={!updateAvailableTag}
					overlap="circular"
				>
					<InfoOutlinedIcon fontSize="small" />
				</Badge>
			</IconButton>
		</Tooltip>
	);

	const themeBtn = (
		<Tooltip
			title={`Switch to ${themeMode === "light" ? "dark" : "light"} mode`}
			placement={collapsed ? "right" : "top"}
			arrow
		>
			<IconButton
				onClick={toggleThemeMode}
				aria-label="Toggle theme"
				size="small"
				sx={{ color: "text.secondary" }}
			>
				{themeMode === "light" ? (
					<DarkModeIcon fontSize="small" />
				) : (
					<LightModeIcon fontSize="small" />
				)}
			</IconButton>
		</Tooltip>
	);

	return (
		<>
			<Box
				sx={{
					display: "flex",
					flexDirection: collapsed ? "column" : "row",
					justifyContent: collapsed ? "center" : "space-between",
					alignItems: "center",
					gap: 0.5,
					px: collapsed ? 0 : 1,
				}}
			>
				{settingsBtn}
				{aboutBtn}
				{themeBtn}
			</Box>
			<AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
			<Dialog
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				maxWidth="md"
				fullWidth
				slotProps={{ paper: { sx: { maxWidth: 760 } } }}
			>
				<DialogTitle sx={{ pb: 0 }}>Settings</DialogTitle>
				<Tabs
					value={settingsTab}
					onChange={(_, v) => setSettingsTab(v as number)}
					sx={{ px: 3, borderBottom: 1, borderColor: "divider" }}
				>
					<Tab label="General" />
					<Tab label="Reading" />
					<Tab label="AI" />
				</Tabs>
				<DialogContent
					sx={{
						height: "min(64vh, 620px)",
						overflow: "hidden",
						display: "flex",
						flexDirection: "column",
					}}
				>
					{settingsTab === 1 && (
						<Stack spacing={3} divider={<Divider flexItem />}>
							<SettingRow
								title="Reading speed"
								caption={`Words per minute used to estimate reading time. Currently ${settings.readingWpm} wpm.`}
							>
								<Slider
									value={settings.readingWpm}
									onChange={(_, v) => setSetting("readingWpm", v as number)}
									min={100}
									max={500}
									step={25}
									marks={[
										{ value: 100, label: "100" },
										{ value: 300, label: "300" },
										{ value: 500, label: "500" },
									]}
									valueLabelDisplay="auto"
									size="small"
								/>
							</SettingRow>

							<FormControlLabel
								sx={{ ml: 0, alignItems: "flex-start" }}
								control={
									<Switch
										checked={highlightEars}
										onChange={toggleHighlightEars}
										sx={{ mt: -0.5 }}
									/>
								}
								label={
									<Box>
										<Typography variant="body2" sx={{ fontWeight: 500 }}>
											Highlight EARS keywords
										</Typography>
										<Typography variant="caption" color="text.secondary">
											Colors SHALL, MUST, SHOULD, MAY, WHEN, WHILE, WHERE, IF,
											THEN, GIVEN, AND in spec prose.
										</Typography>
									</Box>
								}
							/>
							<SettingRow
								title="Highlight color"
								caption="Color used for comment highlights in the document."
							>
								<Stack direction="row" spacing={1.5}>
									{HIGHLIGHT_COLORS.map((color) => {
										const selected = settings.highlightColor === color;
										return (
											<Box
												key={color}
												component="button"
												type="button"
												aria-label={`Highlight color ${color}`}
												aria-pressed={selected}
												onClick={() => setSetting("highlightColor", color)}
												sx={{
													width: 28,
													height: 28,
													p: 0,
													borderRadius: "50%",
													cursor: "pointer",
													bgcolor: alpha(color, 0.85),
													border: 2,
													borderColor: selected
														? "text.primary"
														: "transparent",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													transition: "transform 100ms",
													"&:hover": { transform: "scale(1.1)" },
												}}
											>
												{selected && (
													<CheckIcon
														sx={{ fontSize: 16, color: "rgba(0,0,0,0.7)" }}
													/>
												)}
											</Box>
										);
									})}
								</Stack>
							</SettingRow>

							<SettingRow
								title="Comments panel width"
								caption={`Width of the comments panel. Currently ${settings.commentsPanelWidth}px.`}
							>
								<Slider
									value={settings.commentsPanelWidth}
									onChange={(_, v) =>
										setSetting("commentsPanelWidth", v as number)
									}
									min={240}
									max={640}
									step={20}
									marks={[
										{ value: 240, label: "240" },
										{ value: 440, label: "440" },
										{ value: 640, label: "640" },
									]}
									valueLabelDisplay="auto"
									size="small"
								/>
							</SettingRow>
						</Stack>
					)}
					{settingsTab === 0 && (
						<Stack spacing={3} divider={<Divider flexItem />}>
							<FormControlLabel
								sx={{ ml: 0, alignItems: "flex-start" }}
								control={
									<Switch
										checked={settings.updateCheck}
										onChange={(_, checked) =>
											setSetting("updateCheck", checked)
										}
										sx={{ mt: -0.5 }}
									/>
								}
								label={
									<Box>
										<Typography variant="body2" sx={{ fontWeight: 500 }}>
											Check for updates
										</Typography>
										<Typography variant="caption" color="text.secondary">
											Once a day, asks GitHub whether a newer SpecLens exists
											and shows a notice. The only data sent is the request
											itself.
										</Typography>
									</Box>
								}
							/>

							<Box>
								<FormControlLabel
									sx={{ ml: 0, alignItems: "flex-start" }}
									control={
										<Switch
											checked={settings.specChecks}
											onChange={(_, checked) =>
												setSetting("specChecks", checked)
											}
											sx={{ mt: -0.5 }}
										/>
									}
									label={
										<Box>
											<Typography variant="body2" sx={{ fontWeight: 500 }}>
												Spec checks
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Lints loaded changes and specs for structural,
												consistency, and language issues (missing documents,
												malformed EARS blocks, ambiguous wording) and shows
												findings on each change. Everything runs locally and
												deterministically.
											</Typography>
										</Box>
									}
								/>
								<FormControlLabel
									sx={{ ml: 3, mt: 1, alignItems: "flex-start" }}
									control={
										<Switch
											checked={settings.specChecksIncludeArchived}
											onChange={(_, checked) =>
												setSetting("specChecksIncludeArchived", checked)
											}
											disabled={!settings.specChecks}
											size="small"
											sx={{ mt: -0.25 }}
										/>
									}
									label={
										<Box>
											<Typography variant="body2" sx={{ fontWeight: 500 }}>
												Include archived changes
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Also lint the documents and spec deltas of archived
												changes. Off by default - archived findings are
												historical and can drown the live signal.
											</Typography>
										</Box>
									}
								/>
							</Box>

							<SettingRow
								title="Tutorial"
								caption="Replay the quick tour of SpecLens shown on first launch."
							>
								<Button
									onClick={handleShowTutorial}
									startIcon={<PlayCircleOutlinedIcon />}
									variant="outlined"
									size="small"
								>
									Show tutorial
								</Button>
							</SettingRow>
						</Stack>
					)}
					{settingsTab === 2 && <AiSettingsSection />}
				</DialogContent>
				<DialogActions
					sx={{
						justifyContent: "space-between",
						px: 3,
						borderTop: 1,
						borderColor: "divider",
					}}
				>
					<Button
						onClick={handleReset}
						startIcon={<RestartAltIcon />}
						color="inherit"
						size="small"
					>
						Reset to defaults
					</Button>
					<Button onClick={() => setSettingsOpen(false)}>Done</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
