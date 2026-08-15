import { curriculumPrompt } from "./xiangqi-teaching-curriculum.mjs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const COACH_TIMEOUT_MS = Math.min(30000, Math.max(5000, Number(process.env.COACH_TIMEOUT_MS || 18000)));

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["explained", "uncertain"] },
    headline: { type: "string", description: "One short beginner-facing judgment, no engine jargon." },
    question: { type: "string", description: "One concrete board-observation question the learner can answer before reading the explanation." },
    coreReason: { type: "string", description: "The single most useful reason or, if uncertain, what is actually known." },
    comparison: { type: "string", description: "Concrete comparison between the user's move and the engine preference." },
    showMe: { type: "string", description: "What the learner should watch on the board when replaying the routes." },
    remember: { type: "string", description: "One transferable beginner rule, only if supported by this case and appropriate for the learner stage." },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    evidenceRefs: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
  },
  required: ["status", "headline", "question", "coreReason", "comparison", "showMe", "remember", "confidence", "evidenceRefs"],
};

function coachHealth() {
  return {
    configured: Boolean(GEMINI_API_KEY),
    provider: "gemini",
    model: GEMINI_MODEL,
  };
}

function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 1200) : fallback;
}

function validateCoachOutput(raw, allowedEvidenceIds) {
  const confidence = ["high", "medium", "low"].includes(raw?.confidence) ? raw.confidence : "low";
  const status = raw?.status === "explained" ? "explained" : "uncertain";
  const evidenceRefs = Array.isArray(raw?.evidenceRefs)
    ? [...new Set(raw.evidenceRefs.filter((id) => typeof id === "string" && allowedEvidenceIds.has(id)))].slice(0, 8)
    : [];

  const safeStatus = status === "explained" && evidenceRefs.length === 0 ? "uncertain" : status;
  const safeConfidence = safeStatus === "uncertain" && confidence === "high" ? "low" : confidence;

  return {
    status: safeStatus,
    headline: cleanText(raw?.headline, "这步需要结合具体局面理解。"),
    question: cleanText(raw?.question, "先看棋盘：对手下一步最直接能做什么？"),
    coreReason: cleanText(raw?.coreReason, "目前证据不足，不能确定一个单一原因。"),
    comparison: cleanText(raw?.comparison, "当前只能确认两步的引擎评价与后续路线不同。"),
    showMe: cleanText(raw?.showMe, "在棋盘上逐步比较双方主变化。"),
    remember: cleanText(raw?.remember, "先看将军、吃子和受攻棋子，再考虑普通改善。"),
    confidence: safeConfidence,
    evidenceRefs,
  };
}

function buildSystemInstruction() {
  return `你是一名面向中国象棋初学者的教练。你遵循中国象棋入门教学的顺序，而不是把Pikafish最佳着直接当成教学目标。

必须遵守：
1. 先按照 teaching.focus 和 teaching.stage 判断当前学生真正应该学什么。13至16级阶段优先规则、将军、吃子、子力价值、躲避、保护、交换和两子配合；不要优先讲抽象长期战略。
2. 如果一手棋评价接近首选，而且没有触犯当前阶段的基础能力，明确告诉学生“这步可以下”，不要为了展示引擎差异而纠正。
3. 一次只教一个概念。先提出一个学生能直接看棋盘回答的问题，再给解释。
4. 任何“丢子、牵制、捉双、被攻击、失去保护”等战术事实，只能在 evidenceCatalog 明确支持时陈述。
5. 你可以根据棋盘和两条主变化做谨慎的战略层面推断，但必须表述为“从这条变化可以看到……”而不是声称这是Pikafish的真实心理原因。
6. 如果证据不足以解释为什么，status 必须是 uncertain；可以教学生观察什么，但不能填充一个假的原因。
7. question 必须具体到当前棋盘，例如“这辆车现在有谁保护？”“黑方下一步能不能将军？”；禁止“你觉得这步怎么样？”这类空问题。
8. remember 必须来自当前案例且符合 teaching.stage；禁止凭空给高级棋理。
9. 不要解释搜索深度、节点数等技术细节。输出中文，短句，像老师坐在棋盘边教学。
10. evidenceRefs 只能使用输入 evidenceCatalog 里存在的 id。`;
}

function compactCase(body) {
  const evidenceCatalog = Array.isArray(body?.evidenceCatalog) ? body.evidenceCatalog.slice(0, 40) : [];
  const base = {
    learner: "中国象棋初学者",
    move: body?.move || {},
    engine: body?.engine || {},
    board: body?.board || [],
    routes: body?.routes || {},
    signals: body?.signals || {},
    evidenceCatalog,
  };
  return {
    ...base,
    teaching: curriculumPrompt(base),
  };
}

async function callGemini(caseData) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COACH_TIMEOUT_MS);
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemInstruction() }],
        },
        contents: [{
          role: "user",
          parts: [{
            text: `请像中国象棋入门老师一样处理下面这一手棋。先遵守 teaching 中的教学层级和优先级，再决定是否值得纠正。不要重复原始数据。\n\n${JSON.stringify(caseData)}`,
          }],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: OUTPUT_SCHEMA,
          temperature: 0.15,
          maxOutputTokens: 750,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = payload?.error?.message || `Gemini request failed (${response.status})`;
      throw new Error(apiMessage);
    }
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    if (!text) throw new Error("Gemini returned an empty response");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function explainCoach(body) {
  if (!GEMINI_API_KEY) {
    const error = new Error("AI coach is not configured. Set GEMINI_API_KEY on the local server.");
    error.statusCode = 503;
    throw error;
  }
  const caseData = compactCase(body);
  const allowedEvidenceIds = new Set(caseData.evidenceCatalog.map((entry) => entry?.id).filter(Boolean));
  const raw = await callGemini(caseData);
  return {
    ...validateCoachOutput(raw, allowedEvidenceIds),
    teaching: caseData.teaching,
    provider: "gemini",
    model: GEMINI_MODEL,
  };
}

export { coachHealth, explainCoach };
