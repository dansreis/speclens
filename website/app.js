// Renders the per-OS download cards from the latest GitHub release.
// Asset names come from the Tauri bundler (see .github/workflows/release.yml);
// the patterns below classify them by OS + architecture.
const REPO = "dansreis/speclens";

const SECTIONS = [
	{
		os: "macOS",
		icon: "🍎",
		hint: "Requires an Apple Silicon Mac (M1 or newer). Also on Homebrew: <code>brew install --cask dansreis/tap/speclens</code>",
		rows: [{ label: "Apple Silicon", suffix: ".dmg" }],
	},
	{
		os: "Windows",
		icon: "🪟",
		hint: "Most PCs are x64. Pick arm64 only on Windows-on-ARM devices (e.g. Snapdragon laptops).",
		rows: [
			{ label: "x64 installer", suffix: "x64-setup.exe" },
			{ label: "x64 MSI", suffix: ".msi" },
			{ label: "arm64 installer", suffix: "arm64-setup.exe" },
		],
	},
	{
		os: "Linux",
		icon: "🐧",
		hint: "Unsure? The AppImage runs on any distro. deb is for Debian/Ubuntu, rpm for Fedora/openSUSE.",
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

// Best-effort OS + architecture detection so the page can point at the right
// build. Returns { name, suffix } or null when unsure - the full matrix below
// is always there as the fallback.
async function detectRecommended() {
	const uad = navigator.userAgentData;
	const ua = navigator.userAgent;
	const os =
		uad?.platform ||
		(/Mac/i.test(ua)
			? "macOS"
			: /Win/i.test(ua)
				? "Windows"
				: /Linux/i.test(ua)
					? "Linux"
					: null);
	let arm = /aarch64|arm64/i.test(ua);
	if (uad?.getHighEntropyValues) {
		try {
			const v = await uad.getHighEntropyValues(["architecture"]);
			if (v.architecture) arm = v.architecture.startsWith("arm");
		} catch {
			// high-entropy hints denied; keep the UA guess
		}
	}
	if (/^mac/i.test(os ?? "")) {
		return { name: "macOS (Apple Silicon)", suffix: ".dmg" };
	}
	if (/^win/i.test(os ?? "")) {
		return arm
			? { name: "Windows (arm64)", suffix: "arm64-setup.exe" }
			: { name: "Windows (x64)", suffix: "x64-setup.exe" };
	}
	if (/linux/i.test(os ?? "")) {
		return arm
			? { name: "Linux (arm64 AppImage)", suffix: "aarch64.AppImage" }
			: { name: "Linux (x64 AppImage)", suffix: "amd64.AppImage" };
	}
	return null;
}

async function renderDownloads() {
	const grid = document.getElementById("dl-grid");
	const versionEl = document.getElementById("dl-version");
	const recommendedEl = document.getElementById("dl-recommended");
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
			<p class="dl-hint">${section.hint}</p>
			<ul class="dl-list">${rows}</ul>
		</article>`;
	}).join("");

	if (!cards) return;
	versionEl.textContent = release.tag_name ?? "";
	grid.innerHTML = cards;

	const recommended = await detectRecommended();
	const asset =
		recommended && assets.find((a) => a.name.endsWith(recommended.suffix));
	if (recommended && asset) {
		recommendedEl.innerHTML = `
			<a class="button primary" href="${asset.browser_download_url}">
				Download for ${recommended.name}
			</a>
			<p class="dl-detected">${asset.name} · ${fmtSize(asset.size)} · detected from your browser - or pick another build below</p>`;
	}
}

renderDownloads();

// Scroll-reveal: fade+lift sections and feature cards as they enter the
// viewport. The .js class gates the hidden initial state so nothing is
// invisible without JavaScript; reduced-motion users skip it via CSS.
document.documentElement.classList.add("js");
const revealTargets = document.querySelectorAll("main section, .grid article");
for (const el of revealTargets) el.classList.add("reveal");
const revealObserver = new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				entry.target.classList.add("revealed");
				revealObserver.unobserve(entry.target);
			}
		}
	},
	{ threshold: 0.15 },
);
for (const el of revealTargets) revealObserver.observe(el);

// Dark/light toggle: follows the system preference until the user overrides;
// the override persists in localStorage (applied pre-paint by the inline
// script in index.html).
document.getElementById("theme-toggle")?.addEventListener("click", () => {
	const root = document.documentElement;
	const effective =
		root.dataset.theme ||
		(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
	const next = effective === "dark" ? "light" : "dark";
	root.dataset.theme = next;
	localStorage.setItem("theme", next);
});
