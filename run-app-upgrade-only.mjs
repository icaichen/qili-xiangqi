import { readFile, writeFile } from "node:fs/promises";
const path = "upgrade-levels-teaching-undo.mjs";
let source = await readFile(path, "utf8");
source = source.replace(
  "await patchIndex();\nawait patchStyles();\nawait patchApp();",
  "await patchApp();",
);
await writeFile("upgrade-app-only.generated.mjs", source, "utf8");
