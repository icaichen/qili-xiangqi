import { readFile, writeFile } from "node:fs/promises";

for (const file of ["public-online-server.mjs", "engine-server.mjs"]) {
  const path = new URL(`./${file}`, import.meta.url);
  let source = await readFile(path, "utf8");

  const corsBefore = '"access-control-allow-headers": "content-type, authorization",';
  const corsAfter = '"access-control-allow-headers": "content-type, authorization, x-qili-guest-token",';
  if (!source.includes(corsBefore)) throw new Error(`${file}: CORS anchor not found`);
  source = source.replace(corsBefore, corsAfter);

  const routeBefore = `  if (request.url?.startsWith("/api/identity/")) {
    if (await handleIdentityRequest(request, response)) return;
  }
`;
  const routeAfter = `  if (request.url?.startsWith("/api/identity/") || request.url?.startsWith("/api/auth/")) {
    if (await handleIdentityRequest(request, response)) return;
  }
`;
  if (!source.includes(routeBefore)) throw new Error(`${file}: identity route anchor not found`);
  source = source.replace(routeBefore, routeAfter);

  await writeFile(path, source, "utf8");
}

console.log("auth routes added");
