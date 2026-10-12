"use client";

import { useEffect, useState } from "react";
import { segmentsFor, type FuriganaSegment } from "@/lib/furigana";

/** Hiển thị câu tiếng Nhật với furigana (ruby) trên phần kanji. */
export default function FuriganaText({
  text,
  enabled,
}: {
  text: string;
  enabled: boolean;
}) {
  const [segs, setSegs] = useState<FuriganaSegment[] | null>(null);

  useEffect(() => {
    if (!enabled || !text) {
      setSegs(null);
      return;
    }
    let alive = true;
    segmentsFor(text)
      .then((s) => {
        if (alive) setSegs(s);
      })
      .catch((e) => console.warn("[furigana]", e?.message || e));
    return () => {
      alive = false;
    };
  }, [text, enabled]);

  if (!enabled || !segs) return <span>{text}</span>;

  return (
    <span className="furigana">
      {segs.map((s, i) =>
        s.reading ? (
          <ruby key={i}>
            {s.surface}
            <rt>{s.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{s.surface}</span>
        )
      )}
    </span>
  );
}
