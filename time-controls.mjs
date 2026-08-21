const TIME_CONTROL_CATALOG = [
  { baseSeconds: 60, incrementSeconds: 0, label: "1+0", pool: "bullet", group: "超快棋", title: "1 分钟" },
  { baseSeconds: 120, incrementSeconds: 1, label: "2+1", pool: "bullet", group: "超快棋", title: "2 + 1" },
  { baseSeconds: 180, incrementSeconds: 2, label: "3+2", pool: "blitz", group: "快棋", title: "3 + 2" },
  { baseSeconds: 300, incrementSeconds: 0, label: "5+0", pool: "blitz", group: "快棋", title: "5 分钟" },
  { baseSeconds: 300, incrementSeconds: 3, label: "5+3", pool: "blitz", group: "快棋", title: "5 + 3" },
  { baseSeconds: 600, incrementSeconds: 0, label: "10+0", pool: "rapid", group: "中局", title: "10 分钟" },
  { baseSeconds: 600, incrementSeconds: 5, label: "10+5", pool: "rapid", group: "中局", title: "10 + 5" },
  { baseSeconds: 900, incrementSeconds: 10, label: "15+10", pool: "rapid", group: "慢棋", title: "15 + 10" },
];

function catalogKey(item) {
  return `${item.baseSeconds}+${item.incrementSeconds}`;
}

function estimatedGameSeconds(timeControl) {
  return Math.max(0, Number(timeControl?.baseSeconds || 0)) + 40 * Math.max(0, Number(timeControl?.incrementSeconds || 0));
}

function ratingPoolForTimeControl(timeControl) {
  if (timeControl?.pool === "bullet" || timeControl?.pool === "blitz" || timeControl?.pool === "rapid") {
    return timeControl.pool;
  }
  const matched = TIME_CONTROL_CATALOG.find((item) => (
    item.baseSeconds === Number(timeControl?.baseSeconds) &&
    item.incrementSeconds === Number(timeControl?.incrementSeconds)
  ));
  if (matched) return matched.pool;
  const estimated = estimatedGameSeconds(timeControl);
  if (estimated < 180) return "bullet";
  if (estimated < 600) return "blitz";
  return "rapid";
}

function normalizeTimeControl(value) {
  const matched = TIME_CONTROL_CATALOG.find((item) => (
    item.baseSeconds === Number(value?.baseSeconds) &&
    item.incrementSeconds === Number(value?.incrementSeconds)
  ));
  return matched || TIME_CONTROL_CATALOG.find((item) => item.label === "10+0");
}

function timeControlSelectHtml(selected = "600+0") {
  const groups = [...new Set(TIME_CONTROL_CATALOG.map((item) => item.group))];
  return groups.map((group) => {
    const options = TIME_CONTROL_CATALOG.filter((item) => item.group === group).map((item) => {
      const value = catalogKey(item);
      return `<option value="${value}"${value === selected ? " selected" : ""}>${item.label} · ${item.group}</option>`;
    }).join("");
    return `<optgroup label="${group}">${options}</optgroup>`;
  }).join("");
}

export {
  TIME_CONTROL_CATALOG,
  catalogKey,
  estimatedGameSeconds,
  ratingPoolForTimeControl,
  normalizeTimeControl,
  timeControlSelectHtml,
};
