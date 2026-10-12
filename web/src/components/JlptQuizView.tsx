"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { generateJlptQuiz, type JlptQuiz, type JlptVocabQ } from "@/lib/jlptQuiz";
import { loadQuizSettings, type QuizSettings } from "@/lib/quiz";
import { loadExamParts, saveExamParts, type ExamParts } from "@/lib/jlptQuiz";
import { speak } from "@/lib/speech";
import FuriganaText from "./FuriganaText";
import QuizSettingsPanel from "./QuizSettingsPanel";

const VOCAB_TYPE_LABEL: Record<JlptVocabQ["type"], string> = {
  "kanji-reading": "問題1 · Đọc kanji — chọn cách đọc đúng",
  "kanji-write": "問題2 · Cách viết — chọn kanji đúng",
  context: "問題3 · Ngữ cảnh — chọn từ phù hợp",
  paraphrase: "問題4 · Diễn đạt lại — chọn câu gần nghĩa",
  synonym: "問題5 · Từ gần nghĩa",
  grammar: "文法 · Ngữ pháp — chọn mẫu đúng",
};

/** Câu hỏi 文字・語彙: từ trong 〔 〕 là từ được hỏi — KHÔNG gắn furigana (tránh lộ đáp án),
 *  các phần còn lại của câu vẫn có furigana trợ giúp. */
function VocabPrompt({ text, furigana }: { text: string; furigana: boolean }) {
  const parts = text.split(/(〔[^〕]*〕)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("〔") ? (
          <span key={i} className="target-word">
            {p}
          </span>
        ) : (
          <FuriganaText key={i} text={p} enabled={furigana} />
        )
      )}
    </>
  );
}

export default function JlptQuizView({
  todayWords,
  prevWords,
  grammarPoints,
  furigana,
  best,
  onFinish,
}: {
  todayWords: Word[];
  prevWords: Word[];
  grammarPoints?: { pattern: string; vi?: string; explanation?: string }[];
  furigana: boolean;
  best: number | null;
  onFinish?: (pct: number) => void;
}) {
  const [quiz, setQuiz] = useState<JlptQuiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [qset, setQset] = useState<QuizSettings>(() => loadQuizSettings());
  const [parts, setParts] = useState<ExamParts>(() => loadExamParts());
  const [part, setPart] = useState<"vocab" | "reading">(
    loadExamParts().vocab ? "vocab" : "reading"
  );
  const [vi, setVi] = useState(0); // vocab index
  const [ri, setRi] = useState(0); // reading index
  const [rq, setRq] = useState(0); // reading question index
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);

  function updateParts(next: ExamParts) {
    // không cho tắt hết 3 phần
    if (!next.vocab && !next.grammar && !next.reading) return;
    setParts(next);
    saveExamParts(next);
  }

  async function start() {
    setWarn(null);
    setLoading(true);
    const result = await generateJlptQuiz(todayWords, prevWords, grammarPoints || [], qset.shuffle, qset.types, parts);
    setLoading(false);
    if (!result.ok) {
      setWarn(`${result.error} — hãy kiểm tra AI trong tab Bài tập, hoặc làm Bài tập ngày thường.`);
      return;
    }
    setQuiz(result.quiz);
    setPart(parts.vocab ? "vocab" : "reading");
    setVi(0);
    setRi(0);
    setRq(0);
    setChosen(null);
    setScore(0);
    setTotal(result.quiz.vocab.length + result.quiz.reading.reduce((s, r) => s + r.questions.length, 0));
    setDone(false);
  }

  function answerMC(correct: boolean, next: () => void) {
    if (chosen !== null) return;
    if (correct) setScore((s) => s + 1);
    next();
  }

  if (!quiz) {
    return (
      <div className="quiz-box quiz-result">
        <div className="view-title">Đề luyện JLPT N3</div>
        <div className="jlpt-header">
          日本語能力試験 <span>N3</span> 模擬問題
        </div>
        <p style={{ color: "var(--muted)", margin: "10px 0 4px", textAlign: "left" }}>
          <b>文字・語彙</b> — 6 câu đúng format: 問題1 đọc kanji, 問題2 cách viết,
          問題3 ngữ cảnh, 問題4 diễn đạt lại.
        </p>
        <p style={{ color: "var(--muted)", marginBottom: 12, textAlign: "left" }}>
          <b>読解</b> — 2 bài đọc (短文 + 中文) viết bằng AI, <u>chỉ dùng từ vựng
          của ngày hôm nay và các ngày trước</u>, kèm furigana.
        </p>
        <p style={{ color: "var(--muted)", marginBottom: 14 }}>
          Điểm lần gần nhất: {best == null ? "—" : `${best}%`} · cần AI (Groq/Gemini...)
        </p>

        <div className="exam-parts">
          <b style={{ fontSize: 13.5 }}>Thành phần đề:</b>
          {([
            ["vocab", "文字・語彙 (Từ vựng)"],
            ["grammar", "文法 (Ngữ pháp)"],
            ["reading", "読解 (Bài đọc)"],
          ] as [keyof ExamParts, string][]).map(([k, label]) => (
            <label key={k} className="qset-item">
              <input
                type="checkbox"
                checked={parts[k]}
                onChange={(e) => updateParts({ ...parts, [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>

        {warn && <div className="callout-warn" style={{ width: "100%" }}>{warn}</div>}
        <QuizSettingsPanel settings={qset} onChange={setQset} />
        <button className="btn btn-primary" onClick={start} disabled={loading}>
          {loading ? "AI đang so đề (khoảng 20–40 giây)..." : "Làm đề JLPT"}
        </button>
      </div>
    );
  }

  if (done) {
    const pct = total ? Math.round((score / total) * 100) : 0;
    return (
      <div className="quiz-box quiz-result">
        <div className="view-title">Kết quả đề JLPT</div>
        <div className="quiz-score">
          {score}/{total}{" "}
          <small style={{ fontSize: 18, color: "var(--muted)" }}>({pct}%)</small>
        </div>
        {pct >= 70 ? (
          <p style={{ color: "var(--green)", fontWeight: 600 }}>Đạt chuẩn N3 ngày học này!</p>
        ) : (
          <p style={{ color: "var(--muted)" }}>Ôn lại phần Học từ rồi thi lại nhé.</p>
        )}
        <button className="btn btn-primary" onClick={start}>
          Làm đề khác
        </button>
      </div>
    );
  }

  /* ---- PHẦN 1: vocab ---- */
  if (part === "vocab") {
    const q = quiz.vocab[vi];
    const answered = chosen !== null;
    return (
      <div className="quiz-box">
        <div className="view-sub">
          文字・語彙 · câu {vi + 1}/{quiz.vocab.length} · đúng {score}/{total}
        </div>
        <div className="quiz-section">{VOCAB_TYPE_LABEL[q.type]}</div>
        <div className="jlpt-prompt">
          <VocabPrompt text={q.prompt} furigana={furigana} />
        </div>
        {q.note && answered && <div className="quiz-hint">{q.note}</div>}
        {answered && (q.explain || q.note) && (
          <div className="explain-box">
            <div className="explain-title">Giải thích</div>
            <div className="explain-body">{q.explain || `Đáp án: ${q.answer} — ${q.note}`}</div>
          </div>
        )}
        <div className="quiz-opts">
          {q.options.map((o, idx) => (
            <button
              key={o}
              className={`quiz-opt ${
                answered && o === q.answer ? "correct" : answered && o === chosen ? "wrong" : ""
              }`}
              disabled={answered}
              onClick={() => {
                if (answered) return;
                setChosen(o);
                if (o === q.answer) setScore((s) => s + 1);
              }}
            >
              <span className="opt-num">{idx + 1}</span> {o}
            </button>
          ))}
        </div>
        <div
          className={`quiz-feedback ${answered ? (chosen === q.answer ? "ok" : "ng") : ""}`}
        >
          {answered &&
            (chosen === q.answer
              ? "Chính xác!"
              : `Chưa đúng — đáp án: ${q.answer}`)}
        </div>
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button
            className="btn btn-primary"
            disabled={!answered}
            onClick={() => {
              setChosen(null);
              if (vi + 1 >= quiz.vocab.length) {
                if (parts.reading && quiz.reading.length) {
                  setPart("reading");
                } else {
                  const pct = total ? Math.round((score / total) * 100) : 0;
                  onFinish?.(pct);
                  setDone(true);
                }
              } else {
                setVi(vi + 1);
              }
            }}
          >
            {vi + 1 >= quiz.vocab.length
              ? parts.reading && quiz.reading.length
                ? "Sang phần 読解 ›"
                : "Xem kết quả"
              : "Câu sau ›"}
          </button>
        </div>
      </div>
    );
  }

  /* ---- PHẦN 2: reading ---- */
  const reading = quiz.reading[ri];
  const q = reading.questions[rq];
  const answered = chosen !== null;
  return (
    <div className="quiz-box">
      <div className="view-sub">
        読解 · bài {ri + 1}/{quiz.reading.length} · câu hỏi {rq + 1}/{reading.questions.length} · đúng {score}/{total}
      </div>
      <div className="quiz-section">読解 · Đọc hiểu</div>
      <div className="reading-passage">
        {reading.title && <div className="reading-title">{reading.title}</div>}
        <FuriganaText text={reading.passage} enabled={furigana} />
        <button
          className="btn-speak small"
          title="Đọc bài khóa"
          onClick={() => speak(reading.passage)}
          style={{ marginTop: 8 }}
        >
          Nghe bài đọc
        </button>
      </div>
      <div className="quiz-q" style={{ marginTop: 14 }}>{q.prompt}</div>
      <div className="quiz-opts">
        {q.options.map((o) => (
          <button
            key={o}
            className={`quiz-opt ${
              answered && o === q.answer ? "correct" : answered && o === chosen ? "wrong" : ""
            }`}
            disabled={answered}
            onClick={() => {
              if (answered) return;
              setChosen(o);
              if (o === q.answer) setScore((s) => s + 1);
            }}
          >
            {o}
          </button>
        ))}
      </div>
      <div className={`quiz-feedback ${answered ? (chosen === q.answer ? "ok" : "ng") : ""}`}>
        {answered && (chosen === q.answer ? "Chính xác!" : `Chưa đúng — đáp án: ${q.answer}`)}
      </div>
      {answered && q.explain && (
        <div className="explain-box">
          <div className="explain-title">Giải thích</div>
          <div className="explain-body">{q.explain}</div>
        </div>
      )}
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button
          className="btn btn-primary"
          disabled={!answered}
          onClick={() => {
            setChosen(null);
            const lastQ = rq + 1 >= reading.questions.length;
            const lastR = ri + 1 >= quiz.reading.length;
            if (lastQ && lastR) {
              const pct = total ? Math.round((score / total) * 100) : 0;
              onFinish?.(pct);
              setDone(true);
            } else if (lastQ) {
              setRi(ri + 1);
              setRq(0);
            } else {
              setRq(rq + 1);
            }
          }}
        >
          {rq + 1 >= reading.questions.length && ri + 1 >= quiz.reading.length
            ? "Xem kết quả"
            : "Câu sau ›"}
        </button>
      </div>
    </div>
  );
}
