import { openSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./", import.meta.url));
const logPath = fileURLToPath(new URL("./railway-up.log", import.meta.url));
const output = openSync(logPath, "w");
const child = spawn("./node_modules/.bin/railway", ["up", "-y", "--detach", "--json", "--service", "qili-xiangqi"], {
  cwd: root,
  detached: true,
  stdio: ["ignore", output, output],
});
child.unref();
console.log(JSON.stringify({ pid: child.pid, logPath }));
