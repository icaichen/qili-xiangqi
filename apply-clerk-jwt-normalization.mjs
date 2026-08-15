import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./identity-service.mjs", import.meta.url);
let source = await readFile(path, "utf8");
const before = '  if (process.env.CLERK_JWT_KEY) options.jwtKey = process.env.CLERK_JWT_KEY;';
const after = '  if (process.env.CLERK_JWT_KEY) options.jwtKey = process.env.CLERK_JWT_KEY.replace(/\\\\n/g, "\\n");';
if (!source.includes(before)) throw new Error("JWT key normalization anchor not found");
source = source.replace(before, after);
await writeFile(path, source, "utf8");
console.log("Clerk JWT key normalization added");
