"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/types";

export default function ExercisesView({ exercises }: { exercises: Exercise[] }) {
  if (!exercises.length)
    return <div className="empty">Chưa có dữ liệu luyện đề.</div>;

  return (
    <>
      <div className="view-sub">Bấm vào một đáp án để kiểm tra</div>
      {exercises.map((ex, k) => (
        <ExSection key={k} ex={ex} idx={k} />
      ))}
    </>
  );
}

function ExSection({ ex, idx }: { ex: Exercise; idx: number }) {
  // key per section để reset trạng thái khi đổi dữ liệu
  return (
    <div className="ex-section">
      <h3>
        {ex.type || "練習問題"} · {ex.range || ""}
        {ex.book_page ? ` · sách tr.${ex.book_page}` : ""}
      </h3>
      {ex.instruction && (
        <div className="view-sub" style={{ marginBottom: 8 }}>
          {ex.instruction}
        </div>
      )}
      {(ex.questions || []).map((q, j) => (
        <ExQuestion key={j} q={q} no={q.no ?? j + 1 + idx * 0} />
      ))}
    </div>
  );
}

function ExQuestion({
  q,
  no,
}: {
  q: { text?: string; options?: string[]; answer?: string | null };
  no: number;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const opts = q.options || [];
  const answered = picked !== null;

  return (
    <div className="ex-q">
      <div className="ex-text">
        <b>{no}.</b> {q.text}
      </div>
      {opts.length > 0 && (
        <div className="ex-opts">
          {opts.map((o) => {
            const isAns = q.answer && o === q.answer;
            const isPicked = o === picked;
            return (
              <button
                key={o}
                className={`ex-opt ${
                  answered && isAns
                    ? "correct"
                    : answered && isPicked
                      ? "wrong"
                      : ""
                }`}
                disabled={answered}
                onClick={() => setPicked(o)}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}
      {answered && q.answer && (
        <div className="ex-ans">
          {picked === q.answer ? "Chính xác! " : "Chưa đúng. "}Đáp án: {q.answer}
        </div>
      )}
      {!opts.length && q.answer && (
        <div className="ex-ans">Đáp án: {q.answer}</div>
      )}
    </div>
  );
}
