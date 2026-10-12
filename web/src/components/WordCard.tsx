"use client";

import type { Word } from "@/lib/types";
import { speak } from "@/lib/speech";
import FuriganaText from "./FuriganaText";

export default function WordCard({
  word,
  learned,
  onToggle,
  furigana,
  showNo = true,
}: {
  word: Word;
  learned: boolean;
  onToggle: (no: number | null) => void;
  furigana: boolean;
  showNo?: boolean;
}) {
  return (
    <article className={`word-card ${learned ? "learned" : ""}`}>
      <button
        className={`btn-mark ${learned ? "on" : ""}`}
        onClick={() => onToggle(word.no)}
      >
        {learned ? "Đã thuộc ✓" : "Đánh dấu đã thuộc"}
      </button>
      <div className="word-head">
        {showNo && word.no != null && <span className="word-no">#{word.no}</span>}
        <span className="word-kanji">{word.kanji || word.kana}</span>
        {word.kana && word.kana !== word.kanji && (
          <span className="word-kana">{word.kana}</span>
        )}
        <button
          className="btn-speak"
          title="Đọc từ này"
          onClick={() => speak(word.kanji || word.kana || "")}
        >
          Nghe
        </button>
      </div>
      <div className="word-vi">{word.vi}</div>
      <div className="word-meta">
        {word.en && <span className="chip">EN: {word.en}</span>}
        {word.kr && <span className="chip">KR: {word.kr}</span>}
        {(word.senses || []).map((s, i) => (
          <span key={i} className="chip">
            {s}
          </span>
        ))}
      </div>
      {(word.examples || []).length > 0 && (
        <div className="examples">
          {word.examples!.map((e, i) => (
            <div className="example" key={i}>
              <div className="ja">
                <FuriganaText text={e.ja} enabled={furigana} />
                <button
                  className="btn-speak small"
                  title="Đọc câu ví dụ"
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
      {(word.related || []).length > 0 && (
        <div className="related">
          {word.related!.map((r, i) => (
            <span className="rel-chip" key={i}>
              <b>{r.type}</b> {r.text}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
