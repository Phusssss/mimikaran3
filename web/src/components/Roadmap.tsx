"use client";

import type { Day } from "@/lib/plan";
import type { Progress, Word } from "@/lib/types";

export default function Roadmap({
  days,
  progress,
  onOpenDay,
  perDay,
  onPerDay,
  totalWords,
}: {
  days: Day[];
  progress: Progress;
  onOpenDay: (day: number) => void;
  perDay: number;
  onPerDay: (n: number) => void;
  totalWords: number;
}) {
  const doneDays = days.filter(
    (d) => progress.days?.[String(d.day)]?.done
  ).length;

  function dayLearned(d: Day) {
    return d.words.filter(
      (w) => w.no != null && progress.learned?.[String(w.no)]
    ).length;
  }

  return (
    <>
      <div className="roadmap-head">
        <div>
          <div className="view-title">Lộ trình học hằng ngày</div>
          <div className="view-sub">
            {days.length} ngày · {totalWords} từ · đã hoàn thành {doneDays} ngày
          </div>
        </div>
        <label className="perday">
          Số từ mỗi ngày:{" "}
          <select
            value={perDay}
            onChange={(e) => onPerDay(Number(e.target.value))}
          >
            {[10, 15, 20, 25, 30].map((n) => (
              <option key={n} value={n}>
                {n} từ
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="day-grid">
        {days.map((d) => {
          const st = progress.days?.[String(d.day)];
          const learned = dayLearned(d);
          const pct = Math.round((learned / d.words.length) * 100);
          return (
            <button
              key={d.day}
              className={`day-card ${st?.done ? "done" : ""}`}
              onClick={() => onOpenDay(d.day)}
            >
              <div className="day-top">
                <span className="day-num">Ngày {d.day}</span>
                {st?.done && <span className="badge-done">Hoàn thành</span>}
                {st?.quizPct != null && (
                  <span className="badge-score">{st.quizPct}%</span>
                )}
              </div>
              <div className="day-range">
                Từ #{d.from} – #{d.to}
              </div>
              <div className="day-count">
                {d.words.length} từ · {learned} đã thuộc
              </div>
              <div className="mini-track dark">
                <div className="mini-fill" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
