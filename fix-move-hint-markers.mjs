import { readFile, writeFile } from "node:fs/promises";
const path = `${process.cwd()}/app.js`;
let source = await readFile(path, "utf8");
source = source.replace('markerUnits="strokeWidth"', 'markerUnits="userSpaceOnUse"');
await writeFile(path, source, "utf8");
