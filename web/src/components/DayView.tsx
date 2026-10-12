"use client";

import { useState } from "react";
import type { Day } from "@/lib/plan";
import type { GrammarPoint, Progress, Word } from "@/lib/types";
import { speak } from "@/lib/speech";
import WordCard from "./WordCard";
import Flashcards from "./Flashcards";
import QuizView from "./QuizView";
import JlptQuizView from "./JlptQuizView";
import FuriganaText from "./FuriganaText";
import GamePicker from "./games/GamePicker";

type Phase = "review" | "words" | "grammar" | "exam";

const PHASES: { id: Phase; label: string }[] = [
  { id: "review", label: "Ôn tập cũ" },
  { id: "words", label: "Từ vựng mới" },
  { id: "grammar", label: "Ngữ pháp" },
  { id: "exam", label: "Luyện tập (Đề JLPT)" },
];

export default function DayView({
  day,
  reviewPool,
  allWords,
  grammar,
  progress,
  onToggle,
  furigana,
  onBack,
  onQuizDone,
  onJlptDone,
  onMarkDone,
}: {
  day: Day;
  reviewPool: Word[];
  allWords: Word[];
  grammar: GrammarPoint[];
  progress: Progress;
  onToggle: (no: number | null) => void;
  furigana: boolean;
  onBack: () => void;
  onQuizDone: (day: number, pct: number, review: boolean) => void;
  onJlptDone: (day: number, pct: number) => void;
  onMarkDone: (day: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("review");
  const [visited, setVisited] = useState<Phase[]>(["review"]);
  const [wordsMode, setWordsMode] = useState<"list" | "flash" | "quiz" | "games">("list");
  const st = progress.days?.[String(day.day)];

  function goto(p: Phase) {
    setPhase(p);
    setVisited((v) => (v.includes(p) ? v : [...v, p]));
  }

  return (
    <>
      <div className="dayview-head">
        <button className="btn btn-ghost" onClick={onBack}>
          ‹ Lộ trình
        </button>
        <div>
          <div className="view-title">Ngày {day.day}</div>
          <div className="view-sub">
            Từ #{day.from} – #{day.to} · {day.words.length} từ
            {st?.done ? " · ĐÃ HOÀN THÀNH" : ""}
            {st?.quizPct != null ? ` · bài tập: ${st.quizPct}%` : ""}
            {st?.jlptPct != null ? ` · đề JLPT: ${st.jlptPct}%` : ""}
          </div>
        </div>
        {!st?.done && (
          <button className="btn btn-green" onClick={() => onMarkDone(day.day)}>
            Đánh dấu hoàn thành ngày
          </button>
        )}
      </div>

      <div className="stepper">
        {PHASES.map((p, idx) => (
          <button
            key={p.id}
            className={`step ${phase === p.id ? "active" : ""} ${
              visited.includes(p.id) && phase !== p.id ? "visited" : ""
            }`}
            onClick={() => goto(p.id)}
          >
            <span className="step-num">{idx + 1}</span> {p.label}
          </button>
        ))}
      </div>

      {/* ---- GIAI ĐOẠN 1: ôn tập các ngày cũ ---- */}
      {phase === "review" && (
        <>
          <div className="phase-hint">
            Bước khởi động: làm nhanh vài câu từ vựng các ngày trước để nhớ lại.
          </div>
          {reviewPool.length < 4 ? (
            <div className="empty">
              Đây là ngày đầu tiên — chưa có gì để ôn. Chuyển sang{" "}
              <button className="linkbtn" onClick={() => goto("words")}>
                Từ vựng mới
              </button>
              .
            </div>
          ) : (
            <QuizView
              pool={reviewPool}
              all={allWords}
              best={st?.quizPct ?? null}
              furigana={furigana}
              introText="10 câu ngẫu nhiên từ các ngày trước"
            />
          )}
        </>
      )}

      {/* ---- GIAI ĐOẠN 2: học từ vựng mới ---- */}
      {phase === "words" && (
        <>
          <div className="words-toggle">
            <button
              className={wordsMode === "list" ? "active" : ""}
              onClick={() => setWordsMode("list")}
            >
              Danh sách
            </button>
            <button
              className={wordsMode === "flash" ? "active" : ""}
              onClick={() => setWordsMode("flash")}
            >
              Thẻ ghi nhớ
            </button>
            <button
              className={wordsMode === "quiz" ? "active" : ""}
              onClick={() => setWordsMode("quiz")}
            >
              Bài tập
            </button>
            <button
              className={wordsMode === "games" ? "active" : ""}
              onClick={() => setWordsMode("games")}
            >
              Trò chơi
            </button>
          </div>
          {wordsMode === "list" ? (
            <div className="day-words">
              {day.words.map((w) => (
                <WordCard
                  key={`${w.no}-${w.kanji}`}
                  word={w}
                  learned={w.no != null && Boolean(progress.learned?.[String(w.no)])}
                  onToggle={onToggle}
                  furigana={furigana}
                />
              ))}
            </div>
          ) : wordsMode === "flash" ? (
            <Flashcards
              words={day.words}
              progress={progress}
              onToggle={onToggle}
              furigana={furigana}
            />
          ) : wordsMode === "quiz" ? (
            <QuizView
              pool={day.words}
              all={allWords}
              best={st?.quizPct ?? null}
              furigana={furigana}
              introText="Bài tập 19 câu từ vựng của ngày này — 6 dạng có thể bật/tắt trong Cài đặt đề."
              onFinish={(pct) => onQuizDone(day.day, pct, false)}
            />
          ) : (
            <GamePicker words={day.words} all={allWords} furigana={furigana} />
          )}
        </>
      )}

      {/* ---- GIAI ĐOẠN 3: ngữ pháp bài mới ---- */}
      {phase === "grammar" && (
        <GrammarPhase grammar={grammar} furigana={furigana} />
      )}

      {/* ---- GIAI ĐOẠN 4: luyện tập — đề JLPT ---- */}
      {phase === "exam" && (
        <>
          <div className="phase-hint">
            Đề tổng hợp: 文字・語彙 (từ vựng hôm nay){grammar.length ? " + 文法 (ngữ pháp)" : ""} + 読解
            (bài đọc dùng từ hôm nay và các ngày trước).
          </div>
          <JlptQuizView
            todayWords={day.words}
            prevWords={reviewPool}
            grammarPoints={grammar}
            furigana={furigana}
            best={st?.jlptPct ?? null}
            onFinish={(pct) => onJlptDone(day.day, pct)}
          />
        </>
      )}
    </>
  );
}

function GrammarPhase({
  grammar,
  furigana,
}: {
  grammar: GrammarPoint[];
  furigana: boolean;
}) {
  if (!grammar.length) {
    return (
      <div className="quiz-box quiz-result">
        <div className="view-title">Ngữ pháp bài mới</div>
        <p style={{ color: "var(--muted)", margin: "10px 0" }}>
          Phần này cần dữ liệu từ sách 「耳から覚える文法トレーニング N3」.
        </p>
        <p style={{ color: "var(--muted)" }}>
          File bạn gửi ("[VTI Mirai Share] 151 - Sách Mimi Kara Oboeru
          Goi.pdf") là bản scan của sách <b>TỪ VỰNG</b> (語彙) — trùng với sách
          đã dùng. Hãy gửi đúng file sách <b>NGỮ PHÁP</b> (Bunpou/文法) để kích
          hoạt giai đoạn này — phần còn lại của app không phụ thuộc vào nó.
        </p>
      </div>
    );
  }
  return (
    <div className="day-words">
      {grammar.map((g, i) => (
        <article className="word-card" key={i}>
          <div className="word-head">
            <span className="word-no">{g.no ? `#${g.no}` : "文法"}</span>
            <span className="word-kanji">{g.pattern}</span>
            {g.stars ? (
              <span className="chip" title="Độ khó">
                {"★".repeat(g.stars)}
              </span>
            ) : null}
          </div>
          <div className="word-vi">{g.vi}</div>
          {(g.senses || []).length > 0 && (
            <div className="word-meta">
              {(g.senses || []).map((s, k) => (
                <span key={k} className="chip">
                  {s}
                </span>
              ))}
            </div>
          )}
          {g.connection && (
            <div className="grammar-connection">
              <b>接続:</b> {g.connection}
            </div>
          )}
          {g.explanation && (
            <div className="explain-box" style={{ marginTop: 8 }}>
              <div className="explain-title">Cách dùng</div>
              <div className="explain-body">{g.explanation}</div>
            </div>
          )}
          {(g.examples || []).length > 0 && (
            <div className="examples">
              {g.examples!.map((e, k) => (
                <div className="example" key={k}>
                  <div className="ja">
                    <FuriganaText text={e.ja} enabled={furigana} />
                    <button
                      className="btn-speak small"
                      onClick={() => speak(e.ja)}
                    >
                      Nghe
                    </button>
                  </div>
                  {e.vi && <div className="vi">{e.vi}</div>}
                </div>
              ))}
            </div>
          )}
          {g.notes && <div className="col-note" style={{ marginTop: 6 }}>{g.notes}</div>}
        </article>
      ))}
    </div>
  );
}
