import { open } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const logPath = resolve("railway-login.log");
const log = await open(logPath, "w");
const railway = resolve("node_modules/.bin/railway");
const child = spawn(railway, ["login", "--browserless"], {
  cwd: process.cwd(),
  detached: true,
  stdio: ["ignore", log.fd, log.fd],
});
child.unref();
await log.close();
console.log(JSON.stringify({ pid: child.pid, logPath }));
