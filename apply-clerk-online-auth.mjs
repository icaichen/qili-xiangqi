import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./online-client.js", import.meta.url);
let source = await readFile(path, "utf8");
const before = `async function request(path, options = {}) {
  const accountToken = window.QiliIdentity?.getAccountToken?.();
  const response = await fetch(\`\${API}\${path}\`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(accountToken ? { authorization: \`Bearer \${accountToken}\` } : {}),
      ...(options.headers || {}),
    },
  });`;
const after = `async function request(path, options = {}) {
  const authToken = await window.QiliIdentity?.getAuthToken?.();
  const response = await fetch(\`\${API}\${path}\`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(authToken ? { authorization: \`Bearer \${authToken}\` } : {}),
      ...(options.headers || {}),
    },
  });`;
if (!source.includes(before)) throw new Error("online auth request anchor not found");
source = source.replace(before, after);
await writeFile(path, source, "utf8");
console.log("online auth now supports Clerk sessions");
