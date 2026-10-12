export type Related = { type: string; text: string };
export type Example = { ja: string; vi?: string };

export type Word = {
  no: number | null;
  kanji: string;
  kana?: string;
  en?: string;
  kr?: string;
  vi?: string;
  senses?: string[];
  examples?: Example[];
  related?: Related[];
  notes?: string;
  unit?: string;
};

export type Unit = {
  id: string;
  label: string;
  title: string;
  range: [number, number];
};

export type ColumnRow = {
  word: string;
  kana?: string;
  vi?: string;
  en?: string;
  note?: string;
};

export type ColumnGroup = {
  group?: string;
  rows: ColumnRow[];
};

export type BookColumn = {
  no?: number;
  title: string;
  book_page?: number;
  kind?: string;
  groups?: ColumnGroup[];
  items?: string[][]; // format cũ (fallback)
};

export type ExerciseQuestion = {
  no?: number;
  text?: string;
  options?: string[];
  answer?: string | null;
};

export type Exercise = {
  type?: string;
  range?: string;
  book_page?: number;
  instruction?: string;
  questions: ExerciseQuestion[];
};

export type GrammarPoint = {
  no?: number | null;      // số điểm trong sách (110 mẫu); null = mục phụ lục (vd: 敬語)
  pattern: string;   // cấu trúc, vd: 「〜たことがない」
  stars?: number;    // độ khó ★ (0-3)
  senses?: string[];       // các nghĩa ①②③ (tiếng Việt)
  connection?: string;     // quy tắc nối (接続) — tiếng Việt
  vi?: string;       // nghĩa chính tiếng Việt
  en?: string;
  explanation?: string; // cách dùng tiếng Việt
  examples?: Example[];
  notes?: string;
};

export type BookData = {
  source?: string;
  units: Unit[];
  words: Word[];
  columns: BookColumn[];
  exercises: Exercise[];
  grammar?: GrammarPoint[]; // từ sách 文法 (khi có)
};

export type Progress = {
  learned: Record<string, true>;
  quizBest: number | null;
  days: Record<
    string,
    { done?: boolean; quizPct?: number; jlptPct?: number; updatedAt?: number }
  >;
};
