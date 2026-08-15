import { readFile, writeFile } from "node:fs/promises";
const path = "index.html";
const source = await readFile(path, "utf8");
await writeFile(path, source.replace('<script src="/engine-client.js"></script>', '<script type="module" src="/engine-client.js"></script>'), "utf8");
