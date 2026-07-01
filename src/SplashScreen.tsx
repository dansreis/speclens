import { keyframes } from "@emotion/react";
import { Box, CircularProgress } from "@mui/material";

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.72; transform: scale(0.97); }
`;

/**
 * Full-screen branded loading state. Rendered while the app initializes
 * (bootstrap) and while the initial repositories load, so the user sees the
 * logo instead of a flash of the empty "no project" state before content
 * appears. Self-contained MUI so it works with or without a ThemeProvider.
 */
export function SplashScreen() {
	return (
		<Box
			sx={{
				position: "fixed",
				inset: 0,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 4,
				bgcolor: "background.default",
			}}
		>
			<Box
				component="img"
				src="/speclens.png"
				alt="SpecLens"
				sx={{
					width: 104,
					height: 104,
					borderRadius: 4,
					animation: `${pulse} 1.8s ease-in-out infinite`,
				}}
			/>
			<CircularProgress size={22} thickness={4} />
		</Box>
	);
}
