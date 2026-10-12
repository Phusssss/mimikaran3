"use client";

import { useEffect, useMemo, useState } from "react";
import bookData from "@/data/book.json";
import type { BookData, Word } from "@/lib/types";
import {
  getProgress,
  initSync,
  recordQuizScore,
  recordDayQuiz,
  recordJlptQuiz,
  markDayDone,
  subscribeProgress,
  toggleLearned,
} from "@/lib/progress";
import { firebaseEnabled } from "@/lib/firebase";
import { buildDays, earlierWords, grammarForDay } from "@/lib/plan";
import { warmUpVoices, isSpeechSupported } from "@/lib/speech";
import Sidebar from "@/components/Sidebar";
import WordList from "@/components/WordList";
import DayView from "@/components/DayView";
import Roadmap from "@/components/Roadmap";
import ColumnsView from "@/components/ColumnsView";
import ExercisesView from "@/components/ExercisesView";
import SpeechSettings from "@/components/SpeechSettings";

const BOOK = bookData as unknown as BookData;

const TABS = [
  { id: "roadmap", label: "Lộ trình học" },
  { id: "list", label: "Danh sách từ" },
  { id: "columns", label: "Chuyên mục" },
  { id: "exercises", label: "Luyện đề" },
] as const;

type ViewId = (typeof TABS)[number]["id"];
const LS_PERDAY = "mimiN3_perDay_v1";
const LS_FURIGANA = "mimiN3_furigana_v1";

export default function Home() {
  const [, force] = useState(0);
  const [view, setView] = useState<ViewId>("roadmap");
  const [unit, setUnit] = useState("all");
  const [search, setSearch] = useState("");
  const [day, setDay] = useState<number | null>(null);
  const [perDay, setPerDay] = useState(20);
  const [furigana, setFurigana] = useState(true);
  const [speechOk, setSpeechOk] = useState(true);

  useEffect(() => {
    const saved = Number(localStorage.getItem(LS_PERDAY));
    if (saved) setPerDay(saved);
    const f = localStorage.getItem(LS_FURIGANA);
    if (f != null) setFurigana(f === "1");
    setSpeechOk(isSpeechSupported());
    warmUpVoices(() => force((x) => x + 1));
    const unsub = subscribeProgress(() => force((x) => x + 1));
    void initSync();
    return () => {
      unsub();
    };
  }, []);

  function savePerDay(n: number) {
    setPerDay(n);
    localStorage.setItem(LS_PERDAY, String(n));
  }
  function toggleFurigana() {
    const next = !furigana;
    setFurigana(next);
    localStorage.setItem(LS_FURIGANA, next ? "1" : "0");
  }

  const progress = getProgress();

  const allWords: Word[] = useMemo(() => {
    const ws = [...BOOK.words];
    ws.sort((a, b) => (a.no ?? 9999) - (b.no ?? 9999));
    for (const w of ws) {
      if (!w.unit) {
        const u = BOOK.units.find(
          (x) => w.no != null && w.no >= x.range[0] && w.no <= x.range[1]
        );
        w.unit = u ? u.id : "misc";
      }
    }
    return ws;
  }, []);

  const days = useMemo(() => buildDays(allWords, perDay), [allWords, perDay]);
  const currentDay = day != null ? days.find((d) => d.day === day) : undefined;
  const reviewPool = useMemo(
    () => (day != null ? earlierWords(days, day) : []),
    [days, day]
  );

  const unitWords = useMemo(
    () => (unit === "all" ? allWords : allWords.filter((w) => w.unit === unit)),
    [unit, allWords]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unitWords;
    return allWords.filter((w) => {
      const hay = [
        w.kanji,
        w.kana,
        w.vi,
        w.en,
        w.kr,
        String(w.no ?? ""),
        ...(w.examples || []).map((e) => e.ja + " " + (e.vi || "")),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [search, unitWords, allWords]);

  const learnedTotal = allWords.filter(
    (w) => w.no != null && progress.learned[String(w.no)]
  ).length;
  const pct = allWords.length
    ? Math.round((learnedTotal / allWords.length) * 100)
    : 0;
  const doneDays = days.filter((d) => progress.days?.[String(d.day)]?.done).length;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-ja">
            耳から覚える
            <br />
            <span>語彙 N3</span>
          </div>
          <div className="brand-info">
            <h1>Học từ vựng tiếng Nhật JLPT N3</h1>
            <p>
              {allWords.length} từ · {learnedTotal} đã thuộc · {doneDays}/
              {days.length} ngày hoàn thành
            </p>
          </div>
        </div>
        <div className="topbar-right">
          <SpeechSettings />
          <button
            className={`btn-ghost btn-furigana ${furigana ? "on" : ""}`}
            onClick={toggleFurigana}
            title="Hiện furigana trên kanji trong câu ví dụ"
          >
            Furigana: {furigana ? "BẬT" : "TẮT"}
          </button>
          <div className="overall-progress">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="progress-label">{pct}%</span>
          </div>
          <span
            className="cloud-chip"
            title={
              firebaseEnabled
                ? "Đang đồng bộ tiến độ qua Firebase"
                : "Chưa cấu hình Firebase — tiến độ lưu trên máy này."
            }
          >
            {firebaseEnabled ? "☁ Đã đồng bộ" : "☁ Chưa kết nối"}
          </span>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={view === t.id ? "active" : ""}
            onClick={() => {
              setView(t.id);
              if (t.id !== "roadmap") setDay(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="layout">
        {view === "list" && (
          <Sidebar
            units={BOOK.units}
            words={allWords}
            progress={progress}
            unit={unit}
            onUnit={(id) => setUnit(id)}
            search={search}
            onSearch={(q) => setSearch(q)}
          />
        )}
        <main className={`main ${view === "list" ? "" : "full"}`}>
          {view === "roadmap" && !currentDay && (
            <>
              {!speechOk && (
                <div className="callout-warn">
                  Trình duyệt này không hỗ trợ đọc tiếng Nhật (Web Speech API).
                  Hãy dùng Chrome hoặc Edge trên Windows để có âm thanh.
                </div>
              )}
              <Roadmap
                days={days}
                progress={progress}
                onOpenDay={(d) => setDay(d)}
                perDay={perDay}
                onPerDay={savePerDay}
                totalWords={allWords.length}
              />
            </>
          )}

          {view === "roadmap" && currentDay && (
            <DayView
              day={currentDay}
              reviewPool={reviewPool}
              allWords={allWords}
              grammar={grammarForDay(BOOK.grammar || [], currentDay.day, days.length)}
              progress={progress}
              onToggle={toggleLearned}
              furigana={furigana}
              onBack={() => setDay(null)}
              onQuizDone={(d, pct) => {
                recordDayQuiz(d, pct);
                recordQuizScore(pct);
              }}
              onJlptDone={(d, pct) => {
                recordJlptQuiz(d, pct);
                recordQuizScore(pct);
              }}
              onMarkDone={markDayDone}
            />
          )}

          {view === "list" && (
            <>
              <div className="view-title">
                {search.trim()
                  ? "Kết quả tìm kiếm"
                  : BOOK.units.find((u) => u.id === unit)
                    ? `${BOOK.units.find((u) => u.id === unit)!.label} — ${BOOK.units.find((u) => u.id === unit)!.title}`
                    : "Toàn bộ sách"}
              </div>
              <div className="view-sub">
                {search.trim()
                  ? `${filtered.length} kết quả cho “${search.trim()}”`
                  : `${filtered.length} từ · ${filtered.filter((w) => w.no != null && progress.learned[String(w.no)]).length} đã thuộc`}
              </div>
              <WordList
                words={filtered}
                progress={progress}
                onToggle={toggleLearned}
                furigana={furigana}
              />
            </>
          )}

          {view === "columns" && <ColumnsView columns={BOOK.columns || []} />}
          {view === "exercises" && (
            <ExercisesView exercises={BOOK.exercises || []} />
          )}
        </main>
      </div>
    </>
  );
}
