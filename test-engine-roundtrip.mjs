import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile("engine/local-engine.json", "utf8"));
const child = spawn(process.execPath, ["engine-server.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    XIANGQI_ENGINE_PATH: config.enginePath,
    XIANGQI_NETWORK_PATH: config.networkPath,
    XIANGQI_ENGINE_KIND: config.kind,
    ENGINE_PORT: "8787",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch("http://127.0.0.1:8787/api/engine/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Engine server did not start\n" + output);
}

try {
  await waitForServer();
  const response = await fetch("http://127.0.0.1:8787/api/engine/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fen: "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1",
      depth: 6,
      multiPv: 3,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.bestMove || !result.lines?.length) {
    throw new Error("Invalid engine response: " + JSON.stringify(result));
  }
  console.log(JSON.stringify({ bestMove: result.bestMove, lines: result.lines.map((line) => ({ move: line.move, score: line.score, depth: line.depth })) }, null, 2));
} finally {
  child.kill("SIGTERM");
}
