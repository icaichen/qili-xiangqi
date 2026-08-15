import { writeFile } from "node:fs/promises";

const [target, ...chunks] = process.argv.slice(2);
if (!target || !chunks.length) throw new Error("Usage: node apply-brand-v2.mjs <target> <base64 chunks...>");
await writeFile(target, Buffer.from(chunks.join(""), "base64"));
console.log(`Wrote ${target}`);
