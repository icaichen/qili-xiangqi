const response = await fetch("https://api.github.com/repos/official-pikafish/Pikafish/releases?per_page=20", {
  headers: { "User-Agent": "xiangqi-ai-coach-debug" },
});
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const releases = await response.json();
console.log(JSON.stringify(releases.map((r) => ({ tag: r.tag_name, published: r.published_at, assets: r.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })) })), null, 2));
