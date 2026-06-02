import { Box } from "@mui/material";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

interface Props {
	source: string;
}

export function MarkdownView({ source }: Props) {
	return (
		<Box
			sx={{
				"& h1": { typography: "h4", mt: 4, mb: 2 },
				"& h2": { typography: "h5", mt: 3, mb: 1.5 },
				"& h3": { typography: "h6", mt: 2, mb: 1 },
				"& h4, & h5, & h6": { typography: "subtitle1", mt: 2, mb: 1 },
				"& p": { lineHeight: 1.65, mb: 1.5 },
				"& ul, & ol": { pl: 3, mb: 1.5 },
				"& li": { mb: 0.5 },
				"& code": {
					px: 0.75,
					py: 0.25,
					borderRadius: 0.5,
					bgcolor: "action.hover",
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					fontSize: "0.875em",
				},
				"& pre": {
					p: 2,
					my: 2,
					borderRadius: 1,
					bgcolor: "action.hover",
					overflowX: "auto",
				},
				"& pre code": { p: 0, bgcolor: "transparent" },
				"& blockquote": {
					borderLeft: 3,
					borderColor: "divider",
					pl: 2,
					my: 2,
					color: "text.secondary",
				},
				"& table": { borderCollapse: "collapse", my: 2 },
				"& th, & td": {
					border: 1,
					borderColor: "divider",
					px: 1.5,
					py: 0.75,
				},
				"& th": { bgcolor: "action.hover" },
				"& input[type=checkbox]": { mr: 1 },
				"& kbd": {
					display: "inline-block",
					px: 0.75,
					py: 0.125,
					mx: 0.25,
					borderRadius: 0.5,
					border: 1,
					borderColor: "divider",
					bgcolor: "background.paper",
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					fontSize: "0.8125em",
					lineHeight: 1.4,
					boxShadow: "inset 0 -1px 0 0",
				},
				"& details": {
					my: 2,
					borderLeft: 3,
					borderColor: "divider",
					pl: 2,
				},
				"& summary": { cursor: "pointer", fontWeight: 600 },
			}}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw, rehypeSlug]}
			>
				{source}
			</ReactMarkdown>
		</Box>
	);
}
