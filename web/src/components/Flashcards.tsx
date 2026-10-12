"use client";

import { useEffect, useRef, useState } from "react";
import type { Word } from "@/lib/types";
import { speak } from "@/lib/speech";
import FuriganaText from "./FuriganaText";

export default function Flashcards({
  words,
  progress,
  onToggle,
  furigana,
}: {
  words: Word[];
  progress: { learned: Record<string, true> };
  onToggle: (no: number | null) => void;
  furigana: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const current: Word | undefined = words[Math.min(idx, Math.max(words.length - 1, 0))];

  useEffect(() => {
    if (autoSpeak && current && !flipped) {
      speak(current.kanji || current.kana || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.kanji, flipped, autoSpeak]);

  if (!words.length) return <div className="empty">Không có từ trong mục này.</div>;
  const i = Math.min(idx, words.length - 1);
  const w = current!;
  const isLearned = w.no != null && Boolean(progress.learned[String(w.no)]);

  return (
    <div className="flash-wrap">
      <div className="view-sub" style={{ textAlign: "center" }}>
        Thẻ {i + 1}/{words.length}
      </div>
      <div
        className={`flash-card ${flipped ? "flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
      >
        <div className="flash-front">
          <div className="word-kanji">{w.kanji || w.kana}</div>
          {w.kana && w.kana !== w.kanji && (
            <div className="word-kana">{w.kana}</div>
          )}
          <div className="flash-hint">Bấm vào thẻ để xem nghĩa</div>
        </div>
        <div className="flash-back">
          <div className="word-vi">{w.vi}</div>
          <div className="word-meta" style={{ justifyContent: "center" }}>
            {w.en && <span className="chip">EN: {w.en}</span>}
            {w.kr && <span className="chip">KR: {w.kr}</span>}
          </div>
          {(w.examples || []).slice(0, 2).map((e, k) => (
            <div className="examples" key={k}>
              <div className="example">
                <div className="ja">
                  <FuriganaText text={e.ja} enabled={furigana} />
                </div>
                {e.vi && <div className="vi">{e.vi}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flash-controls">
        <button
          className="btn btn-ghost"
          disabled={i === 0}
          onClick={() => {
            setIdx(i - 1);
            setFlipped(false);
          }}
        >
          ‹ Trước
        </button>
        <button className="btn btn-ghost" onClick={() => speak(w.kanji || w.kana || "")}>
          Nghe
        </button>
        <button
          className={`btn ${isLearned ? "btn-ghost on" : "btn-green"}`}
          onClick={() => onToggle(w.no)}
        >
          {isLearned ? "Đã thuộc ✓" : "Đánh dấu đã thuộc"}
        </button>
        <button
          className="btn btn-primary"
          disabled={i >= words.length - 1}
          onClick={() => {
            setIdx(i + 1);
            setFlipped(false);
          }}
        >
          Sau ›
        </button>
      </div>
      <label className="autospeak">
        <input
          type="checkbox"
          checked={autoSpeak}
          onChange={(e) => setAutoSpeak(e.target.checked)}
        />{" "}
        Tự động đọc từ khi hiện thẻ
      </label>
    </div>
  );
}
