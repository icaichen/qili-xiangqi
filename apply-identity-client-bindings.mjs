import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./online-client.js", import.meta.url);
let source = await readFile(path, "utf8");

const replacements = [
  [
    'async function request(path, options = {}) {\n  const response = await fetch(`${API}${path}`, {',
    'async function request(path, options = {}) {\n  const accountToken = window.QiliIdentity?.getAccountToken?.();\n  const response = await fetch(`${API}${path}`, {',
  ],
  [
    '    headers: { "content-type": "application/json", ...(options.headers || {}) },',
    '    headers: {\n      "content-type": "application/json",\n      ...(accountToken ? { authorization: `Bearer ${accountToken}` } : {}),\n      ...(options.headers || {}),\n    },',
  ],
  [
    'function updateRoom(next) {\n  room = next;\n  renderRoom();\n}',
    'function updateRoom(next) {\n  const wasFinished = room?.status === "finished";\n  room = next;\n  renderRoom();\n  if (!wasFinished && room?.status === "finished") {\n    window.dispatchEvent(new CustomEvent("qili-game-finished", { detail: { roomId: room.id } }));\n  }\n}',
  ],
  [
    'async function createRoom() {\n  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");\n  setStatus("正在创建房间…");',
    'async function createRoom() {\n  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");\n  await window.QiliIdentity?.ensureIdentity?.().catch(() => null);\n  await window.QiliIdentity?.syncDisplayName?.(nameInput?.value || "棋手").catch(() => null);\n  setStatus("正在创建房间…");',
  ],
  [
    'async function joinRoom() {\n  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");\n  const code = (roomInput.value || "").trim().toUpperCase();',
    'async function joinRoom() {\n  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");\n  await window.QiliIdentity?.ensureIdentity?.().catch(() => null);\n  await window.QiliIdentity?.syncDisplayName?.(nameInput?.value || "棋手").catch(() => null);\n  const code = (roomInput.value || "").trim().toUpperCase();',
  ],
  [
    'async function quickMatch() {\n  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");\n  stopMatchPolling();',
    'async function quickMatch() {\n  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");\n  await window.QiliIdentity?.ensureIdentity?.().catch(() => null);\n  await window.QiliIdentity?.syncDisplayName?.(nameInput?.value || "棋手").catch(() => null);\n  stopMatchPolling();',
  ],
  [
    '    if (onlineApiReady) {\n      setStatus(isLocalDev ? "真人在线服务已就绪。" : "真人在线服务已连接，可以把这个网址发给其他人。", "ready");\n      await restoreSession();',
    '    if (onlineApiReady) {\n      setStatus(isLocalDev ? "真人在线服务已就绪。" : "真人在线服务已连接，可以把这个网址发给其他人。", "ready");\n      await window.QiliIdentity?.ensureIdentity?.().catch(() => null);\n      await restoreSession();',
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Expected online-client snippet not found: ${before.slice(0, 100)}`);
  source = source.replace(before, after);
}

await writeFile(path, source, "utf8");
console.log("identity client bindings added");
