import { readFile, writeFile } from "node:fs/promises";
const path = "improve-routes-and-notation.mjs";
let source = await readFile(path, "utf8");
source = source.replace(
  '    `      generateLegalMoves: undefined,`,\n    `      generateLegalMoves,`,',
  '    `      opposite: OPPOSITE,`,\n    `      opposite: OPPOSITE,\\n      generateLegalMoves,`,'
);
await writeFile(path, source, "utf8");
