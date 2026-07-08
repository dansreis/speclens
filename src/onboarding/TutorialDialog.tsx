import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import KeyboardCommandKeyIcon from "@mui/icons-material/KeyboardCommandKey";
import {
	Box,
	Button,
	Dialog,
	DialogContent,
	MobileStepper,
	Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

interface TutorialStep {
	icon: React.ReactNode;
	title: string;
	body: React.ReactNode;
}

/** Inline keyboard-shortcut chip used inside step bodies. */
function Kbd({ children }: { children: React.ReactNode }) {
	return (
		<Box
			component="kbd"
			sx={{
				fontSize: "0.75rem",
				bgcolor: "action.hover",
				px: 0.75,
				py: 0.25,
				borderRadius: 0.5,
				border: 1,
				borderColor: "divider",
				fontFamily: "ui-monospace, monospace",
			}}
		>
			{children}
		</Box>
	);
}

const STEPS: TutorialStep[] = [
	{
		icon: <AutoStoriesOutlinedIcon sx={{ fontSize: 40 }} />,
		title: "Welcome to SpecLens",
		body: (
			<>
				SpecLens is a reader for OpenSpec projects. It shows the proposals,
				tasks, and specs living under a repository's{" "}
				<Box component="code">openspec/</Box> folder - with authorship and
				timestamps pulled straight from git history.
			</>
		),
	},
	{
		icon: <CreateNewFolderOutlinedIcon sx={{ fontSize: 40 }} />,
		title: "Add a repository",
		body: (
			<>
				Use <strong>Add repository</strong> in the sidebar to point SpecLens at
				any local folder containing an <Box component="code">openspec/</Box>{" "}
				directory. Added repositories are remembered across launches; switch
				between them from the dropdown at the top of the sidebar or with{" "}
				<Kbd>⌘1</Kbd>–<Kbd>⌘9</Kbd>.
			</>
		),
	},
	{
		icon: <AccountTreeOutlinedIcon sx={{ fontSize: 40 }} />,
		title: "Explore your project",
		body: (
			<>
				The sidebar lists a repository's changes and specs. Each change opens
				with <strong>proposal</strong>, <strong>tasks</strong>, and{" "}
				<strong>specs</strong> tabs, and the other views - Overview, Flow,
				Graph, Timeline, Schemas - give you different angles on the same
				project.
			</>
		),
	},
	{
		icon: <ChatBubbleOutlinedIcon sx={{ fontSize: 40 }} />,
		title: "Comment on anything",
		body: (
			<>
				Select any passage in a document to attach a comment to it. Comments
				collect in the panel on the right, split into unresolved and resolved -
				and clicking a comment's quote jumps you back to the highlighted text.
			</>
		),
	},
	{
		icon: <KeyboardCommandKeyIcon sx={{ fontSize: 40 }} />,
		title: "Search and shortcuts",
		body: (
			<>
				Press <Kbd>⌘K</Kbd> to search across everything. Navigate back and
				forward with <Kbd>⌘[</Kbd> and <Kbd>⌘]</Kbd>, and zoom documents with{" "}
				<Kbd>⌘+</Kbd> / <Kbd>⌘−</Kbd>. You can reopen this tutorial anytime from
				Settings, in the sidebar footer.
			</>
		),
	},
];

/**
 * Multi-step onboarding tour. Opens automatically on first launch (via the
 * auto-open effect in App) and on demand from Settings → "Show tutorial".
 * Closing it in any way marks it seen, so it never auto-opens again.
 */
export function TutorialDialog() {
	const open = useAppStore((s) => s.tutorialOpen);
	const closeTutorial = useAppStore((s) => s.closeTutorial);
	const [step, setStep] = useState(0);

	// Restart from the first step each time the dialog opens.
	useEffect(() => {
		if (open) setStep(0);
	}, [open]);

	const isLast = step === STEPS.length - 1;
	const current = STEPS[step];

	return (
		<Dialog
			open={open}
			// Dismiss only via the explicit buttons (or Escape) - a stray click
			// outside the panel shouldn't abort the tour.
			onClose={(_, reason) => {
				if (reason === "backdropClick") return;
				closeTutorial();
			}}
			maxWidth="sm"
			fullWidth
		>
			<DialogContent sx={{ pt: 4, pb: 1 }}>
				<Box
					sx={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						textAlign: "center",
						gap: 2,
						minHeight: 240,
					}}
				>
					<Box
						sx={{
							width: 72,
							height: 72,
							borderRadius: "50%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "primary.main",
							bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
						}}
					>
						{current.icon}
					</Box>
					<Typography variant="h6">{current.title}</Typography>
					<Typography variant="body2" color="text.secondary">
						{current.body}
					</Typography>
				</Box>
			</DialogContent>
			<MobileStepper
				variant="dots"
				steps={STEPS.length}
				position="static"
				activeStep={step}
				sx={{ bgcolor: "transparent", px: 2, pb: 2 }}
				backButton={
					// Fixed-width slots on both sides keep the dots centered even as
					// the button labels change width between steps.
					<Box
						sx={{ width: 120, display: "flex", justifyContent: "flex-start" }}
					>
						{step === 0 ? (
							<Button size="small" color="inherit" onClick={closeTutorial}>
								Skip
							</Button>
						) : (
							<Button size="small" onClick={() => setStep((s) => s - 1)}>
								Back
							</Button>
						)}
					</Box>
				}
				nextButton={
					<Box sx={{ width: 120, display: "flex", justifyContent: "flex-end" }}>
						{isLast ? (
							<Button size="small" variant="contained" onClick={closeTutorial}>
								Get started
							</Button>
						) : (
							<Button size="small" onClick={() => setStep((s) => s + 1)}>
								Next
							</Button>
						)}
					</Box>
				}
			/>
		</Dialog>
	);
}
