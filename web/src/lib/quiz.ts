// Bộ sinh bài tập đa dạng cho từng ngày học.
import type { Word } from "./types";

/* ---- Cài đặt đề: chọn dạng câu + xáo trộn ---- */
export type QuizTypeId = "meaning" | "reverse" | "reading" | "write" | "listening" | "blank" | "match";

export const QUIZ_TYPE_LABELS: Record<QuizTypeId, string> = {
  meaning: "Nghĩa của từ (kanji → nghĩa)",
  reverse: "Chọn từ theo nghĩa (nghĩa → kanji)",
  reading: "Cách đọc (kanji → kana)",
  write: "Viết kanji (kana → kanji)",
  listening: "Nghe và chọn (âm → từ)",
  blank: "Điền vào câu ví dụ",
  match: "Nối cặp từ – nghĩa",
};

export type QuizSettings = {
  types: Record<QuizTypeId, boolean>;
  shuffle: boolean; // xáo trộn thứ tự câu
};

const LS_QUIZSET = "mimiN3_quizset_v1";

export function loadQuizSettings(): QuizSettings {
  const all: Record<QuizTypeId, boolean> = {
    meaning: true, reverse: true, reading: true, write: true,
    listening: true, blank: true, match: true,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(LS_QUIZSET) || "");
    return { types: { ...all, ...(raw?.types || {}) }, shuffle: raw?.shuffle !== false };
  } catch {
    return { types: all, shuffle: true };
  }
}

export function saveQuizSettings(s: QuizSettings) {
  localStorage.setItem(LS_QUIZSET, JSON.stringify(s));
}

export type McItem = {
  kind: "mc";
  section: string;
  prompt: string;
  word: Word;
  options: string[];
  answer: string;
  audio?: string;      // tự động đọc khi hiện câu (listening)
  hint?: string;       // gợi ý hiện dưới đề (vd: nghĩa tiếng Việt)
  explain?: string;    // giải thích sau khi trả lời
};
export type MatchItem = {
  kind: "match";
  section: string;
  prompt: string;
  pairs: { word: string; meaning: string }[];
};
export type ExerciseItem = McItem | MatchItem;

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

function distractors(
  word: Word,
  pool: Word[],
  all: Word[],
  field: (w: Word) => string | undefined,
  n: number
): string[] {
  const near = pool.filter((x) => x.no !== word.no);
  const source = near.length >= n * 2 ? near : all;
  const out: string[] = [];
  for (const d of sample(source, n * 3)) {
    const v = field(d);
    if (v && v !== field(word) && !out.includes(v)) out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

function headwords(w: Word): string[] {
  const k = w.kanji || "";
  const list = [k];
  if (k.endsWith("する")) list.push(k.slice(0, -2));
  if (k.endsWith("られる")) list.push(k.slice(0, -3));
  if (k.endsWith("める")) list.push(k.slice(0, -2));
  return list.filter(Boolean);
}

/** Câu hỏi "điền vào chỗ trống" từ ví dụ — bỏ qua từ không tìm được chỗ trống. */
function blankItem(word: Word, all: Word[]): McItem | null {
  for (const e of word.examples || []) {
    for (const cand of headwords(word)) {
      const idx = e.ja.indexOf(cand);
      if (cand.length >= 2 && idx >= 0) {
        const blanked = e.ja.replace(cand, "◯");
        const head = word.kanji || word.kana || "";
        const opts = shuffle([
          head,
          ...distractors(word, [], all, (x) => x.kanji || x.kana, 3),
        ]);
        return {
          kind: "mc",
          section: "Điền vào câu ví dụ",
          prompt: blanked,
          word,
          options: opts,
          answer: head,
          hint: e.vi ? `Nghĩa câu: ${e.vi}` : undefined,
          explain: `Câu gốc: ${e.ja} — “${head}” (${word.kana || ""}) nghĩa là ${word.vi || word.en || ""}.`,
        };
      }
    }
  }
  return null;
}

/** Sinh bài tập ngày: nhiều phần tuỳ cài đặt, mỗi phần một dạng. */
export function makeDayExercises(pool: Word[], all: Word[], settings?: QuizSettings): ExerciseItem[] {
  const cfg = settings || loadQuizSettings();
  const usable = pool.filter((w) => w.vi && w.kanji);
  const withKana = usable.filter(
    (w) => w.kana && w.kana !== w.kanji && w.kana.length <= 10
  );
  const items: ExerciseItem[] = [];

  // 1. Nghĩa của từ (kanji → nghĩa)
  if (cfg.types.meaning) {
    for (const w of sample(usable, 4)) {
      items.push({
        kind: "mc",
        section: "Nghĩa của từ",
        prompt: "Nghĩa của từ này là gì?",
        word: w,
        options: shuffle([w.vi!, ...distractors(w, pool, all, (x) => x.vi!, 3)]),
        answer: w.vi!,
        explain: `${w.kanji} (${w.kana || ""}) nghĩa là “${w.vi}”${
          w.en ? ` — ${w.en}` : ""
        }${(w.examples || []).length ? `. Ví dụ: ${w.examples![0].ja}` : ""}`,
      });
    }
  }

  // 2. Chọn từ theo nghĩa (nghĩa → kanji)
  if (cfg.types.reverse) {
    for (const w of sample(usable, 4)) {
      items.push({
        kind: "mc",
        section: "Chọn từ theo nghĩa",
        prompt: `Từ nào mang nghĩa: “${w.vi}”?`,
        word: w,
        options: shuffle([w.kanji, ...distractors(w, pool, all, (x) => x.kanji, 3)]),
        answer: w.kanji,
        explain: `Từ có nghĩa “${w.vi}” là ${w.kanji} (đọc: ${w.kana || "—"}), từ số ${w.no ?? "?"} của sách.`,
      });
    }
  }

  // 3. Cách đọc đúng (kanji → kana)
  if (cfg.types.reading) {
    for (const w of sample(withKana, 4)) {
      items.push({
        kind: "mc",
        section: "Cách đọc đúng",
        prompt: "Cách đọc đúng của từ này là gì?",
        word: w,
        options: shuffle([w.kana!, ...distractors(w, pool, all, (x) => x.kana || "", 3)]),
        answer: w.kana!,
        explain: `${w.kanji} đọc là ${w.kana} — nghĩa “${w.vi || w.en || ""}”.`,
      });
    }
  }

  // 4. Viết kanji (kana → kanji)
  if (cfg.types.write) {
    for (const w of sample(withKana, 4)) {
      items.push({
        kind: "mc",
        section: "Viết kanji",
        prompt: `Từ “${w.kana}” được viết bằng kanji nào?`,
        word: w,
        options: shuffle([w.kanji, ...distractors(w, pool, all, (x) => x.kanji, 3)]),
        answer: w.kanji,
        explain: `“${w.kana}” viết là ${w.kanji} — nghĩa “${w.vi || w.en || ""}”.`,
      });
    }
  }

  // 5. Nghe và chọn (tự động đọc từ, chọn từ nghe được)
  if (cfg.types.listening) {
    for (const w of sample(usable, 3)) {
      items.push({
        kind: "mc",
        section: "Nghe và chọn",
        prompt: "Nghe và chọn từ bạn vừa nghe.",
        word: w,
        options: shuffle([w.kanji, ...distractors(w, pool, all, (x) => x.kanji, 3)]),
        answer: w.kanji,
        audio: w.kana && w.kana !== w.kanji ? `${w.kana}` : w.kanji,
        explain: `Từ vừa nghe: ${w.kanji} (${w.kana || ""}) — nghĩa “${w.vi || w.en || ""}”.`,
      });
    }
  }

  // 6. Điền vào câu ví dụ
  if (cfg.types.blank) {
    const blanks = sample(usable, 8)
      .map((w) => blankItem(w, all))
      .filter((x): x is McItem => x !== null)
      .slice(0, 3);
    items.push(...blanks);
  }

  // 7. Nối từ với nghĩa
  if (cfg.types.match) {
    const pairs = sample(usable, 5).map((w) => ({
      word: w.kanji,
      meaning: w.vi!,
    }));
    if (pairs.length >= 4) {
      items.push({
        kind: "match",
        section: "Nối từ với nghĩa",
        prompt: "Bấm một từ rồi bấm nghĩa tương ứng.",
        pairs,
      });
    }
  }

  // Xáo trộn thứ tự câu nếu bật cài đặt
  return cfg.shuffle ? shuffle(items) : items;
}
