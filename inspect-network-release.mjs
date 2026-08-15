const response = await fetch("https://api.github.com/repos/official-pikafish/Networks/releases/latest", {
  headers: { "User-Agent": "xiangqi-ai-coach-debug" },
});
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const release = await response.json();
console.log(JSON.stringify({ tag: release.tag_name, assets: release.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })) }, null, 2));
