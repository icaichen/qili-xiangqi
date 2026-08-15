import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (/nnue|network|eval/i.test(entry.name)) out.push({ path, size: (await stat(path)).size });
  }
  return out;
}
console.log(JSON.stringify(await walk("engine"), null, 2));
