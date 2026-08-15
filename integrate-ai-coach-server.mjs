import { readFile, writeFile } from "node:fs/promises";

const path = "engine-server.mjs";
let source = await readFile(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing target: ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  'import { spawn } from "node:child_process";\n',
  'import { spawn } from "node:child_process";\nimport { coachHealth, explainCoach } from "./coach-service.mjs";\n',
  "coach service import",
);

replaceOnce(
  '      kind: ENGINE_KIND,\n      port: PORT,\n',
  '      kind: ENGINE_KIND,\n      port: PORT,\n      coach: coachHealth(),\n      apiVersion: 2,\n',
  "health coach metadata",
);

replaceOnce(
  '  if (request.method === "POST" && request.url === "/api/engine/analyze") {',
  `  if (request.method === "POST" && request.url === "/api/coach/explain") {\n    try {\n      const body = await readJson(request);\n      const explanation = await explainCoach(body);\n      json(response, 200, explanation);\n    } catch (error) {\n      console.error(\"[coach]\", error);\n      const status = Number(error?.statusCode || 500);\n      json(response, status, { error: error instanceof Error ? error.message : \"Unknown coach error\" });\n    }\n    return;\n  }\n\n  if (request.method === "POST" && request.url === "/api/engine/analyze") {`,
  "coach endpoint",
);

await writeFile(path, source, "utf8");
console.log("AI coach endpoint integrated.");
