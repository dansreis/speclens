import { Box, ButtonBase, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface RepoDocListItem {
	key: string;
	primary: ReactNode;
	secondary?: ReactNode;
	preview?: string;
	meta?: ReactNode;
}

interface Props {
	items: RepoDocListItem[];
	emptyMessage: string;
	onSelect: (key: string) => void;
}

export function RepoDocList({ items, emptyMessage, onSelect }: Props) {
	if (items.length === 0) {
		return (
			<Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
				{emptyMessage}
			</Typography>
		);
	}
	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
			{items.map((item) => (
				<ButtonBase
					key={item.key}
					onClick={() => onSelect(item.key)}
					sx={{
						display: "flex",
						alignItems: "stretch",
						gap: 2,
						textAlign: "left",
						px: 2,
						py: 1.5,
						border: 1,
						borderColor: "divider",
						borderRadius: 1,
						bgcolor: "background.paper",
						transition: "border-color 150ms, background-color 150ms",
						"&:hover": {
							borderColor: "primary.main",
							bgcolor: "action.hover",
						},
					}}
				>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Typography
							variant="body2"
							sx={{ fontWeight: 600, mb: item.preview ? 0.25 : 0 }}
						>
							{item.primary}
						</Typography>
						{item.secondary && (
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ display: "block", mb: item.preview ? 0.25 : 0 }}
							>
								{item.secondary}
							</Typography>
						)}
						{item.preview && (
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{
									display: "-webkit-box",
									WebkitLineClamp: 2,
									WebkitBoxOrient: "vertical",
									overflow: "hidden",
								}}
							>
								{item.preview}
							</Typography>
						)}
					</Box>
					{item.meta && (
						<Box
							sx={{
								display: "flex",
								flexDirection: "column",
								alignItems: "flex-end",
								gap: 0.25,
								flexShrink: 0,
								minWidth: 80,
							}}
						>
							{item.meta}
						</Box>
					)}
				</ButtonBase>
			))}
		</Box>
	);
}
