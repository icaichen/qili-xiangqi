import { mkdir, writeFile, chmod, chmod as chmodAsync, readdir, stat } from "node:fs/promises";
import { chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, basename } from "node:path";
import sevenZipBin from "7zip-bin";

const ROOT = process.cwd();
const ENGINE_DIR = join(ROOT, "engine");
const RELEASE_API = "https://api.github.com/repos/official-pikafish/Pikafish/releases/latest";
const NETWORK_URL = "https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "xiangqi-ai-coach-local-setup",
    },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`);
  return response.json();
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: { "User-Agent": "xiangqi-ai-coach-local-setup" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return bytes.length;
}

function chooseReleaseAsset(assets) {
  return assets.find((asset) => /pikafish.*\.(7z|zip)$/i.test(asset.name)) || null;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function extractArchive(archivePath) {
  const executable = sevenZipBin.path7za;
  try {
    chmodSync(executable, 0o755);
  } catch {
    // npm may already have installed it with the correct mode.
  }
  const result = spawnSync(executable, ["x", archivePath, `-o${ENGINE_DIR}`, "-y"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const details = [
      result.error?.message,
      result.stderr,
      result.stdout,
      `status=${result.status}`,
      `signal=${result.signal}`,
      `executable=${executable}`,
    ].filter(Boolean).join("\n");
    throw new Error(`7z extraction failed:\n${details}`);
  }
}

function scoreBinaryPath(file) {
  const name = file.toLowerCase();
  let score = 0;
  if (name.includes("apple-silicon")) score += 100;
  if (name.includes("arm64")) score += 80;
  if (name.includes("macos")) score += 60;
  if (name.includes("darwin")) score += 50;
  if (name.includes("modern")) score += 5;
  if (name.includes("x86") || name.includes("windows") || name.endsWith(".exe")) score -= 200;
  return score;
}

async function main() {
  await mkdir(ENGINE_DIR, { recursive: true });

  console.log("Checking latest official Pikafish release...");
  const release = await fetchJson(RELEASE_API);
  const asset = chooseReleaseAsset(release.assets || []);
  if (!asset) {
    const available = (release.assets || []).map((item) => item.name).join(", ");
    throw new Error(`No Pikafish archive found. Available assets: ${available}`);
  }

  const archivePath = join(ENGINE_DIR, asset.name);
  console.log(`Downloading ${asset.name} (${release.tag_name})...`);
  await download(asset.browser_download_url, archivePath);

  console.log("Extracting engine package...");
  extractArchive(archivePath);

  console.log("Downloading official Pikafish NNUE network...");
  const networkPath = join(ENGINE_DIR, "pikafish.nnue");
  await download(NETWORK_URL, networkPath);

  const files = await walk(ENGINE_DIR);
  const binaryCandidates = [];
  for (const file of files) {
    const name = basename(file);
    if (!/^pikafish/i.test(name)) continue;
    if (/\.(7z|zip|nnue|md|txt|json|dll|so|dylib)$/i.test(name)) continue;
    const details = await stat(file);
    if (details.isFile()) binaryCandidates.push(file);
  }

  const binaryPath = binaryCandidates
    .map((file) => ({ file, score: scoreBinaryPath(file) }))
    .sort((a, b) => b.score - a.score || a.file.length - b.file.length)[0]?.file;

  if (!binaryPath || scoreBinaryPath(binaryPath) < 50) {
    throw new Error(`Apple Silicon Pikafish binary was not found. Candidates: ${binaryCandidates.join(", ")}`);
  }
  await chmodAsync(binaryPath, 0o755);

  const config = {
    kind: "pikafish",
    release: release.tag_name,
    enginePath: resolve(binaryPath),
    networkPath: resolve(networkPath),
    installedAt: new Date().toISOString(),
  };
  await writeFile(join(ENGINE_DIR, "local-engine.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");

  console.log("Pikafish installed successfully.");
  console.log(`Engine: ${config.enginePath}`);
  console.log(`Network: ${config.networkPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
