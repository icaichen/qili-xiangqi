import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = "https://qili-xiangqi-production.up.railway.app";
const response = await fetch(`${API}/api/online/matchmaking`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ displayName: "队列恢复测试", timeControl: { baseSeconds: 300, incrementSeconds: 3 } }),
});
const ticket = await response.json();
if (!response.ok || ticket.status !== "waiting" || !ticket.ticketId) throw new Error(ticket.error || "Could not create waiting ticket");
await writeFile(join(tmpdir(), "qili-matchmaking-test.json"), JSON.stringify({ ticketId: ticket.ticketId }), { mode: 0o600 });
console.log(JSON.stringify({ waitingTicketCreated: true, status: ticket.status }, null, 2));
