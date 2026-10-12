// Sinh đề kiểm tra bằng AI. Hỗ trợ đa nhà cung cấp:
//   - Groq / OpenRouter / Z.ai / tuỳ chỉnh  (chuẩn OpenAI-compatible)
//   - Gemini (Google, dùng responseSchema riêng)
// Key lưu localStorage trên máy người dùng. Không key / lỗi -> app dùng đề cơ bản.
import type { Word } from "./types";
import type { ExerciseItem } from "./quiz";
import { shuffle } from "./quiz";

const LS_CFG = "mimiN3_ai_v2";

export type ProviderId = "gemini" | "groq" | "openrouter" | "zai" | "custom";

export const AI_PRESETS: Record<
  ProviderId,
  { label: string; base: string; models: string[]; hint: string }
> = {
  groq: {
    label: "Groq — miễn phí, rất nhanh",
    base: "https://api.groq.com/openai/v1",
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
    hint: "Lấy key miễn phí: console.groq.com → API Keys → Create API Key (không cần thẻ).",
  },
  openrouter: {
    label: "OpenRouter — model miễn phí (:free)",
    base: "https://openrouter.ai/api/v1",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-chat-v3.1:free",
      "qwen/qwen3-235b-a22b:free",
    ],
    hint: "Lấy key: openrouter.ai → Keys → Create Key. Dùng model có đuôi :free.",
  },
  zai: {
    label: "Z.ai — GLM Flash (free tier)",
    base: "https://api.z.ai/api/paas/v4",
    models: ["glm-4.7-flash", "glm-4-flash", "glm-4-flashx"],
    hint: "Lấy key: z.ai → API Keys. Model flash có mức miễn phí.",
  },
  gemini: {
    label: "Gemini — Google (cần credit)",
    base: "",
    models: ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3-flash-preview"],
    hint: "Key: aistudio.google.com/apikey. Lưu ý: tài khoản mới cần nạp credit tại ai.studio/projects.",
  },
  custom: {
    label: "Khác (OpenAI-compatible)",
    base: "",
    models: [],
    hint: "Nhập Base URL (vd: https://.../v1) và tên model theo nhà cung cấp của bạn.",
  },
};

export type AiConfig = {
  provider: ProviderId;
  model: string;
  keys: Partial<Record<ProviderId, string>>;
};

const DEFAULT_CFG: AiConfig = {
  provider: "groq",
  model: "openai/gpt-oss-120b",
  keys: {},
};

export function getAiConfig(): AiConfig {
  const envGemini = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim();
  const envGroq = (process.env.NEXT_PUBLIC_GROQ_API_KEY || "").trim();
  try {
    const raw = JSON.parse(localStorage.getItem(LS_CFG) || "");
    const cfg: AiConfig = { ...DEFAULT_CFG, ...raw, keys: { ...raw?.keys } };
    if (envGemini && !cfg.keys.gemini) cfg.keys.gemini = envGemini;
    if (envGroq && !cfg.keys.groq) cfg.keys.groq = envGroq;
    return cfg;
  } catch {
    return {
      ...DEFAULT_CFG,
      keys: {
        ...(envGemini ? { gemini: envGemini } : {}),
        ...(envGroq ? { groq: envGroq } : {}),
      },
    };
  }
}

export function saveAiConfig(cfg: AiConfig) {
  localStorage.setItem(LS_CFG, JSON.stringify(cfg));
}

/* ---------------- shared prompt ---------------- */

function buildPrompt(words: Word[]): string {
  const list = words
    .map(
      (w) =>
        `- ${w.kanji} | ${w.kana || ""} | nghĩa: ${w.vi || w.en || ""} | ví dụ: ${
          w.examples?.[0]?.ja || "không có"
        }`
    )
    .join("\n");
  return `Bạn là giáo viên tiếng Nhật soạn bài luyện tập từ vựng JLPT N3 cho học viên Việt Nam.
Dưới đây là danh sách từ vựng của BÀI HỌC HÔM NAY (kanji | kana | nghĩa | ví dụ):

${list}

Hãy soạn bài kiểm tra gồm ĐÚNG các phần sau, theo thứ tự:
1. Phần "Nghĩa của từ" — 4 câu: cho từ tiếng Nhật (kana đọc ghi dưới dạng trường word), chọn nghĩa tiếng Việt đúng (4 lựa chọn).
2. Phần "Chọn từ theo nghĩa" — 4 câu: cho nghĩa tiếng Việt trong prompt, chọn từ tiếng Nhật đúng (4 lựa chọn).
3. Phần "Cách đọc đúng" — 4 câu: cho từ, chọn cách đọc kana đúng (4 lựa chọn). Các lựa chọn sai phải là cách đọc kana HỢP LỆ của từ khác trong bài, độ dài tương tự.
4. Phần "Nghe và chọn" — 3 câu: người học NGHE từ rồi chọn từ tiếng Nhật vừa nghe (4 lựa chọn là các từ kanji). Trường audio = kana của từ đáp án.
5. Phần "Điền vào câu ví dụ" — 3 câu: lấy câu ví dụ của từ trong bài, thay từ cần điền bằng ký tự ◯, học viên chọn từ đúng (4 lựa chọn). Trường hint = nghĩa tiếng Việt của câu đó. Chỉ dùng câu có thật trong danh sách trên, KHÔNG bịa câu mới.
6. Phần "Nối từ với nghĩa" — 1 câu dạng ghép cặp: 5 cặp từ–nghĩa lấy từ bài học hôm nay.

QUY TẮC BẮT BUỘC:
- Lựa chọn sai (distractor) phải cùng từ loại, cùng chủ đề, gây nhầm lẫn hợp lý, KHÔNG lộ đáp án.
- Nghĩa tiếng Việt lấy đúng như danh sách, có thể viết lại tự nhiên hơn nhưng KHÔNG đổi ý nghĩa.
- Mỗi câu 4 lựa chọn, không trùng nhau, đáp án nằm trong lựa chọn.
- Chỉ dùng các từ trong danh sách trên.

Trả về duy nhất một JSON (không kèm chữ nào khác) dạng:
{"items":[{"kind":"mc","section":"Nghĩa của từ","prompt":"...","options":["a","b","c","d"],"answer":"a","word":"từ kanji","explain":"giải thích tiếng Việt 1-2 câu: nghĩa từ, vì sao các phương án khác sai"},{"kind":"mc","section":"Nghe và chọn","prompt":"...","options":["..."],"answer":"...","audio":"kana","explain":"..."},{"kind":"match","section":"Nối từ với nghĩa","pairs":[{"word":"...","meaning":"..."}]}]}
Mỗi câu mc bắt buộc có "explain" tiếng Việt (1–2 câu): nghĩa của đáp án + lý do các phương án khác sai (nêu nghĩa thật của từng lựa chọn sai). Vị trí đáp án trong options phải NGẪU NHIÊN (không luôn đứng đầu).
Giá trị section chỉ được là: "Nghĩa của từ", "Chọn từ theo nghĩa", "Cách đọc đúng", "Nghe và chọn", "Điền vào câu ví dụ", "Nối từ với nghĩa".`;
}

/* ---------------- response validation ---------------- */

type AiQuestion = {
  kind?: unknown;
  section?: unknown;
  prompt?: unknown;
  options?: unknown;
  answer?: unknown;
  audio?: unknown;
  hint?: unknown;
  explain?: unknown;
  word?: unknown;
  pairs?: unknown;
};

const SECTIONS = [
  "Nghĩa của từ",
  "Chọn từ theo nghĩa",
  "Cách đọc đúng",
  "Nghe và chọn",
  "Điền vào câu ví dụ",
  "Nối từ với nghĩa",
] as const;

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function sanitize(raw: AiQuestion[]): ExerciseItem[] {
  const seenPrompts = new Set<string>();
  const out: ExerciseItem[] = [];

  for (const q of raw) {
    if (q.kind === "match") {
      const pairsRaw = Array.isArray(q.pairs) ? q.pairs : [];
      const pairs: { word: string; meaning: string }[] = [];
      const seenW = new Set<string>();
      for (const p of pairsRaw) {
        const word = isStr(p?.word) ? p.word.trim() : "";
        const meaning = isStr(p?.meaning) ? p.meaning.trim() : "";
        if (word && meaning && !seenW.has(word)) {
          seenW.add(word);
          pairs.push({ word, meaning });
        }
      }
      if (pairs.length >= 4) {
        out.push({
          kind: "match",
          section: "Nối từ với nghĩa",
          prompt: "Bấm một từ rồi bấm nghĩa tương ứng.",
          pairs: pairs.slice(0, 6),
        });
      }
      continue;
    }

    const options = Array.isArray(q.options)
      ? q.options.filter(isStr).map((s) => s.trim())
      : [];
    const answer = isStr(q.answer) ? q.answer.trim() : "";
    const prompt = isStr(q.prompt) ? q.prompt.trim() : "";
    if (!prompt || options.length !== 4 || !answer || !options.includes(answer)) continue;
    if (new Set(options).size !== 4) continue;
    if (seenPrompts.has(prompt)) continue;
    seenPrompts.add(prompt);

    const section = SECTIONS.find((s) => s === q.section) ?? SECTIONS[0];
    out.push({
      kind: "mc",
      section,
      prompt,
      word: { kanji: isStr(q.word) ? q.word : "", no: null } as Word,
      options: shuffle(options), // chống AI đặt đáp án luôn ở vị trí đầu
      answer,
      audio: section === "Nghe và chọn" && isStr(q.audio) ? q.audio : undefined,
      hint: isStr(q.hint) ? q.hint : undefined,
      explain: isStr(q.explain) ? q.explain.trim() : undefined,
    });
  }
  return out;
}

function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

/* ---------------- providers ---------------- */

export type AiQuizResult =
  | { ok: true; items: ExerciseItem[] }
  | { ok: false; error: string };

/* ---------------- dịch explain sang tiếng Việt ---------------- */

/** Phát hiện giải thích KHÔNG phải tiếng Việt (tiếng Nhật: nhiều kana;
 *  tiếng Trung: nhiều chữ Hán mà ít chữ Latinh). Tiếng Việt chuẩn có chữ
 *  Latinh đậm đặc, chỉ trích dẫn vài từ kanji/kana nên tỷ lệ CJK thấp. */
export function looksJapanese(s: string): boolean {
  if (!s) return false;
  const kana = (s.match(/[\u3040-\u30ff]/g) || []).length;
  const cjk = (s.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  const latin = (s.match(/[a-zA-ZÀ-ỹ]/g) || []).length;
  const n = s.length;
  if (kana / n > 0.2) return true;                 // tiếng Nhật
  if (cjk / n > 0.35 && latin / n < 0.35) return true; // tiếng Trung
  return false;
}

/** Dịch hàng loạt explain sang tiếng Việt trong một lượt gọi AI.
 *  Trả về map: vị trí trong danh sách (0-based) -> bản dịch. */
export async function translateExplainsToVietnamese(
  texts: string[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!texts.length) return map;
  const list = texts.map((t, i) => `${i}. ${t}`).join("\n");
  try {
    const parsed = (await callAiJson(
      `Dịch các giải thích sau đây sang tiếng Việt tự nhiên, dễ hiểu cho học viên người Việt (giữ nguyên các từ tiếng Nhật/kanji/kana khi chúng được trích dẫn làm ví dụ). "i" là số thứ tự dòng bắt đầu từ 0. Trả về JSON: {"items":[{"i":0,"explain":"bản dịch"},...]}\n\n${list}`
    )) as { items?: { i?: unknown; explain?: unknown }[] };
    if (Array.isArray(parsed?.items)) {
      for (const p of parsed.items) {
        const i = typeof p?.i === "number" ? p.i : -1;
        if (i >= 0 && i < texts.length && typeof p.explain === "string" && p.explain.trim()) {
          map.set(i, p.explain.trim());
        }
      }
    }
  } catch {
    /* lỗi dịch: giữ nguyên bản gốc */
  }
  return map;
}

/** Gọi AI (provider đang cấu hình) với 1 prompt, trả về object JSON đã parse. */
export async function callAiJson(prompt: string, system?: string): Promise<unknown> {
  const cfg = getAiConfig();
  const apiKey = cfg.keys[cfg.provider] || "";
  if (!apiKey) throw new Error("Chưa nhập API key");
  const sys =
    system ||
    "Bạn là giáo viên tiếng Nhật soạn đề JLPT N3. Luôn trả về JSON hợp lệ duy nhất. Mọi phần giải thích viết bằng TIẾNG VIỆT.";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    if (cfg.provider === "gemini") {
      return await geminiJson(cfg, apiKey, sys + "\n\n" + prompt, controller.signal);
    }
    const base =
      cfg.provider === "custom" ? getCustomBase() : AI_PRESETS[cfg.provider].base;
    if (!base) throw new Error("Chưa nhập địa chỉ API (base URL)");
    return await openAiJson(cfg, base, apiKey, sys, prompt, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function openAiJson(
  cfg: AiConfig,
  base: string,
  apiKey: string,
  system: string,
  prompt: string,
  signal: AbortSignal
): Promise<unknown> {
  const messages = [
    {
      role: "system",
      content: system,
    },
    { role: "user", content: prompt },
  ];

  async function call(withJsonMode: boolean) {
    const body: Record<string, unknown> = {
      model: cfg.model,
      temperature: 0.8,
      messages,
      max_completion_tokens: 8192,
    };
    if (/gpt-oss/.test(cfg.model)) body.reasoning_effort = "low"; // ưu tiên token cho JSON
    if (withJsonMode) body.response_format = { type: "json_object" };
    return fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify(body),
    });
  }

  let res = await call(true);
  // Model reasoning (gpt-oss...) có thể sinh JSON hỏng khi dùng json mode -> thử lại không json mode
  if (res.status === 400) {
    const t = await res.text();
    if (t.includes("json_validate") || t.includes("Failed to validate JSON")) {
      res = await call(false);
    }
  }
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 401) throw new Error("API key sai hoặc chưa kích hoạt");
    if (res.status === 402 || res.status === 403)
      throw new Error("Tài khoản chưa đủ điều kiện dùng model này (402/403)");
    if (res.status === 429)
      throw new Error("Vượt giới hạn tần suất — thử lại sau ít phút");
    if (res.status === 404)
      throw new Error(`Model "${cfg.model}" không tồn tại ở nhà cung cấp này`);
    throw new Error(`Lỗi API ${res.status}: ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("AI không trả về nội dung");
  return extractJson(content);
}

async function geminiJson(
  cfg: AiConfig,
  apiKey: string,
  prompt: string,
  signal: AbortSignal
): Promise<unknown> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 402)
      throw new Error("Tài khoản Gemini hết credit — nạp tại ai.studio/projects");
    if (res.status === 429)
      throw new Error("Gemini đang quá tải/giới hạn tần suất");
    if (t.includes("no longer available"))
      throw new Error(`Model ${cfg.model} không khả dụng với tài khoản này`);
    if (res.status === 400 && t.includes("API_KEY"))
      throw new Error("Key Gemini không hợp lệ");
    throw new Error(`Gemini API lỗi ${res.status}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini không trả về nội dung");
  return extractJson(text);
}

const SECTION_TO_TYPE: Record<string, string> = {
  "Nghĩa của từ": "meaning",
  "Chọn từ theo nghĩa": "reverse",
  "Cách đọc đúng": "reading",
  "Viết kanji": "write",
  "Nghe và chọn": "listening",
  "Điền vào câu ví dụ": "blank",
  "Nối từ với nghĩa": "match",
};

export async function generateAiExercises(
  words: Word[],
  settings?: { types: Record<string, boolean>; shuffle: boolean }
): Promise<AiQuizResult> {
  const cfg = getAiConfig();
  if (!cfg.keys[cfg.provider]) return { ok: false, error: "no_key" };
  try {
    const parsed = (await callAiJson(buildPrompt(words))) as { items?: AiQuestion[] };
    let items = sanitize(Array.isArray(parsed?.items) ? parsed.items : []);
    if (items.length < 6) return { ok: false, error: "Đề sinh ra không đạt chuẩn" };

    // lọc theo các dạng câu người dùng bật trong Cài đặt đề
    if (settings) {
      items = items.filter((it) => {
        const tid = SECTION_TO_TYPE[it.section];
        return tid ? settings.types[tid] !== false : true;
      });
      if (items.length < 4) {
        return { ok: false, error: "Cài đặt đề đang tắt gần hết dạng câu" };
      }
      if (settings.shuffle) items = shuffle(items);
    }

    // dịch explain tiếng Nhật (nếu có) sang tiếng Việt — tham chiếu trực tiếp
    const need: { target: { explain?: string }; text: string }[] = [];
    items.forEach((it) => {
      if (it.kind === "mc" && it.explain && looksJapanese(it.explain)) {
        need.push({ target: it, text: it.explain });
      }
    });
    if (need.length) {
      const translated = await translateExplainsToVietnamese(need.map((e) => e.text));
      need.forEach((e, i) => {
        if (translated.has(i)) e.target.explain = translated.get(i);
      });
    }

    return { ok: true, items };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      return { ok: false, error: "Quá thời gian chờ AI" };
    return { ok: false, error: e instanceof Error ? e.message : "Lỗi không rõ" };
  }
}

/* ---------------- custom provider helper ---------------- */

const LS_CUSTOM_BASE = "mimiN3_ai_custom_base";

export function getCustomBase(): string {
  return localStorage.getItem(LS_CUSTOM_BASE) || "";
}
export function setCustomBase(url: string) {
  localStorage.setItem(LS_CUSTOM_BASE, url.trim());
}

/** Ping nhỏ để kiểm tra key + model ngay trong UI. */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = getAiConfig();
  const apiKey = cfg.keys[cfg.provider] || "";
  if (!apiKey) return { ok: false, message: "Chưa nhập API key" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    if (cfg.provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { signal: controller.signal }
      );
      if (res.ok) return { ok: true, message: `Kết nối OK — key Gemini hợp lệ` };
      if (res.status === 402) return { ok: false, message: "Key đúng nhưng hết credit — nạp tại ai.studio/projects" };
      return { ok: false, message: `Key Gemini bị từ chối (HTTP ${res.status})` };
    }
    const base = cfg.provider === "custom" ? getCustomBase() : AI_PRESETS[cfg.provider].base;
    if (!base) return { ok: false, message: "Chưa nhập Base URL" };
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
      }),
    });
    if (res.ok) return { ok: true, message: `Kết nối OK — ${cfg.model} sẵn sàng` };
    if (res.status === 401) return { ok: false, message: "API key sai hoặc chưa kích hoạt" };
    if (res.status === 404) return { ok: false, message: `Model "${cfg.model}" không tồn tại — kiểm tra tên model` };
    if (res.status === 429) return { ok: false, message: "Vượt giới hạn tần suất — key hoạt động nhưng đang bận" };
    return { ok: false, message: `Lỗi HTTP ${res.status}` };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      return { ok: false, message: "Quá thời gian kết nối" };
    return { ok: false, message: "Không kết nối được máy chủ AI" };
  } finally {
    clearTimeout(timer);
  }
}
