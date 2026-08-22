import type { Board, Move, PieceColor } from '@qili/xiangqi-core';

declare const process: { env: Record<string, string | undefined> };

export const API_BASE = process.env.EXPO_PUBLIC_QILI_API_URL || 'https://qilichess.com';

export type MobileSession = {
  accountToken: string;
  user: { id: string; displayName: string; registered?: boolean };
  ratings?: Record<string, unknown>;
};

export type HistoryGame = {
  id: string; source: 'online' | 'computer'; opponent: string; color: PieceColor;
  result: { winner?: PieceColor | null; reason?: string }; moves: Array<Move | { move: Move }>;
  finishedAt?: string; timeControl?: Record<string, unknown>;
};

export type OnlineRoom = {
  id: string; status: 'waiting' | 'active' | 'finished'; viewerColor: PieceColor | null;
  board: Board; currentTurn: PieceColor; moveHistory: Array<{ move: Move }>;
  players: { red: { name: string; connected: boolean } | null; black: { name: string; connected: boolean } | null };
  clocks: { redMs: number; blackMs: number; serverNow: number };
  result: { winner: PieceColor | null; reason: string } | null;
};

export type RoomAccess = { room: OnlineRoom; playerToken: string; color: PieceColor };
export type MatchTicket = { ticketId: string; status: 'waiting' | 'matched'; roomId?: string; playerToken?: string; color?: PieceColor };

async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: init.signal ?? controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `请求失败 (${response.status})`);
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('连接超时，请稍后重试。');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createGuest(displayName: string) {
  return request<MobileSession>('/api/identity/guest', undefined, { method: 'POST', body: JSON.stringify({ displayName }) });
}

export function loadGames(token: string) {
  return request<{ games: HistoryGame[]; total: number }>('/api/identity/me/games?limit=20', token);
}

export function analyzePosition(token: string, board: Board, side: PieceColor) {
  return request<{ lines?: Array<{ move: string }> }>('/api/engine/analyze', token, {
    method: 'POST', body: JSON.stringify({ fen: boardToFen(board, side), depth: 7, multiPv: 2, maxTimeMs: 900 }),
  });
}

export function saveComputerGame(token: string, game: { id: string; moves: Move[]; winner: PieceColor | null }) {
  return request('/api/identity/me/computer-result', token, {
    method: 'POST', body: JSON.stringify({ gameId: game.id, level: 'beginner', winner: game.winner, game: { ...game, color: 'red', opponent: '电脑', result: { winner: game.winner }, timeControl: { mode: 'computer', level: 'beginner' } } }),
  });
}

export function createRoom(token: string, displayName: string, timeControl: { baseSeconds: number; incrementSeconds: number }) {
  return request<RoomAccess>('/api/online/rooms', token, { method: 'POST', body: JSON.stringify({ displayName, timeControl }) });
}

export function joinRoom(token: string, code: string, displayName: string) {
  return request<RoomAccess>(`/api/online/rooms/${encodeURIComponent(code)}/join`, token, { method: 'POST', body: JSON.stringify({ displayName }) });
}

export function startMatch(token: string, displayName: string, timeControl: { baseSeconds: number; incrementSeconds: number }) {
  return request<MatchTicket>('/api/online/matchmaking', token, { method: 'POST', body: JSON.stringify({ displayName, timeControl }) });
}

export function pollMatch(token: string, ticketId: string) {
  return request<MatchTicket>('/api/online/matchmaking', token, { method: 'POST', body: JSON.stringify({ ticketId }) });
}

export function getRoom(token: string, roomId: string, playerToken: string) {
  return request<{ room: OnlineRoom }>(`/api/online/rooms/${encodeURIComponent(roomId)}?token=${encodeURIComponent(playerToken)}`, token);
}

export function roomAction(token: string, roomId: string, playerToken: string, action: Record<string, unknown>) {
  return request<{ room: OnlineRoom }>(`/api/online/rooms/${encodeURIComponent(roomId)}/action`, token, { method: 'POST', body: JSON.stringify({ ...action, playerToken }) });
}

const FEN = {
  red: { rook: 'R', horse: 'N', elephant: 'B', advisor: 'A', general: 'K', cannon: 'C', pawn: 'P' },
  black: { rook: 'r', horse: 'n', elephant: 'b', advisor: 'a', general: 'k', cannon: 'c', pawn: 'p' },
};

function boardToFen(board: Board, side: PieceColor) {
  return `${board.map((row) => {
    let empty = 0;
    let rank = '';
    for (const piece of row) {
      if (!piece) { empty += 1; continue; }
      if (empty) { rank += String(empty); empty = 0; }
      rank += FEN[piece.color][piece.type];
    }
    return rank + (empty ? String(empty) : '');
  }).join('/')} ${side === 'red' ? 'w' : 'b'} - - 0 1`;
}

export function uciToMove(value: string, board: Board): Move | null {
  if (!/^[a-i][0-9][a-i][0-9]$/.test(value)) return null;
  const fromCol = value.charCodeAt(0) - 97;
  const fromRow = 9 - Number(value[1]);
  const toCol = value.charCodeAt(2) - 97;
  const toRow = 9 - Number(value[3]);
  return board[fromRow]?.[fromCol] ? { fromRow, fromCol, toRow, toCol } : null;
}
