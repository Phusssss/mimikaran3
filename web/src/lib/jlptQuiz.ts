// Sinh đề luyện thi JLPT N3 (2 phần: 文字・語彙 + 読解) bằng AI.
// Phần đọc hiểu CHỈ dùng từ vựng của ngày hôm nay + các ngày trước đó.
import type { Word } from "./types";
import { callAiJson, looksJapanese, translateExplainsToVietnamese } from "./aiQuiz";

export type JlptVocabType =
  | "kanji-reading" // 問題1: đọc kanji -> chọn kana
  | "kanji-write"   // 問題2: kana -> chọn kanji
  | "context"       // 問題3: điền chỗ trống theo ngữ cảnh
  | "paraphrase"    // 問題4: câu đồng nghĩa / diễn đạt lại
  | "synonym"       // 問題5: từ gần nghĩa trong câu
  | "grammar";      // 文法: chọn mẫu ngữ pháp đúng

export type JlptVocabQ = {
  type: JlptVocabType;
  prompt: string;
  options: string[];
  answer: string;
  note?: string;  // nghĩa tiếng Việt của đáp án
  explain?: string; // giải thích vì sao đúng/sai từng phương án
};

export type JlptReading = {
  title?: string;
  passage: string;
  questions: {
    prompt: string;
    options: string[];
    answer: string;
    explain?: string;
  }[];
};

export type JlptQuiz = {
  vocab: JlptVocabQ[];
  reading: JlptReading[];
};

export type JlptResult =
  | { ok: true; quiz: JlptQuiz }
  | { ok: false; error: string };

export type ExamParts = { vocab: boolean; grammar: boolean; reading: boolean };

const LS_PARTS = "mimiN3_examparts_v1";

export function loadExamParts(): ExamParts {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PARTS) || "");
    return {
      vocab: raw?.vocab !== false,
      grammar: raw?.grammar !== false,
      reading: raw?.reading !== false,
    };
  } catch {
    return { vocab: true, grammar: true, reading: true };
  }
}

export function saveExamParts(p: ExamParts) {
  localStorage.setItem(LS_PARTS, JSON.stringify(p));
}

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Xáo trộn vị trí đáp án (AI có thói quen đặt đáp án đúng lên đầu). */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const VOCAB_TYPES = new Set([
  "kanji-reading", "kanji-write", "context", "paraphrase", "synonym", "grammar",
]);

function sanitizeVocab(raw: unknown[]): JlptVocabQ[] {
  const out: JlptVocabQ[] = [];
  const seen = new Set<string>();
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const obj = q as Record<string, unknown>;
    const type: JlptVocabType =
      isStr(obj.type) && VOCAB_TYPES.has(obj.type)
        ? (obj.type as JlptVocabType)
        : "context";
    const prompt = isStr(obj.prompt) ? obj.prompt.trim() : "";
    const options = Array.isArray(obj.options)
      ? obj.options.filter(isStr).map((s) => s.trim())
      : [];
    const answer = isStr(obj.answer) ? obj.answer.trim() : "";
    if (!prompt || options.length !== 4 || !answer || !options.includes(answer)) continue;
    if (new Set(options).size !== 4) continue;
    const key = prompt.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      type,
      prompt,
      options: shuffle(options),
      answer,
      note: isStr(obj.note) ? obj.note.trim() : undefined,
      explain: isStr(obj.explain) ? obj.explain.trim() : undefined,
    });
  }
  return out;
}

function sanitizeReading(raw: unknown): JlptReading[] {
  if (!Array.isArray(raw)) return [];
  const out: JlptReading[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const passage = isStr(obj.passage) ? obj.passage.trim() : "";
    if (passage.length < 60 || passage.length > 1500) continue;
    const title = isStr(obj.title) ? obj.title.trim() : undefined;
    const qRaw = Array.isArray(obj.questions) ? obj.questions : [];
    const questions: JlptReading["questions"] = [];
    for (const q of qRaw) {
      if (!q || typeof q !== "object") continue;
      const qq = q as Record<string, unknown>;
      const prompt = isStr(qq.prompt) ? qq.prompt.trim() : "";
      const options = Array.isArray(qq.options)
        ? qq.options.filter(isStr).map((s) => s.trim())
        : [];
      const answer = isStr(qq.answer) ? qq.answer.trim() : "";
      if (!prompt || options.length !== 4 || !answer || !options.includes(answer)) continue;
      if (new Set(options).size !== 4) continue;
      questions.push({
        prompt,
        options: shuffle(options),
        answer,
        explain: isStr(qq.explain) ? qq.explain.trim() : undefined,
      });
    }
    if (questions.length >= 1) out.push({ title, passage, questions });
  }
  return out;
}

function buildJlptPrompt(
  today: Word[],
  prev: Word[],
  grammar: { pattern: string; vi?: string; explanation?: string }[] = [],
  types?: Partial<Record<string, boolean>>,
  parts: ExamParts = { vocab: true, grammar: true, reading: true }
): string {
  const todayList = today
    .map(
      (w) =>
        `- ${w.kanji} | ${w.kana || ""} | nghĩa: ${w.vi || w.en || ""} | ví dụ: ${
          w.examples?.[0]?.ja || ""
        }`
    )
    .join("\n");
  // Từ đã học các ngày trước: danh sách gọn (kanji + nghĩa) — bài đọc được phép dùng
  const prevList = prev
    .slice(-400)
    .map((w) => `${w.kanji}(${w.vi || w.en || ""})`)
    .join(", ");
  const grammarList = grammar
    .map((g) => `- ${g.pattern} — nghĩa: ${g.vi || ""} — cách dùng: ${g.explanation || ""}`)
    .join("\n");
  const grammarSection =
    parts.grammar && grammar.length
      ? `

PHẦN 文法 (ngữ pháp) — BẮT BUỘC nếu có trong yêu cầu, 2 câu type "grammar" đặt trong mảng RIÊNG tên "grammar" (KHÔNG nhét vào mảng vocab):
- Câu 1: câu tiếng Nhật có （　） trống Ở VỊ TRÍ CẦN DÙNG MẪU NGỮ PHÁP, 4 lựa chọn là 4 MẪU NGỮ PHÁP GẦN GIỐNG NHAU (lấy từ danh sách NGỮ PHÁP HÔM NAY + các mẫu N3 cùng họ, vd: ことにしている / ことになっている / ようになっている). Đáp án = mẫu đúng với ngữ cảnh câu.
- Câu 2 (dạng sắp xếp 「文を並べ替え」): một câu tiếng Nhật được tách thành 4 phần đánh dấu ①②③④ — LIỆT KÊ 4 PHẦN NÀY THEO THỨ TỰ XÁO TRỘN (KHÔNG được in theo thứ tự đúng vì sẽ lộ đáp án), mỗi phần một dòng "① <nội dung phần>". Các lựa chọn (options) là 4 THỨ TỰ KHÁC NHAU dạng "②④①③" (mỗi lựa chọn là một chuỗi 4 số). answer = thứ tự đúng tạo thành câu đúng ngữ pháp.
Danh sách NGỮ PHÁP HÔM NAY (bắt buộc dùng):
${grammarList}`
      : "";

  // Phần 文字・語彙 dựng động theo cài đặt dạng câu người dùng chọn
  const t = types || {};
  const on = (k: string) => t[k] !== false;
  const wantReading = on("reading");
  const wantWrite = on("write");
  const wantContext = on("meaning");
  const wantParaphrase = on("reverse");
  const spec: string[] = [];
  if (wantReading) spec.push('- 2 câu type "kanji-reading" (問題1): câu tiếng Nhật có từ đang xét viết trong 〔 〕, chọn cách đọc kana đúng. Lựa chọn sai là cách đọc kana hợp lệ của từ khác cùng loại, KHÔNG phải biến thể vô nghĩa.');
  if (wantWrite) spec.push('- 2 câu type "kanji-write" (問題2): câu tiếng Nhật có từ dạng kana đặt trong 〔 〕, học viên chọn cách VIẾT kanji đúng. prompt = câu có 〔kana〕 (KHÔNG dùng dấu gạch dưới ____ thay thế).');
  if (wantContext) spec.push('- 1 câu type "context" (問題3): câu có （　） trống, chọn từ (trong trọng tâm hôm nay) hợp ngữ cảnh nhất. note = nghĩa tiếng Việt của đáp án.');
  if (wantParaphrase) spec.push('- 1 câu type "paraphrase" (問題4): cho câu dùng từ trọng tâm, chọn câu diễn đạt lại GẦN NGHĨA nhất. Các lựa chọn là câu hoàn chỉnh. note = giải thích ngắn.');
  const activeSpec = spec.length
    ? spec
    : ['- 2 câu type "kanji-reading" (問題1) + 2 câu type "kanji-write" (問題2) như mô tả ở trên.'];
  const nSpec = spec.length || 2;

  const readingSection = parts.reading
    ? `

PHẦN 読解 (đọc hiểu), 2 bài:
- Bài 1 (短文): đoạn văn 100–150 ký tự tiếng Nhật, 1 câu hỏi.
- Bài 2 (中文): đoạn văn 250–350 ký tự tiếng Nhật, 2 câu hỏi (ví dụ: câu hỏi nội dung và câu hỏi 「この文章の筆者は何と言いたいのか」 kiểu chọn ý chính).
QUY TẮC BÀI ĐỌC — RẤT QUAN TRỌNG:
- CHỈ dùng từ vựng thuộc 2 danh sách trên (bài hôm nay ưu tiên dùng nhiều). Ngoại lệ duy nhất: trợ từ, chỉ từ cơ bản (これ・その・あの・この・こんな…), và ngữ pháp N4/N3 (だ・である・のに・ても・ように…).
- KHÔNG dùng kanji ngoài danh sách. Nếu cần từ chưa học, hãy diễn đạt lại bằng từ trong danh sách.`
    : "";

  const explainSpec = [
    parts.vocab && wantReading ? '+ type "kanji-reading": giải thích cách đọc của từ đúng, chỉ rõ từng lựa chọn sai là cách đọc của từ gì.' : "",
    parts.vocab && wantWrite ? '+ type "kanji-write": giải thích kanji của đáp án, và các lựa chọn sai là kanji của từ gì.' : "",
    parts.vocab && wantContext ? '+ type "context": giải thích nghĩa của đáp án và vì sao hợp ngữ cảnh; mỗi lựa chọn sai nghĩa là gì.' : "",
    parts.vocab && wantParaphrase ? '+ type "paraphrase": diễn giải nghĩa câu gốc, cho biết đáp án diễn đạt lại ý nào; các phương án sai sai ở ý gì.' : "",
    parts.grammar && grammar.length ? '+ type "grammar": giải thích nghĩa/cách dùng của mẫu đúng, vì sao các mẫu khác không hợp với câu này.' : "",
    parts.reading ? "+ Bài đọc: trích câu liên quan trong đoạn văn làm bằng chứng, giải thích vì sao đáp án đúng; nêu ngắn gọn lý do các phương án khác sai." : "",
  ].filter(Boolean).join("\n");

  return `Bạn là giáo viên tiếng Nhật soạn ĐỀ LUYỆN THI JLPT N3 (chuẩn format đề thi thật của Japan Foundation) cho học viên Việt Nam.

=== TỪ VỰNG BÀI HỌC HÔM NAY (trọng tâm của đề) ===
${todayList}

=== TỪ VỰNG ĐÃ HỌC CÁC NGÀY TRƯỚC (được phép dùng trong bài đọc) ===
${prevList}

Hôm nay chỉ soạn CÁC PHẦN SAU (tuyệt đối không soạn phần khác): ${[
    parts.vocab ? "文字・語彙" : "",
    parts.grammar && grammar.length ? "文法" : "",
    parts.reading ? "読解" : "",
  ].filter(Boolean).join(" + ")}

${parts.vocab ? `PHẦN 文字・語彙 (từ vựng), gồm: ${nSpec === 4 ? "2 câu kanji-reading + 2 câu kanji-write + 1 câu context + 1 câu paraphrase" : Math.max(2, Math.min(4, Math.floor(6 / nSpec))) + " câu mỗi loại"}:
${activeSpec.join("\n")}` : ""}${grammarSection}${readingSection}

QUY TẮC CHUNG:
- CÂU TIẾNG NHẬP PHẢI ĐÚNG NGỮ PHÁP CHUẨN, KHÔNG lỗi chính tả, KHÔNG trùng lặp nghĩa (VD SAI: 「２０歳で〔にじゅうさい〕に成人した」 vì 20 tuổi bị nhắc 2 lần; SAI: 「飲みに行きいきます」 — phải là 「飲みに行きます」).
- VỊ TRÍ ĐÁP ÁN NGẪU NHIÊN: mỗi câu đặt đáp án đúng ở vị trí khác nhau (1,2,3,4 trộn lẫn), TUYỆT ĐỐI không dồn đáp án về vị trí đầu.
- MỌI TRƯỜNG EXPLAIN PHẢI VIẾT BẰNG TIẾNG VIỆT HOÀN TOÀN (người học là người Việt).
- MỖI CÂU HỎI phải có trường "explain" — GIẢI THÍCH 2–4 câu:
${explainSpec}

Trả về DUY NHẤT một JSON với ĐÚNG 3 mảng (phần nào không yêu cầu → mảng rỗng []):
{"vocab":[{"type":"kanji-reading|kanji-write|context|paraphrase","prompt":"...","options":["1","2","3","4"],"answer":"đáp án","note":"nghĩa VN (tuỳ chọn)","explain":"giải thích tiếng Việt"}],
 "grammar":[{"type":"grammar","prompt":"...","options":["..."],"answer":"...","explain":"..."}],
 "reading":[{"title":"tiêu đề ngắn (tuỳ chọn)","passage":"đoạn văn tiếng Nhật","questions":[{"prompt":"câu hỏi","options":["..."],"answer":"...","explain":"giải thích tiếng Việt, trích dẫn bằng chứng trong bài"}]}]}

NHẮC LẦN CUỐI: toàn bộ giá trị trường "explain" PHẢI là TIẾNG VIỆT thuần (chỉ kanji/kana được xuất hiện khi trích từ trong câu ví dụ). Không viết explain bằng tiếng Nhật.
MỐI QUAN HỆ BẮT BUỘC VỀ SỐ LƯỢNG: kết quả LUÔN gồm đúng 3 mảng "vocab", "grammar", "reading" — phần nào không được yêu cầu thì trả mảng RỖNG []. "grammar" chỉ chứa câu type "grammar". Mảng "reading" có đúng 2 bài khi 読解 được yêu cầu.`;
}

const MARKERS = ["①", "②", "③", "④"];

/** Câu sắp xếp: nếu AI in các phần đúng thứ tự (answer = ①②③④) thì
 *  xáo trộn lại thứ tự phần trong đề + ánh xạ lại mọi option/đáp án.
 *  Marker ①②③④ có thể nằm inline hoặc đầu dòng — remap theo thứ tự xuất hiện. */
function fixOrderingLeak(q: JlptVocabQ): JlptVocabQ {
  const isOrdering =
    /^[①②③④]{4}$/.test(q.answer) &&
    q.options.every((o) => /^[①②③④]{4}$/.test(o));
  if (!isOrdering) return q;

  const markerCount = (q.prompt.match(/[①②③④]/g) || []).length;
  if (markerCount !== 4) return q; // format lạ — giữ nguyên

  let perm = shuffleArr([0, 1, 2, 3]);
  if (perm.every((v, i) => v === i)) perm = [1, 2, 3, 0]; // tránh hoán vị đồng nhất

  const remap = (s: string) =>
    s.replace(/[①②③④]/g, (ch) => MARKERS[perm[MARKERS.indexOf(ch)]]);

  const newPrompt = remap(q.prompt);
  const options = q.options.map(remap);
  const answer = remap(q.answer);
  if (answer === "①②③④") return fixOrderingLeak(q); // phủ định chắc chắn không lặp vô hạn (bỏ trường hợp đồng nhất)
  return { ...q, prompt: newPrompt, options, answer };
}

export async function generateJlptQuiz(
  today: Word[],
  prev: Word[],
  grammar: { pattern: string; vi?: string; explanation?: string }[] = [],
  shuffleOrder = false,
  types?: Partial<Record<string, boolean>>,
  parts: ExamParts = { vocab: true, grammar: true, reading: true }
): Promise<JlptResult> {
  const system =
    "Bạn là giáo viên tiếng Nhật NGƯỜI VIỆT, chuyên soạn đề luyện thi JLPT N3 cho học viên người Việt. Mọi lời giải thích (explain) PHẢI viết bằng tiếng Việt thuần. Chỉ trả về một JSON hợp lệ.";
  try {
    const parsed = (await callAiJson(
      buildJlptPrompt(today, prev, grammar, types, parts),
      system
    )) as {
      vocab?: unknown[];
      grammar?: unknown[];
      reading?: unknown[];
    };
    let vocab = sanitizeVocab(parsed?.vocab || []);
    const grammarQs = sanitizeVocab(parsed?.grammar || []);
    let reading = sanitizeReading(parsed?.reading || []);
    // chỉ giữ phần người dùng chọn
    if (!parts.vocab) vocab = [];
    if (parts.grammar && grammar.length)
      vocab = [...vocab, ...grammarQs.map(fixOrderingLeak)];
    if (!parts.reading) reading = [];
    const minOK =
      (parts.vocab ? vocab.some((q) => q.type !== "grammar") : true) &&
      (parts.grammar && grammar.length ? grammarQs.length >= 1 : true) &&
      (parts.reading ? reading.length >= 1 : true) &&
      vocab.length + reading.length >= 3;
    if (!minOK) {
      return { ok: false, error: "Đề JLPT sinh ra không đủ phần đã chọn — thử lại" };
    }
    if (shuffleOrder) {
      // trộn đều các câu trắc nghiệm (kể cả 文法) và thứ tự câu hỏi trong từng bài đọc
      vocab = shuffleArr(vocab);
      reading = shuffleArr(reading).map((r) => ({ ...r, questions: shuffleArr(r.questions) }));
    }

    // AI hay viết giải thích bằng tiếng Nhật -> dịch hàng loạt sang tiếng Việt.
    // Giữ THAM CHIẾU TRỰC TIẾP tới từng câu hỏi để tránh lệch chỉ số khi gán ngược.
    const need: { target: { explain?: string }; text: string }[] = [];
    vocab.forEach((q) => {
      if (q.explain && looksJapanese(q.explain)) need.push({ target: q, text: q.explain });
    });
    reading.forEach((r) =>
      r.questions.forEach((q) => {
        if (q.explain && looksJapanese(q.explain)) need.push({ target: q, text: q.explain });
      })
    );
    if (need.length) {
      const translated = await translateExplainsToVietnamese(need.map((e) => e.text));
      need.forEach((e, i) => {
        if (translated.has(i)) e.target.explain = translated.get(i);
      });
    }

    return { ok: true, quiz: { vocab, reading } };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      return { ok: false, error: "Quá thời gian chờ AI" };
    return { ok: false, error: e instanceof Error ? e.message : "Lỗi không rõ" };
  }
}
