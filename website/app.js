// Renders the per-OS download cards from the latest GitHub release.
// Asset names come from the Tauri bundler (see .github/workflows/release.yml);
// the patterns below classify them by OS + architecture.
const REPO = "dansreis/speclens";

const SECTIONS = [
	{
		os: "macOS",
		icon: "🍎",
		rows: [{ label: "Apple Silicon", suffix: ".dmg" }],
	},
	{
		os: "Windows",
		icon: "🪟",
		rows: [
			{ label: "x64 installer", suffix: "x64-setup.exe" },
			{ label: "x64 MSI", suffix: ".msi" },
			{ label: "arm64 installer", suffix: "arm64-setup.exe" },
		],
	},
	{
		os: "Linux",
		icon: "🐧",
		rows: [
			{ label: "AppImage (x64)", suffix: "amd64.AppImage" },
			{ label: "AppImage (arm64)", suffix: "aarch64.AppImage" },
			{ label: "deb (x64)", suffix: "amd64.deb" },
			{ label: "deb (arm64)", suffix: "arm64.deb" },
			{ label: "rpm (x64)", suffix: "x86_64.rpm" },
			{ label: "rpm (arm64)", suffix: "aarch64.rpm" },
		],
	},
];

function fmtSize(bytes) {
	return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function renderDownloads() {
	const grid = document.getElementById("dl-grid");
	const versionEl = document.getElementById("dl-version");
	let release;
	try {
		const res = await fetch(
			`https://api.github.com/repos/${REPO}/releases/latest`,
		);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		release = await res.json();
	} catch {
		return; // keep the static releases-page fallback
	}

	const assets = release.assets ?? [];
	const cards = SECTIONS.map((section) => {
		const rows = section.rows
			.map((row) => {
				const asset = assets.find((a) => a.name.endsWith(row.suffix));
				if (!asset) return "";
				return `<li>
					<a href="${asset.browser_download_url}">${row.label}</a>
					<span class="dl-size">${fmtSize(asset.size)}</span>
				</li>`;
			})
			.join("");
		if (!rows) return "";
		return `<article>
			<h3>${section.icon} ${section.os}</h3>
			<ul class="dl-list">${rows}</ul>
		</article>`;
	}).join("");

	if (!cards) return;
	versionEl.textContent = release.tag_name ?? "";
	grid.innerHTML = cards;
}

renderDownloads();
