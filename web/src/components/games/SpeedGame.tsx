"use client";

import { useEffect, useRef, useState } from "react";
import type { Word } from "@/lib/types";
import { shuffle } from "@/lib/quiz";
import { eligibleWords, getBest, getGameMode, pairFor, submitScore } from "@/lib/games";
import { speak } from "@/lib/speech";
import GameModeSelect from "./GameModeSelect";

const TIME_LIMIT = 45;

type SQ = { prompt: string | null; audio: string | null; options: string[]; answer: string; speakText: string };

export default function SpeedGame({ words, all }: { words: Word[]; all: Word[] }) {
  const mode = getGameMode();
  const [q, setQ] = useState<SQ | null>(null);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(TIME_LIMIT);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState<"ok" | "ng" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function makeQ(): SQ {
    if (mode === "listening") {
      const w = shuffle(words.filter((x) => x.kanji && x.vi))[0];
      const dis = shuffle(all.filter((x) => x.vi && x.no !== w.no && x.kanji)).slice(0, 3).map((x) => x.kanji);
      const kana = w.kana && w.kana !== w.kanji ? w.kana : w.kanji;
      return { prompt: null, audio: kana, options: shuffle([w.kanji, ...dis]), answer: w.kanji, speakText: kana };
    }
    const w = shuffle(eligibleWords(words, mode))[0];
    const p = pairFor(w, mode)!;
    const distrField = mode === "meaning" ? (x: Word) => x.vi! : mode === "reverse" ? (x: Word) => x.kanji : mode === "reading" ? (x: Word) => x.kana || "" : (x: Word) => x.kanji;
    const dis = shuffle(all.filter((x) => x.no !== w.no).map(distrField).filter(Boolean)).slice(0, 3);
    return { prompt: p.left, audio: null, options: shuffle([p.right, ...dis]), answer: p.right, speakText: w.kanji || w.kana || "" };
  }

  function start() {
    setCorrect(0);
    setWrong(0);
    setLeft(TIME_LIMIT);
    setRunning(true);
    setQ(makeQ());
  }

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setRunning(false);
          submitScore("speed", correct);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // đề nghe: tự đọc khi hiện câu
  useEffect(() => {
    if (running && q?.audio) {
      const t = setTimeout(() => speak(q.audio!), 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pick(v: string) {
    if (!running || !q) return;
    const ok = v === q.answer;
    if (ok) { setCorrect((c) => c + 1); setFlash("ok"); speak(q.speakText); }
    else { setWrong((c) => c + 1); setFlash("ng"); }
    setTimeout(() => setFlash(null), 250);
    setQ(makeQ());
  }

  if (!running && !q) {
    return (
      <div className="game-box">
        <GameModeSelect allowed={["meaning", "reverse", "reading", "write", "listening"]} />
        <div className="game-head"><span className="game-best">Kỷ lục: {getBest("speed") ?? 0} câu đúng</span></div>
        <div className="game-result">
          Trả lời càng nhiều càng tốt trong {TIME_LIMIT} giây!
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={start}>Bắt đầu</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`game-box speed ${flash === "ok" ? "flash-ok" : flash === "ng" ? "flash-ng" : ""}`}>
      <GameModeSelect allowed={["meaning", "reverse", "reading", "write", "listening"]} />
      <div className="game-head">
        <span className={left <= 10 ? "time-low" : ""}>⏱ {left}s</span>
        <span>✓ {correct}</span>
        <span>✗ {wrong}</span>
        <span className="game-best">Kỷ lục: {getBest("speed") ?? 0}</span>
      </div>
      {!running ? (
        <div className="game-result">
          Hết giờ! Đúng {correct} — sai {wrong}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={start}>Chơi lại</button>
          </div>
        </div>
      ) : q ? (
        <>
          {q.prompt ? (
            <div className="quiz-word" style={{ margin: "14px 0" }}>{q.prompt}</div>
          ) : (
            <div className="quiz-word" style={{ margin: "14px 0" }}>
              🔊 Nghe rồi chọn
              <button className="btn-speak small" style={{ marginLeft: 10 }} onClick={() => speak(q.audio!)}>Nghe lại</button>
            </div>
          )}
          <div className="quiz-opts">
            {q.options.map((o) => (
              <button key={o} className="quiz-opt" onClick={() => pick(o)}>{o}</button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
