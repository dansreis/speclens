import { Box, Button, Typography } from "@mui/material";
import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: { componentStack?: string | null }) {
		console.error("[ErrorBoundary]", error, info.componentStack);
	}

	reset = () => this.setState({ error: null });

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<Box sx={{ p: 4, maxWidth: 720 }}>
				<Typography variant="h6" sx={{ mb: 1, color: "error.main" }}>
					Something went wrong rendering this view.
				</Typography>
				<Typography
					variant="body2"
					color="text.secondary"
					sx={{
						mb: 2,
						whiteSpace: "pre-wrap",
						fontFamily: "ui-monospace, monospace",
					}}
				>
					{this.state.error.message}
					{this.state.error.stack ? `\n\n${this.state.error.stack}` : ""}
				</Typography>
				<Button variant="outlined" onClick={this.reset}>
					Try again
				</Button>
			</Box>
		);
	}
}
