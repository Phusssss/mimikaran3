"use client";

import type { Unit, Word } from "@/lib/types";

export default function Sidebar({
  units,
  words,
  progress,
  unit,
  onUnit,
  search,
  onSearch,
}: {
  units: Unit[];
  words: Word[];
  progress: { learned: Record<string, true> };
  unit: string;
  onUnit: (id: string) => void;
  search: string;
  onSearch: (q: string) => void;
}) {
  const countLearned = (ws: Word[]) =>
    ws.filter((w) => w.no != null && progress.learned[String(w.no)]).length;

  const allLearned = countLearned(words);

  return (
    <aside className="sidebar">
      <div className="search-box">
        <input
          id="search-input"
          type="text"
          placeholder="Tìm từ, kanji, nghĩa..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div
        className={`unit-item ${unit === "all" ? "active" : ""}`}
        onClick={() => onUnit("all")}
      >
        <div className="u-label">TẤT CẢ</div>
        <div className="u-title">Toàn bộ sách</div>
        <div className="u-count">
          {words.length} từ · {allLearned} đã thuộc
        </div>
      </div>
      {units.map((u) => {
        const ws = words.filter(
          (w) => w.unit === u.id || (w.no != null && w.no >= u.range[0] && w.no <= u.range[1])
        );
        const done = countLearned(ws);
        const pct = ws.length ? Math.round((done / ws.length) * 100) : 0;
        return (
          <div
            key={u.id}
            className={`unit-item ${unit === u.id ? "active" : ""}`}
            onClick={() => onUnit(u.id)}
          >
            <div className="u-label">
              {u.label} · {u.range[0]}–{u.range[1]}
            </div>
            <div className="u-title">{u.title}</div>
            <div className="u-count">
              {ws.length} từ · {done} đã thuộc
            </div>
            <div className="mini-track">
              <div className="mini-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </aside>
  );
}
