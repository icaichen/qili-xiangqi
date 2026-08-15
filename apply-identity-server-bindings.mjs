import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./engine-server.mjs", import.meta.url);
let source = await readFile(path, "utf8");

const replacements = [
  [
    'import { handleOnlineRequest, serviceInfo as onlineServiceInfo } from "./online-game-service.mjs";\n',
    'import { handleOnlineRequest, serviceInfo as onlineServiceInfo } from "./online-game-service.mjs";\nimport { handleIdentityRequest } from "./identity-service.mjs";\n',
  ],
  [
    '    "access-control-allow-headers": "content-type",\n',
    '    "access-control-allow-headers": "content-type, authorization",\n',
  ],
  [
    '      "access-control-allow-headers": "content-type",\n',
    '      "access-control-allow-headers": "content-type, authorization",\n',
  ],
  [
    '  if (request.url?.startsWith("/api/online/")) {\n    if (await handleOnlineRequest(request, response)) return;\n  }\n',
    '  if (request.url?.startsWith("/api/identity/")) {\n    if (await handleIdentityRequest(request, response)) return;\n  }\n\n  if (request.url?.startsWith("/api/online/")) {\n    if (await handleOnlineRequest(request, response)) return;\n  }\n',
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Expected engine-server snippet not found: ${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

await writeFile(path, source, "utf8");
console.log("identity server bindings added");
