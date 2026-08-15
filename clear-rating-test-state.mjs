import { writeFile } from "node:fs/promises";
await writeFile(new URL("./.rating-test-state.json", import.meta.url), "{}\n", { mode: 0o600 });
console.log("rating test state cleared");
