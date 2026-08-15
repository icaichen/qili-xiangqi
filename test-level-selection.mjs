globalThis.window = {};
await import("./coach-tools.js");

const tools = globalThis.window.XiangqiCoachTools;
const scores = [120, 90, 55, 15, -35, -100, -180, -280];
const lines = scores.map((numericScore, index) => ({
  numericScore,
  parsedMove: { id: index },
  move: `m${index}`,
}));

function averageLoss(level, samples = 1000) {
  const best = lines[0].numericScore;
  let total = 0;
  for (let index = 0; index < samples; index += 1) {
    const selected = tools.chooseLine(lines, level);
    total += best - selected.numericScore;
  }
  return total / samples;
}

const results = {
  800: averageLoss("800"),
  1200: averageLoss("1200"),
  1600: averageLoss("1600"),
  2000: averageLoss("2000"),
  max: averageLoss("max", 20),
};

if (!(results[800] > results[1200] && results[1200] > results[1600] && results[1600] > results[2000])) {
  throw new Error(`Level ordering failed: ${JSON.stringify(results)}`);
}
if (results.max !== 0) throw new Error(`Unlimited level did not choose best line: ${results.max}`);
console.log(JSON.stringify(results, null, 2));
