import { readFile, writeFile } from "node:fs/promises";
const path = new URL("./online-client.js", import.meta.url);
let text = await readFile(path, "utf8");
if (!text.includes("async function ensureOnlineService()")) {
  text = text.replace(
    'async function request(path, options = {}) {',
    'async function ensureOnlineService() {\n  try {\n    const response = await fetch(`${API}/api/engine/health`, { cache: "no-store" });\n    const health = await response.json();\n    if (Number(health.apiVersion || 0) < 3 || !health.online?.enabled) {\n      setStatus("真人在线代码已安装，但当前本地服务还是旧版本。停止当前 dev 进程后重新运行 npm run dev。", "error");\n      return false;\n    }\n    return true;\n  } catch {\n    setStatus("真人在线服务尚未启动。运行 npm run dev 后再试。", "error");\n    return false;\n  }\n}\n\nasync function request(path, options = {}) {'
  );
  text = text.replace('async function createRoom() {\n  setStatus("正在创建房间…");', 'async function createRoom() {\n  if (!(await ensureOnlineService())) return;\n  setStatus("正在创建房间…");');
  text = text.replace('async function joinRoom() {\n  const code', 'async function joinRoom() {\n  if (!(await ensureOnlineService())) return;\n  const code');
  text = text.replace('async function quickMatch() {\n  stopMatchPolling();', 'async function quickMatch() {\n  if (!(await ensureOnlineService())) return;\n  stopMatchPolling();');
  text = text.replace('showLobby();\nrestoreSession();', 'showLobby();\nensureOnlineService();\nrestoreSession();');
}
await writeFile(path, text);
console.log("Online API version check added");
