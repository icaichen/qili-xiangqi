import { curriculumPrompt } from "./xiangqi-teaching-curriculum.mjs";

const COACH_PROVIDER = process.env.COACH_PROVIDER || "aliyun-bailian";
const COACH_API_KEY = process.env.COACH_API_KEY || process.env.DASHSCOPE_API_KEY || "";
const COACH_BASE_URL = String(process.env.COACH_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/+$/, "");
const COACH_MODEL = process.env.COACH_MODEL || "qwen3.7-plus";
const COACH_ENABLE_THINKING = String(process.env.COACH_ENABLE_THINKING || "false").toLowerCase() === "true";
const COACH_TIMEOUT_MS = Math.min(30000, Math.max(5000, Number(process.env.COACH_TIMEOUT_MS || 18000)));

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["explained", "uncertain"] },
    headline: { type: "string", description: "One short learner-facing judgment, no engine jargon." },
    question: { type: "string", description: "One concrete board-observation question the learner can answer before reading the explanation." },
    coreReason: { type: "string", description: "The single most useful reason or, if uncertain, what is actually known." },
    comparison: { type: "string", description: "Concrete comparison between the user's move and the engine preference." },
    showMe: { type: "string", description: "What the learner should watch on the board when replaying the routes." },
    remember: { type: "string", description: "One transferable takeaway, only if supported by this case." },
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
    configured: Boolean(COACH_API_KEY && COACH_BASE_URL && COACH_MODEL),
    provider: COACH_PROVIDER,
    model: COACH_MODEL,
    thinking: COACH_ENABLE_THINKING,
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
    remember: cleanText(raw?.remember, "先看强制手和局势变化，再判断引擎推荐是否有可理解的原因。"),
    confidence: safeConfidence,
    evidenceRefs,
  };
}

function buildSystemInstruction(mode = "play") {
  if (mode === "review") {
    return `你是一名中国象棋复盘教练。你的任务不是告诉学生“引擎说这步更好”，而是解释局势为什么会因为两种选择而走向不同结果。

必须遵守：
1. 优先比较 routes.your 与 routes.best 的真实主变化，寻找两条路线最早出现的关键差异。关键差异可能立即出现，也可能在数手之后才暴露。
2. 解释必须形成因果链：这一步改变了什么 → 对手因此获得什么机会或你失去什么资源 → 后续为什么出现被迫应对、子力损失、将军、活动性或安全性变化 → 为什么最终评价不同。
3. 不要强行把复杂局面归类成课程概念。不要为了教学而制造“保护、中心、发展”等标签。只有证据真正支持时才说。
4. 任何“丢子、牵制、捉双、被攻击、失去保护”等战术事实，只能在 evidenceCatalog 明确支持时陈述。
5. 可以根据完整棋盘、position signals 和两条主变化做谨慎的局势推断，例如主动权、连续先手、棋子活动范围、将帅安全、关键线路或交换后的局面差异；必须表述为“从这条变化可以看到……”而不是声称这是 Pikafish 的心理原因。
6. 如果坏处直到第3、第6或更后面的着法才出现，要明确告诉用户“这步没有立即出问题，后果在第X步开始显现”，并指出那一刻发生了什么。
7. 如果两条路线都很复杂，无法从提供证据中得到可靠的人类可解释原因，status 必须是 uncertain。可以说“目前只能确认这条主变化更精确”，不能编造战略理由。
8. question 要让用户观察当前棋盘或路线中的一个具体变化。showMe 要明确建议看哪一条路线、看到第几步或哪个事件。
9. remember 不是课程标签，而是一句从本局真实因果中提炼出的可迁移思考方式；如果没有可靠规律，可以直接说“这类局面要具体计算，不必记成规则”。
10. evidenceRefs 只能使用输入 evidenceCatalog 里存在的 id。输出中文，短句，像老师坐在棋盘边复盘。`;
  }

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
  const mode = body?.mode === "review" ? "review" : "play";
  const evidenceCatalog = Array.isArray(body?.evidenceCatalog) ? body.evidenceCatalog.slice(0, 40) : [];
  const base = {
    mode,
    learner: mode === "review" ? "希望理解局势与变化原因的中国象棋棋手" : "中国象棋初学者",
    move: body?.move || {},
    engine: body?.engine || {},
    board: body?.board || [],
    routes: body?.routes || {},
    signals: body?.signals || {},
    evidenceCatalog,
  };
  return {
    ...base,
    teaching: mode === "review" ? null : curriculumPrompt(base),
  };
}

function coachEndpoint() {
  return COACH_BASE_URL.endsWith("/chat/completions")
    ? COACH_BASE_URL
    : `${COACH_BASE_URL}/chat/completions`;
}

function coachUserPrompt(caseData) {
  const instruction = caseData.mode === "review"
    ? "请复盘下面这个关键局面。重点回答：为什么用户的走法比首选差，以及差异究竟在哪一步开始真正显现。优先解释局势变化和因果链，不要只复述引擎分数或主变化。"
    : "请像中国象棋入门老师一样处理下面这一手棋。先遵守 teaching 中的教学层级和优先级，再决定是否值得纠正。不要重复原始数据。";
  return `${instruction}\n\n请严格以 JSON 格式输出，并遵守这个 JSON Schema：${JSON.stringify(OUTPUT_SCHEMA)}\n\n${JSON.stringify(caseData)}`;
}

function responseText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    return part?.text || part?.content || "";
  }).join("").trim();
}

function parseJsonResponse(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

async function callCoachModel(caseData) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COACH_TIMEOUT_MS);
  try {
    const requestBody = {
      model: COACH_MODEL,
      messages: [
        {
          role: "system",
          content: `${buildSystemInstruction(caseData.mode)}\n\n最终答案必须是一个 JSON 对象，不要输出 Markdown 或额外说明。`,
        },
        {
          role: "user",
          content: coachUserPrompt(caseData),
        },
      ],
      temperature: 0.15,
      response_format: { type: "json_object" },
      max_completion_tokens: 900,
    };
    if (COACH_PROVIDER === "aliyun-bailian") {
      requestBody.enable_thinking = COACH_ENABLE_THINKING;
    }

    const response = await fetch(coachEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${COACH_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify(requestBody),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = payload?.error?.message || `${COACH_PROVIDER} request failed (${response.status})`;
      throw new Error(apiMessage);
    }
    const text = responseText(payload?.choices?.[0]?.message?.content);
    if (!text) throw new Error(`${COACH_PROVIDER} returned an empty response`);
    return parseJsonResponse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function explainCoach(body) {
  if (!COACH_API_KEY || !COACH_BASE_URL || !COACH_MODEL) {
    const error = new Error("AI coach is not configured. Set COACH_API_KEY, COACH_BASE_URL and COACH_MODEL on the server.");
    error.statusCode = 503;
    throw error;
  }
  const caseData = compactCase(body);
  const allowedEvidenceIds = new Set(caseData.evidenceCatalog.map((entry) => entry?.id).filter(Boolean));
  const raw = await callCoachModel(caseData);
  return {
    ...validateCoachOutput(raw, allowedEvidenceIds),
    teaching: caseData.teaching,
    provider: COACH_PROVIDER,
    model: COACH_MODEL,
  };
}

export { coachHealth, explainCoach };
