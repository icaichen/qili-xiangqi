import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";

const config = JSON.parse(await readFile("engine/local-engine.json", "utf8"));
console.log(config);
console.log("network bytes", (await stat(config.networkPath)).size);
const child = spawn(config.enginePath, [], { cwd: "engine", stdio: ["pipe", "pipe", "pipe"] });
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => process.stdout.write("[out] " + chunk));
child.stderr.on("data", (chunk) => process.stderr.write("[err] " + chunk));
child.on("error", (error) => console.error("[spawn-error]", error));
child.on("exit", (code, signal) => console.log("[exit]", { code, signal }));
child.stdin.write("uci\n");
setTimeout(() => child.stdin.write(`setoption name EvalFile value ${config.networkPath}\n`), 300);
setTimeout(() => child.stdin.write("isready\n"), 600);
setTimeout(() => child.stdin.write("position fen rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1\n"), 1000);
setTimeout(() => child.stdin.write("go depth 4\n"), 1200);
setTimeout(() => { if (!child.killed) child.stdin.write("quit\n"); }, 7000);
