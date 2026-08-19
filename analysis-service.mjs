const COACH_API_KEY = process.env.COACH_API_KEY || process.env.DASHSCOPE_API_KEY || "";
const COACH_BASE_URL = String(process.env.COACH_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/+$/, "");
const VISION_MODEL = process.env.ANALYSIS_VISION_MODEL || process.env.COACH_VISION_MODEL || "qwen-vl-plus";
const VISION_TIMEOUT_MS = Math.min(45000, Math.max(8000, Number(process.env.ANALYSIS_VISION_TIMEOUT_MS || 28000)));

const PIECE_TYPES = new Set(["rook", "horse", "elephant", "advisor", "general", "cannon", "pawn"]);
const COLORS = new Set(["red", "black"]);
const MAX_COUNTS = {
  general: 1,
  advisor: 2,
  elephant: 2,
  rook: 2,
  horse: 2,
  cannon: 2,
  pawn: 5,
};

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pieces: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          row: { type: "integer" },
          col: { type: "integer" },
          type: { type: "string" },
          color: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["row", "col", "type", "color"],
      },
    },
    sideToMove: { type: "string", enum: ["red", "black", "unknown"] },
    redAtBottom: { type: "boolean" },
    notes: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["pieces", "sideToMove", "redAtBottom", "confidence"],
};

function recognitionHealth() {
  return {
    configured: Boolean(COACH_API_KEY && COACH_BASE_URL && VISION_MODEL),
    model: VISION_MODEL,
  };
}

function visionEndpoint() {
  return COACH_BASE_URL.endsWith("/chat/completions")
    ? COACH_BASE_URL
    : `${COACH_BASE_URL}/chat/completions`;
}

function decodeDataUrl(image) {
  if (typeof image !== "string" || !image) return null;
  const match = image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (match) {
    return { mimeType: match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase(), base64: match[2].replace(/\s+/g, "") };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(image) && image.replace(/\s+/g, "").length > 80) {
    return { mimeType: "image/jpeg", base64: image.replace(/\s+/g, "") };
  }
  return null;
}

function parseJsonResponse(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function responseText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    return part?.text || part?.content || "";
  }).join("").trim();
}

function normalizePiece(raw) {
  const row = Number(raw?.row);
  const col = Number(raw?.col);
  const type = String(raw?.type || "").toLowerCase();
  const color = String(raw?.color || "").toLowerCase();
  if (!Number.isInteger(row) || row < 0 || row > 9) return null;
  if (!Number.isInteger(col) || col < 0 || col > 8) return null;
  if (!PIECE_TYPES.has(type) || !COLORS.has(color)) return null;
  const confidence = Math.max(0, Math.min(1, Number(raw?.confidence)));
  return {
    row,
    col,
    type,
    color,
    confidence: Number.isFinite(confidence) ? confidence : 0.6,
  };
}

function sanitizeRecognition(raw) {
  const occupied = new Map();
  const counts = {
    red: { general: 0, advisor: 0, elephant: 0, rook: 0, horse: 0, cannon: 0, pawn: 0 },
    black: { general: 0, advisor: 0, elephant: 0, rook: 0, horse: 0, cannon: 0, pawn: 0 },
  };
  const dropped = [];

  for (const entry of Array.isArray(raw?.pieces) ? raw.pieces : []) {
    const piece = normalizePiece(entry);
    if (!piece) {
      dropped.push("invalid");
      continue;
    }
    const key = `${piece.row},${piece.col}`;
    if (occupied.has(key)) {
      dropped.push(key);
      continue;
    }
    if (counts[piece.color][piece.type] >= MAX_COUNTS[piece.type]) {
      dropped.push(`${piece.color}-${piece.type}`);
      continue;
    }
    occupied.set(key, piece);
    counts[piece.color][piece.type] += 1;
  }

  const pieces = [...occupied.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  const sideToMove = raw?.sideToMove === "red" || raw?.sideToMove === "black" ? raw.sideToMove : "unknown";
  const confidence = ["high", "medium", "low"].includes(raw?.confidence) ? raw.confidence : "low";
  const notes = typeof raw?.notes === "string" ? raw.notes.trim().slice(0, 240) : "";

  return {
    pieces,
    sideToMove,
    redAtBottom: raw?.redAtBottom !== false,
    notes,
    confidence: pieces.length < 8 ? "low" : confidence,
    warnings: [
      counts.red.general !== 1 ? "红帅数量不正常，请核对。" : "",
      counts.black.general !== 1 ? "黑将数量不正常，请核对。" : "",
      dropped.length ? "有些棋子因重叠或数量超限被忽略，请核对。" : "",
    ].filter(Boolean),
  };
}

async function recognizeBoardFromImage(body = {}) {
  if (!recognitionHealth().configured) {
    const error = new Error("截图识别未配置。请设置 COACH_API_KEY，或改为手动摆盘。");
    error.statusCode = 503;
    throw error;
  }

  const decoded = decodeDataUrl(body.image || body.dataUrl || "");
  if (!decoded) {
    const error = new Error("请上传棋盘截图");
    error.statusCode = 400;
    throw error;
  }
  if (decoded.base64.length > 3_500_000) {
    const error = new Error("图片太大，请裁切到棋盘后再试");
    error.statusCode = 413;
    throw error;
  }

  const prompt = `你是中国象棋棋盘识别器。只根据这张截图识别棋盘上的棋子。

坐标系必须用本软件的标准内部坐标，不要用照片上下左右的直觉：
- 棋盘 10 行 9 列。
- row 0 是黑方底线（将、士、象、马、车的初始行）。
- row 9 是红方底线（帅、仕、相、马、车的初始行）。
- col 0 是红方视角最右侧，也就是黑方视角最左侧。
- 交叉点计数，不是格子。

棋子 type 只能是：general, advisor, elephant, rook, horse, cannon, pawn。
颜色 color 只能是 red 或 black。
红方文字通常是帅仕相车马炮兵，黑方是将士象车马炮卒。

如果截图是翻转视角（红在照片上方），仍然转换成上述标准坐标，并把 redAtBottom 设为 false。
sideToMove：图上能明确看出谁走就填 red/black，否则 unknown。
看不清的子不要猜。confidence 在整盘很清楚时用 high，局部模糊用 medium，多数靠猜用 low。

只输出 JSON，不要 Markdown：
${JSON.stringify(OUTPUT_SCHEMA)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const response = await fetch(visionEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${COACH_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${decoded.mimeType};base64,${decoded.base64}` } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || payload?.message || "截图识别失败");
      error.statusCode = response.status === 401 ? 502 : response.status;
      throw error;
    }
    const text = responseText(payload?.choices?.[0]?.message?.content);
    const parsed = sanitizeRecognition(parseJsonResponse(text));
    return {
      ...parsed,
      model: VISION_MODEL,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeout = new Error("截图识别超时，请裁切到棋盘后重试，或改为手动摆盘");
      timeout.statusCode = 504;
      throw timeout;
    }
    if (error instanceof SyntaxError) {
      const parseError = new Error("模型没有返回可解析的棋盘，请改用手动摆盘");
      parseError.statusCode = 502;
      throw parseError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export { recognizeBoardFromImage, recognitionHealth };
