"use client";

import { useEffect, useState } from "react";
import type { Word } from "@/lib/types";
import WordCard from "./WordCard";

const PAGE = 100;

export default function WordList({
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
  const [shown, setShown] = useState(PAGE);

  // đổi đơn vị/từ khoá -> về trang đầu
  useEffect(() => {
    setShown(PAGE);
  }, [words]);

  if (!words.length) {
    return <div className="empty">Không tìm thấy từ nào.</div>;
  }
  const visible = words.slice(0, shown);
  const remaining = words.length - visible.length;

  return (
    <>
      {visible.map((w) => (
        <WordCard
          key={`${w.no}-${w.kanji}`}
          word={w}
          learned={w.no != null && Boolean(progress.learned[String(w.no)])}
          onToggle={onToggle}
          furigana={furigana}
        />
      ))}
      {remaining > 0 && (
        <div style={{ textAlign: "center", padding: "12px 0 30px" }}>
          <button className="btn btn-ghost" onClick={() => setShown((s) => s + PAGE)}>
            Xem thêm {Math.min(PAGE, remaining)} từ (còn {remaining})
          </button>
        </div>
      )}
    </>
  );
}
