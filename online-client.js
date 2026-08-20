import { legalMovesForPiece } from "/xiangqi-server-rules.mjs";

const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API = window.__QILI_ONLINE_API__ || (isLocalDev ? "http://127.0.0.1:8787" : window.location.origin);
const SESSION_KEY = "qili-online-session";

const RED_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const lobby = document.querySelector("#onlineLobby");
const game = document.querySelector("#onlineGame");
const statusEl = document.querySelector("#onlineStatus");
const nameInput = document.querySelector("#onlineDisplayName");
const timeSelect = document.querySelector("#onlineTimeControl");
const roomInput = document.querySelector("#onlineRoomCode");
const roomCodeEl = document.querySelector("#onlineRoomCodeDisplay");
const boardPoints = document.querySelector("#onlineBoardPoints");
const moveList = document.querySelector("#onlineMoveList");
const oppName = document.querySelector("#onlineOppName");
const youName = document.querySelector("#onlineYouName");
const oppClock = document.querySelector("#onlineOppClock");
const youClock = document.querySelector("#onlineYouClock");
const oppToken = document.querySelector("#onlineOppToken");
const youToken = document.querySelector("#onlineYouToken");
const oppColorEl = document.querySelector("#onlineOppColor");
const youColorEl = document.querySelector("#onlineYouColor");
const oppSeat = document.querySelector("#onlineOppSeat");
const youSeat = document.querySelector("#onlineYouSeat");
const gameStateEl = document.querySelector("#onlineGameState");
const drawOfferEl = document.querySelector("#onlineDrawOffer");
const waitingOverlay = document.querySelector("#onlineWaitingOverlay");
const waitingCode = document.querySelector("#onlineWaitingCode");
const waitingMeta = document.querySelector("#onlineWaitingMeta");
const timeLabelEl = document.querySelector("#onlineTimeLabel");
const yourColorEl = document.querySelector("#onlineYourColor");
const resultOverlay = document.querySelector("#onlineResultOverlay");
const resultMark = document.querySelector("#onlineResultMark");
const resultTitle = document.querySelector("#onlineResultTitle");
const resultReason = document.querySelector("#onlineResultReason");
const cancelMatchButton = document.querySelector("#onlineCancelMatch");

let session = null;
let room = null;
let source = null;
let selected = null;
let legalTargets = [];
let matchPoll = null;
let ticketId = null;
let onlineApiReady = false;

function timeControl() {
  const [baseSeconds, incrementSeconds] = (timeSelect?.value || "600+0").split("+").map(Number);
  return { baseSeconds, incrementSeconds };
}

async function request(path, options = {}) {
  const authToken = await window.QiliIdentity?.getAuthToken?.();
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function setStatus(message, kind = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function saveSession(value) {
  session = value;
  if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else localStorage.removeItem(SESSION_KEY);
}

function closeStream() {
  if (source) source.close();
  source = null;
}

function showLobby() {
  lobby?.classList.remove("hidden");
  game?.classList.add("hidden");
  document.body.classList.remove("online-table-active");
}

function showGame() {
  lobby?.classList.add("hidden");
  game?.classList.remove("hidden");
  const onlineView = document.querySelector("#onlineView");
  if (onlineView && !onlineView.classList.contains("hidden")) {
    document.body.classList.add("online-table-active");
  }
}

function setMatching(active) {
  lobby?.classList.toggle("is-matching", Boolean(active));
  cancelMatchButton?.classList.toggle("hidden", !active);
}

function timeLabel(tc = room?.timeControl) {
  const base = Math.round(Number(tc?.baseSeconds || 600) / 60);
  const inc = Number(tc?.incrementSeconds || 0);
  return `${base} + ${inc}`;
}

function fileName(col, color) {
  return color === "red" ? RED_NUMERALS[8 - col] : String(col + 1);
}

function distanceName(distance, color) {
  return color === "red" ? RED_NUMERALS[distance - 1] : String(distance);
}

function formatOnlineMove(item) {
  const move = item?.move;
  const color = item?.color;
  const label = item?.piece || "棋";
  if (!move || !color) return label;
  const fromFile = fileName(move.fromCol, color);
  const toFile = fileName(move.toCol, color);
  const vertical = move.fromCol === move.toCol;
  const forward = color === "red" ? move.toRow < move.fromRow : move.toRow > move.fromRow;
  let action;
  let destination;
  if (!vertical && move.fromRow === move.toRow) {
    action = "平";
    destination = toFile;
  } else if (!vertical) {
    action = forward ? "进" : "退";
    destination = toFile;
  } else {
    action = forward ? "进" : "退";
    destination = distanceName(Math.abs(move.toRow - move.fromRow), color);
  }
  return `${label}${fromFile}${action}${destination}`;
}

function colorLabel(color) {
  return color === "red" ? "红方" : "黑方";
}

function tokenFor(color) {
  return color === "red" ? "帅" : "将";
}

function resultText(result) {
  if (!result) return "";
  if (result.reason === "draw-agreed") return "双方和棋";
  const winner = result.winner === "red" ? "红方" : "黑方";
  const reasons = { resignation: "认输", timeout: "超时", checkmate: "将死", "general-captured": "将帅被吃", "no-legal-moves": "无合法着" };
  return `${winner}获胜 · ${reasons[result.reason] || result.reason}`;
}

function renderMoveHistory() {
  if (!moveList) return;
  const moves = room?.moveHistory || [];
  if (!moves.length) {
    moveList.innerHTML = '<div class="online-empty">还没有走子</div>';
    return;
  }
  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    const redMove = moves[index];
    const blackMove = moves[index + 1];
    rows.push(
      `<div class="online-move-row"><span>${Math.floor(index / 2) + 1}.</span>` +
      `<span class="red-move">${redMove ? formatOnlineMove(redMove) : ""}</span>` +
      `<span class="black-move">${blackMove ? formatOnlineMove(blackMove) : ""}</span></div>`
    );
  }
  moveList.innerHTML = rows.join("");
  moveList.scrollTop = moveList.scrollHeight;
}

function renderBoard() {
  if (!boardPoints || !room?.board) return;
  boardPoints.innerHTML = "";
  const flipped = session?.color === "black";
  const lastMove = room.moveHistory?.at(-1)?.move;
  const myTurn = room.status === "active" && room.currentTurn === session?.color;
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const point = document.createElement("button");
      const visualRow = flipped ? 9 - row : row;
      const visualCol = flipped ? 8 - col : col;
      point.className = "board-point";
      point.style.left = `${(visualCol / 8) * 100}%`;
      point.style.top = `${(visualRow / 9) * 100}%`;
      point.setAttribute("aria-label", `第${row + 1}行第${col + 1}列`);
      if (selected?.row === row && selected?.col === col) point.classList.add("selected");
      const legal = legalTargets.some((move) => move.toRow === row && move.toCol === col);
      const entry = room.board[row][col];
      if (legal) point.classList.add(entry ? "capture" : "legal");
      if (lastMove?.fromRow === row && lastMove?.fromCol === col) point.classList.add("last-from");
      if (lastMove?.toRow === row && lastMove?.toCol === col) point.classList.add("last-to");
      if (entry) {
        const chip = document.createElement("span");
        chip.className = `piece ${entry.color}-piece`;
        chip.textContent = entry.label;
        point.appendChild(chip);
        if (myTurn && entry.color === session?.color) point.classList.add("selectable");
      }
      point.addEventListener("click", () => handleBoardClick(row, col));
      boardPoints.appendChild(point);
    }
  }
}

function renderSeat(kind, color, player, clockMs, toMove) {
  const isYou = kind === "you";
  const nameEl = isYou ? youName : oppName;
  const clockEl = isYou ? youClock : oppClock;
  const tokenEl = isYou ? youToken : oppToken;
  const colorEl = isYou ? youColorEl : oppColorEl;
  const seatEl = isYou ? youSeat : oppSeat;
  if (nameEl) nameEl.textContent = player?.name || (isYou ? "你" : "等待对手");
  if (colorEl) colorEl.textContent = colorLabel(color);
  if (tokenEl) {
    tokenEl.textContent = tokenFor(color);
    tokenEl.className = `online-seat-token ${color}`;
  }
  if (clockEl) {
    clockEl.textContent = formatClock(clockMs);
    clockEl.classList.toggle("active", toMove);
    clockEl.classList.toggle("urgent", Number(clockMs) > 0 && Number(clockMs) <= 20000);
  }
  seatEl?.classList.toggle("to-move", toMove);
}

function renderWaiting() {
  const waiting = room?.status === "waiting";
  waitingOverlay?.classList.toggle("hidden", !waiting);
  if (!waiting) return;
  if (waitingCode) waitingCode.textContent = room.id || "—";
  if (waitingMeta) {
    const color = session?.color === "black" ? "黑" : "红";
    waitingMeta.textContent = `${timeLabel()} · 你执${color}`;
  }
}

function renderResult() {
  if (!resultOverlay) return;
  if (room?.status !== "finished" || !room.result) {
    resultOverlay.classList.add("hidden");
    return;
  }
  const winner = room.result.winner;
  const isDraw = !winner;
  const didWin = winner && winner === session?.color;
  resultOverlay.classList.remove("hidden", "win", "loss", "draw");
  resultOverlay.classList.add(isDraw ? "draw" : didWin ? "win" : "loss");
  if (resultMark) resultMark.textContent = isDraw ? "和" : didWin ? "胜" : "负";
  if (resultTitle) resultTitle.textContent = isDraw ? "本局和棋" : didWin ? "本局获胜" : "本局落败";
  if (resultReason) resultReason.textContent = resultText(room.result);
}

function renderRoom() {
  if (!room) return;
  showGame();
  const myColor = session?.color || "red";
  const oppColor = myColor === "red" ? "black" : "red";
  const myTurn = room.status === "active" && room.currentTurn === myColor;
  if (roomCodeEl) roomCodeEl.textContent = room.id;
  if (timeLabelEl) timeLabelEl.textContent = timeLabel(room.timeControl);
  if (yourColorEl) yourColorEl.textContent = myColor === "red" ? "红" : "黑";
  renderSeat("opp", oppColor, room.players?.[oppColor], room.clocks?.[`${oppColor}Ms`], room.status === "active" && room.currentTurn === oppColor);
  renderSeat("you", myColor, room.players?.[myColor], room.clocks?.[`${myColor}Ms`], myTurn);
  if (gameStateEl) {
    gameStateEl.textContent = room.status === "waiting"
      ? "等待对手加入"
      : room.status === "finished"
        ? resultText(room.result)
        : myTurn ? "轮到你走" : "等待对手";
  }
  drawOfferEl?.classList.toggle("hidden", !(room.drawOfferBy && room.drawOfferBy !== myColor && room.status === "active"));
  if (room.status !== "active") { selected = null; legalTargets = []; }
  renderWaiting();
  renderResult();
  renderBoard();
  renderMoveHistory();
}

function updateRoom(next) {
  const wasFinished = room?.status === "finished";
  room = next;
  renderRoom();
  if (!wasFinished && room?.status === "finished") {
    window.dispatchEvent(new CustomEvent("qili-game-finished", { detail: { roomId: room.id } }));
  }
}

function connectStream() {
  closeStream();
  if (!session?.roomId || !session?.playerToken) return;
  source = new EventSource(`${API}/api/online/rooms/${session.roomId}/events?token=${encodeURIComponent(session.playerToken)}`);
  const events = ["state", "presence", "started", "move", "clock", "offerDraw", "acceptDraw", "declineDraw", "finished"];
  for (const event of events) {
    source.addEventListener(event, (message) => {
      try { updateRoom(JSON.parse(message.data)); } catch {}
    });
  }
  source.onerror = () => {
    if (room?.status !== "finished") gameStateEl.textContent = "连接中断，正在自动重连…";
  };
}

async function adoptSession(roomId, playerToken, color, initialRoom = null) {
  saveSession({ roomId, playerToken, color });
  if (initialRoom) updateRoom(initialRoom);
  else {
    const payload = await request(`/api/online/rooms/${roomId}?token=${encodeURIComponent(playerToken)}`);
    updateRoom(payload.room);
  }
  connectStream();
}

async function createRoom() {
  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");
  await window.QiliIdentity?.ensureIdentity?.().catch(() => null);
  await window.QiliIdentity?.syncDisplayName?.(nameInput?.value || "棋手").catch(() => null);
  setStatus("正在创建房间…");
  try {
    const payload = await request("/api/online/rooms", {
      method: "POST",
      body: JSON.stringify({ displayName: nameInput.value || "棋手", timeControl: timeControl() }),
    });
    await adoptSession(payload.room.id, payload.playerToken, payload.color, payload.room);
    setStatus("");
  } catch (error) { setStatus(error.message, "error"); }
}

async function joinRoom() {
  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");
  await window.QiliIdentity?.ensureIdentity?.().catch(() => null);
  await window.QiliIdentity?.syncDisplayName?.(nameInput?.value || "棋手").catch(() => null);
  const code = (roomInput.value || "").trim().toUpperCase();
  if (!code) return setStatus("请输入房间码", "error");
  setStatus("正在加入房间…");
  try {
    const payload = await request(`/api/online/rooms/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName: nameInput.value || "棋手" }),
    });
    await adoptSession(payload.room.id, payload.playerToken, payload.color, payload.room);
    setStatus("");
  } catch (error) { setStatus(error.message, "error"); }
}

function stopMatchPolling() {
  if (matchPoll) clearInterval(matchPoll);
  matchPoll = null;
}

async function pollMatch() {
  if (!ticketId) return;
  try {
    const ticket = await request("/api/online/matchmaking", {
      method: "POST",
      body: JSON.stringify({ ticketId }),
    });
    if (ticket.status === "matched") {
      stopMatchPolling();
      ticketId = null;
      setMatching(false);
      await adoptSession(ticket.roomId, ticket.playerToken, ticket.color);
      setStatus("");
    }
  } catch (error) {
    stopMatchPolling();
    setMatching(false);
    setStatus(error.message, "error");
  }
}

async function quickMatch() {
  if (!onlineApiReady) return setStatus("真人在线服务暂不可用。", "error");
  await window.QiliIdentity?.ensureIdentity?.().catch(() => null);
  await window.QiliIdentity?.syncDisplayName?.(nameInput?.value || "棋手").catch(() => null);
  stopMatchPolling();
  setMatching(true);
  setStatus("正在寻找同时间制棋手…");
  try {
    const ticket = await request("/api/online/matchmaking", {
      method: "POST",
      body: JSON.stringify({ displayName: nameInput.value || "棋手", timeControl: timeControl() }),
    });
    ticketId = ticket.ticketId;
    if (ticket.status === "matched") {
      ticketId = null;
      setMatching(false);
      await adoptSession(ticket.roomId, ticket.playerToken, ticket.color);
      setStatus("");
      return;
    }
    setMatching(true);
    matchPoll = setInterval(pollMatch, 1200);
  } catch (error) { setMatching(false); setStatus(error.message, "error"); }
}

async function cancelMatch() {
  stopMatchPolling();
  if (ticketId) {
    await request("/api/online/matchmaking/cancel", { method: "POST", body: JSON.stringify({ ticketId }) }).catch(() => {});
  }
  ticketId = null;
  setMatching(false);
  setStatus("已取消匹配");
}

function copyRoomCode() {
  const id = room?.id;
  if (!id || !navigator.clipboard) return;
  navigator.clipboard.writeText(id).then(() => {
    document.querySelectorAll("[data-copy-room]").forEach((button) => {
      const original = button.dataset.copyLabel || button.textContent;
      button.textContent = "已复制";
      window.setTimeout(() => { button.textContent = original; }, 1400);
    });
  }).catch(() => {});
}

function leaveRoom() {
  closeStream();
  saveSession(null);
  room = null;
  selected = null;
  legalTargets = [];
  resultOverlay?.classList.add("hidden");
  showLobby();
}

async function sendAction(type, extra = {}) {
  if (!session?.roomId) return;
  try {
    const payload = await request(`/api/online/rooms/${session.roomId}/action`, {
      method: "POST",
      body: JSON.stringify({ type, playerToken: session.playerToken, ...extra }),
    });
    updateRoom(payload.room);
  } catch (error) {
    gameStateEl.textContent = error.message;
  }
}

function handleBoardClick(row, col) {
  if (!room || room.status !== "active" || room.currentTurn !== session?.color) return;
  const entry = room.board[row][col];
  if (selected) {
    const move = legalTargets.find((item) => item.toRow === row && item.toCol === col);
    if (move) {
      selected = null; legalTargets = [];
      sendAction("move", { move });
      return;
    }
  }
  if (entry?.color === session?.color) {
    selected = { row, col };
    legalTargets = legalMovesForPiece(room.board, row, col);
  } else {
    selected = null;
    legalTargets = [];
  }
  renderBoard();
}

async function restoreSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!stored?.roomId || !stored?.playerToken) return;
    await adoptSession(stored.roomId, stored.playerToken, stored.color);
  } catch {
    saveSession(null);
    showLobby();
  }
}

async function checkOnlineApi() {
  try {
    const health = await request("/api/online/health");
    onlineApiReady = health?.enabled === true;
    if (onlineApiReady) {
      setStatus(isLocalDev ? "真人在线服务已就绪。" : "真人在线服务已连接，可以把这个网址发给其他人。", "ready");
      await window.QiliIdentity?.ensureIdentity?.().catch(() => null);
      await restoreSession();
      return;
    }
  } catch {}
  onlineApiReady = false;
  if (isLocalDev) {
    setStatus("真人在线代码已安装，但当前本地服务还是旧版本。停止当前 dev 进程后重新运行 npm run dev。", "error");
  } else {
    setStatus("真人在线服务连接失败，请稍后重试。", "error");
  }
}

document.querySelector("#openOnlinePlayButton")?.addEventListener("click", () => {
  window.XiangqiPlatform?.switchView("online");
});
document.querySelector("#onlineBackToComputer")?.addEventListener("click", () => window.XiangqiPlatform?.switchView("play"));
document.querySelector("#onlineQuickMatch")?.addEventListener("click", quickMatch);
document.querySelector("#onlineCancelMatch")?.addEventListener("click", cancelMatch);
document.querySelector("#onlineCreateRoom")?.addEventListener("click", createRoom);
document.querySelector("#onlineJoinRoom")?.addEventListener("click", joinRoom);
document.querySelector("#onlineResign")?.addEventListener("click", () => sendAction("resign"));
document.querySelector("#onlineOfferDraw")?.addEventListener("click", () => sendAction("offerDraw"));
document.querySelector("#onlineAcceptDraw")?.addEventListener("click", () => sendAction("acceptDraw"));
document.querySelector("#onlineDeclineDraw")?.addEventListener("click", () => sendAction("declineDraw"));
document.querySelectorAll("[data-copy-room]").forEach((button) => button.addEventListener("click", copyRoomCode));
document.querySelector("#onlineReturnLobby")?.addEventListener("click", leaveRoom);
document.querySelector("#onlineResultLobby")?.addEventListener("click", leaveRoom);
document.querySelector("#onlineResultDismiss")?.addEventListener("click", () => resultOverlay?.classList.add("hidden"));

showLobby();
checkOnlineApi();
