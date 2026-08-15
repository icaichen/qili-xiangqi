import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./engine-server.mjs", import.meta.url);
let text = await readFile(path, "utf8");

if (!text.includes("./online-game-service.mjs")) {
  text = text.replace(
    'import { coachHealth, explainCoach } from "./coach-service.mjs";',
    'import { coachHealth, explainCoach } from "./coach-service.mjs";\nimport { handleOnlineRequest, serviceInfo as onlineServiceInfo } from "./online-game-service.mjs";'
  );
}

if (!text.includes('request.url?.startsWith("/api/online/")')) {
  text = text.replace(
    '  if (request.method === "GET" && request.url === "/api/engine/health") {',
    '  if (request.url?.startsWith("/api/online/")) {\n    if (await handleOnlineRequest(request, response)) return;\n  }\n\n  if (request.method === "GET" && request.url === "/api/engine/health") {'
  );
}

if (!text.includes("online: onlineServiceInfo()")) {
  text = text.replace(
    '      coach: coachHealth(),\n      apiVersion: 2,',
    '      coach: coachHealth(),\n      online: onlineServiceInfo(),\n      apiVersion: 3,'
  );
}

await writeFile(path, text);
console.log("Online service integrated into engine server");
