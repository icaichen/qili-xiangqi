import { access, chmod, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const ENGINE_DIR = join(ROOT, "engine");
const CONFIG_PATH = join(ENGINE_DIR, "local-engine.json");
const RUNTIME_BINARY = join(ENGINE_DIR, "runtime-xiangqi-engine");
const ENGINE_LICENSE_PATH = join(ENGINE_DIR, "Copying.txt");
const ENGINE_SOURCE_PATH = join(ENGINE_DIR, "ENGINE_SOURCE.txt");

// Production is pinned deliberately. Do not follow a moving "latest" release during normal deploys.
const FAIRY_REPO = "fairy-stockfish/Fairy-Stockfish";
const FAIRY_TAG = "fairy_sf_14_0_1_xq";
const FAIRY_RELEASE_API = `https://api.github.com/repos/${FAIRY_REPO}/releases/tags/${FAIRY_TAG}`;
const FAIRY_SOURCE_URL = `https://github.com/${FAIRY_REPO}/tree/${FAIRY_TAG}`;
const FAIRY_LICENSE_URL = `https://raw.githubusercontent.com/${FAIRY_REPO}/${FAIRY_TAG}/Copying.txt`;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "qili-engine-setup",
    },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`);
  return response.json();
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: { "User-Agent": "qili-engine-setup" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return bytes.length;
}

function existingPath(value) {
  if (!value) return null;
  return value.startsWith("/") ? value : resolve(ROOT, value);
}

async function existingInstall() {
  try {
    const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
    const enginePath = existingPath(config.enginePath);
    if (!enginePath) return null;
    await access(enginePath);
    const networkPath = existingPath(config.networkPath);
    if (networkPath) await access(networkPath);
    return { ...config, enginePath, networkPath };
  } catch {
    return null;
  }
}

async function configureBundledLocalPikafish() {
  // Preserve the existing Apple-Silicon development flow without downloading the non-commercial
  // Pikafish NNUE into production. This path is only used on a developer machine where the files
  // already exist locally.
  if (process.platform !== "darwin") return null;
  const candidates = process.arch === "arm64"
    ? [join(ENGINE_DIR, "MacOS", "pikafish-apple-silicon")]
    : [join(ENGINE_DIR, "MacOS", "pikafish")];
  const networkPath = join(ENGINE_DIR, "pikafish.nnue");
  for (const enginePath of candidates) {
    try {
      await access(enginePath);
      await access(networkPath);
      await chmod(enginePath, 0o755);
      const config = {
        kind: "pikafish",
        release: "local-bundled",
        platform: process.platform,
        arch: process.arch,
        enginePath,
        networkPath,
        installedAt: new Date().toISOString(),
      };
      await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
      return config;
    } catch {
      // Try the next local candidate.
    }
  }
  return null;
}

function chooseFairyAsset(assets) {
  const candidates = (assets || []).filter((asset) => {
    const name = String(asset?.name || "").toLowerCase();
    if (!name.startsWith("fairy-stockfish-largeboard")) return false;
    if (name.endsWith(".exe") || name.endsWith(".nnue") || name.endsWith(".zip") || name.endsWith(".tar.gz")) return false;
    return true;
  });

  if (process.arch === "x64") {
    return candidates.find((asset) => asset.name === "fairy-stockfish-largeboard_x86-64")
      || candidates.find((asset) => /x86-64(?!.*bmi2)/i.test(asset.name))
      || null;
  }
  if (process.arch === "arm64") {
    return candidates.find((asset) => /(armv8|aarch64|arm64)/i.test(asset.name)) || null;
  }
  return null;
}

async function cleanRuntimeDirectory(keepPaths) {
  const keep = new Set(keepPaths.map((item) => resolve(item)));
  const entries = await readdir(ENGINE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(ENGINE_DIR, entry.name);
    if (keep.has(resolve(fullPath))) continue;
    await rm(fullPath, { recursive: true, force: true });
  }
}

async function prepareProductionFairyStockfish() {
  if (process.platform !== "linux") {
    console.log(`Production engine setup is Linux-only; skipping download on ${process.platform}/${process.arch}.`);
    return null;
  }

  console.log(`Preparing Fairy-Stockfish XQ ${FAIRY_TAG} for ${process.platform}/${process.arch}...`);
  const release = await fetchJson(FAIRY_RELEASE_API);
  const asset = chooseFairyAsset(release.assets || []);
  if (!asset) {
    const available = (release.assets || []).map((item) => item.name).join(", ");
    throw new Error(`No compatible Fairy-Stockfish Xiangqi Linux binary found. Available assets: ${available}`);
  }

  await download(asset.browser_download_url, RUNTIME_BINARY);
  await chmod(RUNTIME_BINARY, 0o755);
  await download(FAIRY_LICENSE_URL, ENGINE_LICENSE_PATH);
  await writeFile(
    ENGINE_SOURCE_PATH,
    [
      "Qili production Xiangqi engine",
      `Engine: Fairy-Stockfish ${FAIRY_TAG}`,
      `Binary release: ${release.html_url || `https://github.com/${FAIRY_REPO}/releases/tag/${FAIRY_TAG}`}`,
      `Exact source: ${FAIRY_SOURCE_URL}`,
      "License: GNU GPL v3 (see Copying.txt)",
      "Qili does not modify the Fairy-Stockfish engine binary.",
      "The dedicated XQ release contains its Xiangqi NNUE network in the binary.",
      "",
    ].join("\n"),
    "utf8",
  );

  const config = {
    kind: "fairy-stockfish",
    release: FAIRY_TAG,
    platform: process.platform,
    arch: process.arch,
    enginePath: relative(ROOT, RUNTIME_BINARY),
    networkPath: null,
    sourceUrl: FAIRY_SOURCE_URL,
    installedAt: new Date().toISOString(),
  };
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  // The checked-in engine directory is excluded from Railway uploads. Build only the runtime
  // engine plus the exact GPL/source notices into the final image.
  await cleanRuntimeDirectory([RUNTIME_BINARY, CONFIG_PATH, ENGINE_LICENSE_PATH, ENGINE_SOURCE_PATH]);

  console.log(`Fairy-Stockfish XQ installed: ${asset.name}`);
  return config;
}

async function main() {
  await mkdir(ENGINE_DIR, { recursive: true });

  const existing = await existingInstall();
  if (existing) {
    console.log(`Xiangqi engine already available for this build: ${existing.enginePath}`);
    return;
  }

  const local = await configureBundledLocalPikafish();
  if (local) {
    console.log(`Using existing local Pikafish development engine: ${local.enginePath}`);
    return;
  }

  const production = await prepareProductionFairyStockfish();
  if (!production && process.platform !== "linux") {
    console.log("No local engine was prepared. The web bundle can still build; start the local engine separately for analysis features.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
