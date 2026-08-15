const pid = Number(process.argv[2] || 0);
let running = false;
try {
  process.kill(pid, 0);
  running = true;
} catch {}
console.log(JSON.stringify({ pid, running }));
