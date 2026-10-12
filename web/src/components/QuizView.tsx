"use client";

import { useEffect, useMemo, useState } from "react";
import type { Word } from "@/lib/types";
import { makeDayExercises, shuffle, loadQuizSettings, type QuizSettings, type ExerciseItem, type McItem } from "@/lib/quiz";
import QuizSettingsPanel from "./QuizSettingsPanel";
import {
  AI_PRESETS,
  generateAiExercises,
  getAiConfig,
  saveAiConfig,
  setCustomBase,
  getCustomBase,
  testConnection,
  type ProviderId,
} from "@/lib/aiQuiz";
import { speak } from "@/lib/speech";
import FuriganaText from "./FuriganaText";

export default function QuizView({
  pool,
  all,
  best,
  furigana,
  onFinish,
  introText,
}: {
  pool: Word[];
  all: Word[];
  best: number | null;
  furigana: boolean;
  onFinish?: (pct: number) => void;
  introText?: string;
}) {
  const [items, setItems] = useState<ExerciseItem[] | null>(null);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [lastPct, setLastPct] = useState<number | null>(null);

  const [cfg, setCfg] = useState(() => getAiConfig());
  const [qset, setQset] = useState<QuizSettings>(() => loadQuizSettings());
  const [showSet, setShowSet] = useState(false);
  const hasKey = Boolean(cfg.keys[cfg.provider]);
  const [source, setSource] = useState<"ai" | "basic">(hasKey ? "ai" : "basic");
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyPanel, setKeyPanel] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);

  function updateCfg(next: Partial<typeof cfg>) {
    const merged = { ...cfg, ...next, keys: { ...cfg.keys, ...(next.keys || {}) } };
    setCfg(merged);
    saveAiConfig(merged);
  }

  async function start() {
    setWarn(null);
    try {
      if (source === "ai") {
        if (!getAiConfig().keys[getAiConfig().provider]) {
          setWarn("Chưa nhập API key cho nhà cung cấp đã chọn — tạm dùng đề cơ bản.");
        } else {
          setLoading(true);
          const result = await generateAiExercises(pool, qset);
          setLoading(false);
          if (result.ok) {
            setItems(result.items);
            setI(0);
            setScore(0);
            setDone(false);
            setLastPct(null);
            return;
          }
          if (result.error === "no_key") {
            setWarn("Chưa nhập API key — tạm dùng đề cơ bản.");
          } else {
            setWarn(`${result.error} — tạm dùng đề cơ bản.`);
          }
        }
      }
      const exercises = makeDayExercises(pool, all, qset);
      if (exercises.length < 4) {
        setWarn(`Không đủ câu với các dạng đã chọn — bật thêm dạng câu trong Cài đặt đề.`);
        return;
      }
      setItems(exercises);
      setI(0);
      setScore(0);
      setDone(false);
      setLastPct(null);
    } catch (e) {
      setLoading(false);
      setWarn(`Lỗi khi tạo đề: ${e instanceof Error ? e.message : "không rõ"}`);
      console.error("[quiz] start failed:", e);
    }
  }

  function answer(v: boolean) {
    if (v) setScore((s) => s + 1);
  }

  function next() {
    if (!items) return;
    if (i + 1 >= items.length) {
      const pct = Math.round((score / items.length) * 100);
      setLastPct(pct);
      onFinish?.(pct);
      setDone(true);
    } else {
      setI(i + 1);
    }
  }

  if (!items) {
    return (
      <div className="quiz-box quiz-result">
        <div className="view-title">Bài tập</div>
        <p style={{ color: "var(--muted)", margin: "10px 0 12px" }}>
          {introText
            ? introText
            : "Đề gồm 6 phần: nghĩa của từ, chọn từ theo nghĩa, cách đọc, nghe và chọn, điền vào câu ví dụ, nối cặp."}{" "}
          Đạt 70% để hoàn thành ngày.
        </p>

        <div className="src-pick">
          <label className={`src-opt ${source === "ai" ? "on" : ""}`}>
            <input
              type="radio"
              name="qsrc"
              checked={source === "ai"}
              onChange={() => setSource("ai")}
            />
            <div>
              <b>Đề AI</b>
              <small>soạn riêng từ 20 từ của ngày này — cần API key</small>
            </div>
          </label>
          <label className={`src-opt ${source === "basic" ? "on" : ""}`}>
            <input
              type="radio"
              name="qsrc"
              checked={source === "basic"}
              onChange={() => setSource("basic")}
            />
            <div>
              <b>Đề cơ bản</b>
              <small>sinh nhanh ngay trên máy, không cần mạng</small>
            </div>
          </label>
        </div>

        {source === "ai" && (
          <div className="key-zone">
            <div className="ai-grid">
              <label className="sp-row">
                Dịch vụ:
                <select
                  value={cfg.provider}
                  onChange={(e) => {
                    const p = e.target.value as ProviderId;
                    const models = p === "custom" ? [] : AI_PRESETS[p].models;
                    updateCfg({ provider: p, model: models[0] || cfg.model });
                    setTestMsg(null);
                  }}
                >
                  {(Object.keys(AI_PRESETS) as ProviderId[]).map((p) => (
                    <option key={p} value={p}>
                      {AI_PRESETS[p].label}
                    </option>
                  ))}
                </select>
              </label>

              {cfg.provider === "custom" && (
                <label className="sp-row">
                  Base URL:
                  <input
                    className="textin"
                    placeholder="https://.../v1"
                    defaultValue={getCustomBase()}
                    onBlur={(e) => setCustomBase(e.target.value)}
                  />
                </label>
              )}

              <label className="sp-row">
                Model:
                <input
                  className="textin"
                  list="ai-models"
                  value={cfg.model}
                  onChange={(e) => updateCfg({ model: e.target.value })}
                  placeholder="tên model"
                />
                <datalist id="ai-models">
                  {(cfg.provider === "custom" ? [] : AI_PRESETS[cfg.provider].models).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>

              <label className="sp-row">
                API key:
                <input
                  className="textin"
                  type="password"
                  placeholder="dán API key..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
              </label>

              <div className="key-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    updateCfg({ keys: { ...cfg.keys, [cfg.provider]: keyInput.trim() } });
                    setKeyInput("");
                    setTestMsg(null);
                  }}
                >
                  Lưu key
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={testing}
                  onClick={async () => {
                    setTesting(true);
                    setTestMsg(null);
                    const r = await testConnection();
                    setTestMsg(r);
                    setTesting(false);
                  }}
                >
                  {testing ? "Đang thử..." : "Thử kết nối"}
                </button>
                {testMsg && (
                  <span className={testMsg.ok ? "test-ok" : "test-ng"}>{testMsg.message}</span>
                )}
              </div>

              <p className="sp-note">{AI_PRESETS[cfg.provider]?.hint || "Nhập Base URL và tên model theo nhà cung cấp của bạn."}</p>
            </div>
          </div>
        )}

        {warn && <div className="callout-warn" style={{ width: "100%" }}>{warn}</div>}

        <QuizSettingsPanel settings={qset} onChange={setQset} />

        <p style={{ color: "var(--muted)", margin: "10px 0 14px" }}>
          Điểm lần gần nhất: {best == null ? "—" : `${best}%`}
        </p>
        <button className="btn btn-primary" onClick={start} disabled={loading}>
          {loading ? "AI đang so đề (10–40 giây), giữ nguyên tab..." : "Bắt đầu"}
        </button>
      </div>
    );
  }

  if (done) {
    const pct = lastPct ?? 0;
    return (
      <div className="quiz-box quiz-result">
        <div className="view-title">Hoàn thành!</div>
        <div className="quiz-score">
          {score}/{items.length}{" "}
          <small style={{ fontSize: 18, color: "var(--muted)" }}>({pct}%)</small>
        </div>
        {pct >= 70 ? (
          <p style={{ color: "var(--green)", fontWeight: 600 }}>
            Tuyệt vời — đạt yêu cầu ngày học!
          </p>
        ) : (
          <p style={{ color: "var(--muted)", marginBottom: 14 }}>
            Cần đạt 70% để tính hoàn thành — xem lại phần Học từ rồi thử lại nhé.
          </p>
        )}
        <button className="btn btn-primary" onClick={start}>
          Làm lại
        </button>
      </div>
    );
  }

  const cur = items[i];
  const prevSection = i > 0 ? items[i - 1].section : null;

  return (
    <div className="quiz-box">
      <div className="view-sub">
        Câu {i + 1}/{items.length} · đúng {score}
      </div>
      {warn && (
        <div className="callout-warn" style={{ marginBottom: 12 }}>
          {warn}{" "}
          <button
            className="linkbtn"
            onClick={() => {
              setItems(null);
            }}
          >
            Thử lại AI
          </button>
        </div>
      )}
      {cur.section !== prevSection && (
        <div className="quiz-section">{cur.section}</div>
      )}

      {cur.kind === "mc" ? (
        <McQuestion
          key={i}
          item={cur}
          furigana={furigana}
          onAnswer={answer}
          onNext={next}
          isLast={i + 1 >= items.length}
        />
      ) : (
        <MatchQuestion
          key={i}
          item={cur}
          onAnswer={answer}
          onNext={next}
          isLast={i + 1 >= items.length}
        />
      )}
    </div>
  );
}

function McQuestion({
  item,
  furigana,
  onAnswer,
  onNext,
  isLast,
}: {
  item: McItem;
  furigana: boolean;
  onAnswer: (ok: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const answered = chosen !== null;

  // Nghe và chọn: tự đọc khi câu hiện ra
  useEffect(() => {
    if (item.audio) {
      const t = setTimeout(() => speak(item.audio!), 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  return (
    <>
      <div className="quiz-q">{item.prompt}</div>

      {item.audio ? null : item.prompt.includes("◯") ? (
        <div className="quiz-word small-word">
          <FuriganaText text={item.prompt} enabled={furigana} />
        </div>
      ) : item.section === "Nghĩa của từ" || item.section === "Cách đọc đúng" ? (
        <div className="quiz-word">
          {item.word.kanji || item.word.kana}
          {item.section === "Nghĩa của từ" &&
            item.word.kana &&
            item.word.kana !== item.word.kanji && (
              <div className="word-kana">{item.word.kana}</div>
            )}
          <button
            className="btn-speak small"
            onClick={() => speak(item.word.kanji || item.word.kana || "")}
          >
            Nghe
          </button>
        </div>
      ) : (
        <div className="quiz-word">
          <FuriganaText text={item.prompt.replace(/^Từ nào mang nghĩa: “|”\?$/g, "")} enabled={furigana} />
        </div>
      )}

      {item.hint && <div className="quiz-hint">{item.hint}</div>}

      <div className="quiz-opts">
        {item.options.map((o) => (
          <button
            key={o}
            className={`quiz-opt ${
              answered && o === item.answer
                ? "correct"
                : answered && o === chosen
                  ? "wrong"
                  : ""
            }`}
            disabled={answered}
            onClick={() => {
              if (answered) return;
              setChosen(o);
              onAnswer(o === item.answer);
              if (item.section === "Nghe và chọn") speak(item.answer);
            }}
          >
            {o}
          </button>
        ))}
      </div>
      <div
        className={`quiz-feedback ${
          answered ? (chosen === item.answer ? "ok" : "ng") : ""
        }`}
      >
        {answered &&
          (chosen === item.answer
            ? "Chính xác!"
            : `Chưa đúng — đáp án: ${item.answer}`)}
      </div>
      {answered && item.explain && (
        <div className="explain-box">
          <div className="explain-title">Giải thích</div>
          <div className="explain-body">{item.explain}</div>
        </div>
      )}
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button className="btn btn-primary" disabled={!answered} onClick={onNext}>
          {isLast ? "Xem kết quả" : "Câu sau ›"}
        </button>
      </div>
    </>
  );
}

function MatchQuestion({
  item,
  onAnswer,
  onNext,
  isLast,
}: {
  item: Extract<ExerciseItem, { kind: "match" }>;
  onAnswer: (ok: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const words = useMemo(() => shuffle(item.pairs.map((p) => p.word)), [item]);
  const meanings = useMemo(() => shuffle(item.pairs.map((p) => p.meaning)), [item]);
  const [pickedWord, setPickedWord] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const finished = matched.length === item.pairs.length;

  function pickMeaning(m: string) {
    if (!pickedWord || matched.includes(m)) return;
    const correct = item.pairs.find((p) => p.word === pickedWord)?.meaning === m;
    if (correct) {
      const newMatched = [...matched, m];
      setMatched(newMatched);
      setPickedWord(null);
      if (newMatched.length === item.pairs.length) {
        onAnswer(mistakes === 0); // phần nối cặp tính đúng 1 câu
      }
    } else {
      setMistakes((c) => c + 1);
      setWrong(m);
      setTimeout(() => setWrong(null), 500);
    }
  }

  return (
    <>
      <div className="quiz-q">{item.prompt}</div>
      <div className="match-grid">
        <div className="match-col">
          {words.map((w) => (
            <button
              key={w}
              className={`match-cell ${
                matched.includes(item.pairs.find((p) => p.word === w)!.meaning)
                  ? "done"
                  : ""
              } ${pickedWord === w ? "picked" : ""}`}
              disabled={matched.includes(item.pairs.find((p) => p.word === w)!.meaning)}
              onClick={() => {
                setPickedWord(w);
                speak(w);
              }}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="match-col">
          {meanings.map((m) => (
            <button
              key={m}
              className={`match-cell ${matched.includes(m) ? "done" : ""} ${
                wrong === m ? "wrong" : ""
              }`}
              disabled={matched.includes(m)}
              onClick={() => pickMeaning(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`quiz-feedback ${
          finished ? (mistakes === 0 ? "ok" : "ng") : ""
        }`}
      >
        {finished &&
          (mistakes === 0
            ? "Hoàn hảo — không sai cặp nào!"
            : `Xong! ${mistakes} lần ghép sai.`)}
      </div>
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button className="btn btn-primary" disabled={!finished} onClick={onNext}>
          {isLast ? "Xem kết quả" : "Câu sau ›"}
        </button>
      </div>
    </>
  );
}
