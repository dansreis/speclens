import AddCommentIcon from "@mui/icons-material/AddComment";
import { Box, Button, IconButton, TextField, Tooltip } from "@mui/material";
import type React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";

interface Props {
	top: number;
	left: number;
	onSubmit: (body: string) => void;
	onCancel: () => void;
}

export function SelectionPopover({ top, left, onSubmit, onCancel }: Props) {
	const [composing, setComposing] = useState(false);
	const [body, setBody] = useState("");

	const stopBlur = (e: React.MouseEvent) => e.preventDefault();

	const submit = () => {
		const trimmed = body.trim();
		if (!trimmed) return;
		onSubmit(trimmed);
	};

	return createPortal(
		<Box
			data-selection-popover="true"
			onMouseDown={stopBlur}
			sx={{
				position: "fixed",
				top: `${top}px`,
				left: `${left}px`,
				transform: "translate(-50%, calc(-100% - 8px))",
				zIndex: 2000,
				bgcolor: "background.paper",
				borderRadius: 1,
				border: 1,
				borderColor: "divider",
				boxShadow: 3,
				p: composing ? 1 : 0.25,
				width: composing ? 300 : "auto",
			}}
		>
			{composing ? (
				<>
					<TextField
						autoFocus
						multiline
						minRows={2}
						maxRows={6}
						fullWidth
						placeholder="Add a comment…"
						value={body}
						onChange={(e) => setBody(e.target.value)}
						size="small"
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								submit();
							}
							if (e.key === "Escape") {
								e.preventDefault();
								onCancel();
							}
						}}
					/>
					<Box
						sx={{
							display: "flex",
							justifyContent: "flex-end",
							gap: 1,
							mt: 1,
						}}
					>
						<Button size="small" onClick={onCancel}>
							Cancel
						</Button>
						<Button
							size="small"
							variant="contained"
							disabled={!body.trim()}
							onClick={submit}
						>
							Comment
						</Button>
					</Box>
				</>
			) : (
				<Tooltip title="Add comment">
					<IconButton
						size="small"
						onClick={() => setComposing(true)}
						aria-label="Add comment"
					>
						<AddCommentIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			)}
		</Box>,
		document.body,
	);
}
