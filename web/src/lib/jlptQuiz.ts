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
  types?: Partial<Record<string, boolean>>
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
  const grammarSection = grammar.length
    ? `

PHẦN 文法 (ngữ pháp) — BẮT BUỘC, đặt NGAY SAU các câu từ vựng và TRƯỚC các bài 読解, 2 câu type "grammar":
- 1 câu: câu tiếng Nhật có （　） trống, chọn mẫu ngữ pháp ĐÚNG phù hợp (4 lựa chọn là các mẫu ngữ pháp, dựa trên danh sách NGỮ PHÁP HÔM NAY bên dưới).
- 1 câu: câu sắp xếp — câu tiếng Nhật có 4 phần đánh dấu và vị trí ⭐, hỏi phần nào nằm tại ⭐ (dạng 文法問題の並べ替え trong đề thật).
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
  if (wantReading) spec.push('- câu type "kanji-reading" (問題1): câu tiếng Nhật có từ đang xét viết trong 〔 〕, chọn cách đọc kana đúng. Lựa chọn sai là cách đọc kana hợp lệ của từ khác cùng loại, KHÔNG phải biến thể vô nghĩa.');
  if (wantWrite) spec.push('- câu type "kanji-write" (問題2): câu tiếng Nhật có từ dạng kana đặt trong 〔 〕, học viên chọn cách VIẾT kanji đúng. prompt = câu có 〔kana〕 (KHÔNG dùng dấu gạch dưới ____ thay thế).');
  if (wantContext) spec.push('- câu type "context" (問題3): câu có （　） trống, chọn từ (trong trọng tâm hôm nay) hợp ngữ cảnh nhất. note = nghĩa tiếng Việt của đáp án.');
  if (wantParaphrase) spec.push('- câu type "paraphrase" (問題4): cho câu dùng từ trọng tâm, chọn câu diễn đạt lại GẦN NGHĨA nhất. Các lựa chọn là câu hoàn chỉnh. note = giải thích ngắn.');
  const activeSpec = spec.length
    ? spec
    : ['- câu type "kanji-reading" (問題1) và "kanji-write" (問題2) như mô tả dưới.'];
  const nSpec = spec.length;
  const perType = nSpec === 4 ? "2 câu kanji-reading + 2 câu kanji-write + 1 câu context + 1 câu paraphrase" : `${Math.max(2, Math.min(4, Math.floor(6 / nSpec)))} câu mỗi loại`;

  return `Bạn là giáo viên tiếng Nhật soạn ĐỀ LUYỆN THI JLPT N3 (chuẩn format đề thi thật của Japan Foundation) cho học viên Việt Nam.

=== TỪ VỰNG BÀI HỌC HÔM NAY (trọng tâm của đề) ===
${todayList}

=== TỪ VỰNG ĐÃ HỌC CÁC NGÀY TRƯỚC (được phép dùng trong bài đọc) ===
${prevList}

Soạn đề gồm các PHẦN theo đúng format JLPT N3:

PHẦN 1 — 文字・語彙 (từ vựng), gồm: ${nSpec === 4 ? perType : perType}:
${activeSpec.map((s) => s).join("\n")}${grammarSection}

PHẦN 2 — 読解 (đọc hiểu), 2 bài:
- Bài 1 (短文): đoạn văn 100–150 ký tự tiếng Nhật, 1 câu hỏi.
- Bài 2 (中文): đoạn văn 250–350 ký tự tiếng Nhật, 2 câu hỏi (ví dụ: câu hỏi nội dung và câu hỏi 「この文章の筆者は何と言いたいのか」 kiểu chọn ý chính).
QUY TẮC BÀI ĐỌC — RẤT QUAN TRỌNG:
- CHỈ dùng từ vựng thuộc 2 danh sách trên (bài hôm nay ưu tiên dùng nhiều). Ngoại lệ duy nhất: trợ từ, chỉ từ cơ bản (これ・その・あの・この・こんな…), và ngữ pháp N4/N3 (だ・である・のに・ても・ように…).
- Độ khó N3 thật: văn phong です/ます hoặc plain form tự nhiên, nội dung đời thường (công việc, cuộc sống, thư yêu cầu, thông báo...).
- KHÔNG dùng kanji ngoài danh sách. Nếu cần từ chưa học, hãy diễn đạt lại bằng từ trong danh sách.
- Câu hỏi bài đọc: chọn đáp án 1/2/3/4, các lựa chọn diễn giải khác nhau rõ rệt.
- CÂU TIẾNG NHẬP PHẢI ĐÚNG NGỮ PHÁP CHUẨN, KHÔNG lỗi chính tả, KHÔNG trùng lặp nghĩa (VD SAI: 「２０歳で〔にじゅうさい〕に成人した」 vì 20 tuổi bị nhắc 2 lần; SAI: 「飲みに行きいきます」 — phải là 「飲みに行きます」).
- VỊ TRÍ ĐÁP ÁN NGẪU NHIÊN: mỗi câu đặt đáp án đúng ở vị trí khác nhau (1,2,3,4 trộn lẫn), TUYỆT ĐỐI không dồn đáp án về vị trí đầu.
- MỌI TRƯỜNG EXPLAIN PHẢI VIẾT BẰNG TIẾNG VIỆT HOÀN TOÀN (người học là người Việt).
- MỖI CÂU HỎI (cả 文字・語彙 lẫn 読解) phải có trường "explain" — GIẢI THÍCH 2–4 câu:
  + type "kanji-reading": giải thích cách đọc của từ đúng (và cách đọc chữ kanji khác nếu có), chỉ rõ từng lựa chọn sai là cách đọc của từ gì.
  + type "kanji-write": giải thích kanji của đáp án (ý nghĩa từng phần nếu hay), và các lựa chọn sai là kanji của từ gì.
  + type "context": giải thích nghĩa của đáp án và vì sao hợp ngữ cảnh; mỗi lựa chọn sai nghĩa là gì, vì sao không hợp.
  + type "paraphrase": diễn giải nghĩa câu gốc, cho biết đáp án diễn đạt lại ý nào; các phương án sai sai ở ý gì.
  + Bài đọc: trích câu liên quan trong đoạn văn làm bằng chứng, giải thích vì sao đáp án đúng; nêu ngắn gọn lý do các phương án khác sai (bẫy thường gặp: đổi chủ thể, đảo ý, quá mức hoá).

Trả về DUY NHẤT một JSON:
{"vocab":[{"type":"kanji-reading|kanji-write|context|paraphrase","prompt":"...","options":["1","2","3","4"],"answer":"đáp án","note":"nghĩa VN (tuỳ chọn)","explain":"giải thích tiếng Việt"}],
 "reading":[{"title":"tiêu đề ngắn (tuỳ chọn)","passage":"đoạn văn tiếng Nhật","questions":[{"prompt":"câu hỏi","options":["..."],"answer":"...","explain":"giải thích tiếng Việt, trích dẫn bằng chứng trong bài"}]}]}

NHẮC LẦN CUỐI: toàn bộ giá trị trường "explain" PHẢI là TIẾNG VIỆT thuần (chỉ kanji/kana được xuất hiện khi trích từ trong câu ví dụ). Không viết explain bằng tiếng Nhật.
MỐI QUAN HỆ BẮT BUỘC VỀ SỐ LƯỢNG: mảng "vocab" chỉ chứa các type đã mô tả ở PHẦN 1${grammar.length ? " và 文法" : ""} với đúng số câu đã ghi — không thêm bớt loại nào. Mảng "reading" phải có đúng 2 bài (1 câu hỏi + 2 câu hỏi).`;
}

export async function generateJlptQuiz(
  today: Word[],
  prev: Word[],
  grammar: { pattern: string; vi?: string; explanation?: string }[] = [],
  shuffleOrder = false,
  types?: Partial<Record<string, boolean>>
): Promise<JlptResult> {
  const system =
    "Bạn là giáo viên tiếng Nhật NGƯỜI VIỆT, chuyên soạn đề luyện thi JLPT N3 cho học viên người Việt. Mọi lời giải thích (explain) PHẢI viết bằng tiếng Việt thuần. Chỉ trả về một JSON hợp lệ.";
  try {
    const parsed = (await callAiJson(
      buildJlptPrompt(today, prev, grammar, types),
      system
    )) as {
      vocab?: unknown[];
      reading?: unknown[];
    };
    let vocab = sanitizeVocab(parsed?.vocab || []);
    let reading = sanitizeReading(parsed?.reading || []);
    if (vocab.length < 4 || reading.length < 1) {
      return { ok: false, error: "Đề JLPT sinh ra không đạt chuẩn" };
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
