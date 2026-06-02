import { Box, Divider } from "@mui/material";
import type { Change } from "../lib/exampleLoader";
import { RepositorySwitcher } from "../repos/RepositorySwitcher";
import { ChangesSidebar } from "../specs/ChangesSidebar";
import { useAppStore } from "../store/useAppStore";
import { SidebarFooter } from "./SidebarFooter";

interface Props {
	changes: Change[];
	selectedKey: string | null;
	onSelect: (key: string) => void;
}

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 64;

export function AppSidebar({ changes, selectedKey, onSelect }: Props) {
	const collapsed = useAppStore((s) => s.sidebarCollapsed);
	const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

	return (
		<Box
			component="aside"
			sx={{
				width,
				flexShrink: 0,
				borderRight: 1,
				borderColor: "divider",
				display: "flex",
				flexDirection: "column",
				bgcolor: "background.paper",
				transition: "width 200ms ease-in-out",
				overflow: "hidden",
			}}
		>
			<Box sx={{ p: 1 }}>
				<RepositorySwitcher collapsed={collapsed} />
			</Box>
			<Divider />
			<Box sx={{ flex: 1, overflowY: "auto" }}>
				<ChangesSidebar
					changes={changes}
					selectedKey={selectedKey}
					onSelect={onSelect}
					collapsed={collapsed}
				/>
			</Box>
			<Divider />
			<Box sx={{ p: 1 }}>
				<SidebarFooter collapsed={collapsed} />
			</Box>
		</Box>
	);
}
