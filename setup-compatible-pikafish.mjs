import { mkdir, writeFile, chmod, readdir, stat, rm } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import sevenZipBin from "7zip-bin";

const ROOT = process.cwd();
const TARGET = join(ROOT, "engine-compatible");
const RELEASE_URL = "https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2023-03-05/Pikafish.2023-03-05.zip";
const NETWORK_URL = "https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue";

async function download(url, path) {
  const response = await fetch(url, { headers: { "User-Agent": "xiangqi-ai-coach" }, redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

async function walk(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}

function extract(archive) {
  const candidates = [sevenZipBin.path7za, sevenZipBin.path7x].filter(Boolean);
  for (const executable of candidates) {
    const result = spawnSync(executable, ["x", archive, `-o${TARGET}`, "-y"], { cwd: ROOT, encoding: "utf8" });
    if (!result.error && result.status === 0) return;
  }
  throw new Error("Could not extract compatible Pikafish package");
}

await rm(TARGET, { recursive: true, force: true });
await mkdir(TARGET, { recursive: true });
const archive = join(TARGET, "Pikafish.2023-03-05.zip");
console.log("Downloading compatible official Pikafish release...");
await download(RELEASE_URL, archive);
extract(archive);

const files = await walk(TARGET);
const binaries = [];
for (const file of files) {
  const name = basename(file).toLowerCase();
  if (!name.startsWith("pikafish") || /\.(zip|nnue|txt|md|json|exe|dll)$/i.test(name)) continue;
  const lower = file.toLowerCase();
  let score = 0;
  if (lower.includes("apple")) score += 100;
  if (lower.includes("arm64")) score += 80;
  if (lower.includes("mac")) score += 60;
  if (lower.includes("x86") || lower.includes("windows") || lower.includes("linux")) score -= 200;
  binaries.push({ file, score });
}
const binary = binaries.sort((a, b) => b.score - a.score)[0]?.file;
if (!binary) throw new Error("No compatible macOS Pikafish binary found");
await chmod(binary, 0o755);

let network = files.find((file) => file.toLowerCase().endsWith(".nnue"));
if (!network) {
  network = join(TARGET, "pikafish.nnue");
  await download(NETWORK_URL, network);
}

const config = {
  kind: "pikafish",
  release: "Pikafish-2023-03-05",
  enginePath: resolve(binary),
  networkPath: resolve(network),
  installedAt: new Date().toISOString(),
};
await writeFile(join(ROOT, "engine", "local-engine.json"), JSON.stringify(config, null, 2) + "\n");
console.log(JSON.stringify(config, null, 2));
