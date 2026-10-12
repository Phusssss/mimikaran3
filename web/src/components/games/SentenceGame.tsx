"use client";

import { useEffect, useRef, useState } from "react";
import type { Word } from "@/lib/types";
import { segmentsFor } from "@/lib/furigana";
import { getBest, shuffle, submitScore } from "@/lib/games";
import { speak } from "@/lib/speech";

const ROUNDS = 5;

type Prepared = { ja: string; tokens: string[]; vi: string; word: string };

export default function SentenceGame({ words, furigana }: { words: Word[]; furigana: boolean }) {
  const [round, setRound] = useState(0);
  const [tiles, setTiles] = useState<string[]>([]);
  const [built, setBuilt] = useState<string[]>([]);
  const [wrongTile, setWrongTile] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [loading, setLoading] = useState(true);

  const poolRef = useRef(
    words
      .filter((w) => (w.examples || []).length > 0)
      .slice(0, 12)
      .map((w) => ({ w, ex: w.examples![0] }))
  );
  const sentences = useRef<Prepared[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // chuẩn bị ROUNDS câu: tokenize bằng kuromoji
      const pool = shuffle(poolRef.current);
      const chosen: Prepared[] = [];
      for (const item of pool) {
        if (chosen.length >= ROUNDS) break;
        const segs = await segmentsFor(item.ex.ja);
        const tokens = segs.filter((s) => s.surface.trim()).map((s) => s.surface);
        if (tokens.length >= 3 && tokens.length <= 11) {
          chosen.push({ ja: item.ex.ja, tokens, vi: item.ex.vi || "", word: item.w.kanji });
        }
      }
      if (!alive) return;
      sentences.current = chosen;
      setLoading(false);
      loadRound(0, chosen);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadRound(idx: number, list = sentences.current) {
    if (idx >= list.length) return;
    const s = list[idx];
    setTiles(shuffle(s.tokens));
    setBuilt([]);
  }

  async function nextRound() {
    const next = round + 1;
    setRound(next);
    if (next < sentences.current.length) loadRound(next);
  }

  function pickTile(t: string, idx: number) {
    const s = sentences.current[round];
    if (!s) return;
    const expected = s.tokens[built.length];
    if (t === expected) {
      const nb = [...built, t];
      setBuilt(nb);
      setTiles((tl) => tl.filter((_, i) => i !== idx));
      if (nb.length === s.tokens.length) {
        submitScore("sentence", score + 1, false);
        setScore((x) => x + 1);
        speak(s.ja);
        setTimeout(() => { void nextRound(); }, 900);
      }
    } else {
      setTries((c) => c + 1);
      setWrongTile(t);
      setTimeout(() => setWrongTile(null), 400);
    }
  }

  const s = sentences.current[round];
  const finished = round >= Math.min(ROUNDS, sentences.current.length) && !loading;

  if (loading) return <div className="game-box"><div className="empty">Đang chuẩn bị câu…</div></div>;

  if (finished) {
    return (
      <div className="game-box">
        <div className="game-head">
          <span>Đúng: {score}/{Math.min(ROUNDS, sentences.current.length)} câu</span>
          <span>Giật lỗi: {tries}</span>
          <span className="game-best">Kỷ lục: {getBest("sentence") ?? "—"}/5 câu</span>
        </div>
        <div className="game-result">
          Hoàn thành {Math.min(ROUNDS, sentences.current.length)} câu!
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={() => { setRound(0); setScore(0); setTries(0); loadRound(0); }}>
              Chơi lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-box">
      <div className="game-head">
        <span>Câu {round + 1}/{Math.min(ROUNDS, sentences.current.length)}</span>
        <span>Đúng: {score}</span>
        <span className="game-best">Kỷ lục: {getBest("sentence") ?? "—"}/5</span>
      </div>
      <div className="sent-hint">
        <b>{s.word}</b> — {s.vi || "dựng lại câu ví dụ"}
      </div>
      <div className="sent-built">
        {built.map((t, i) => (
          <span key={i} className="tile locked">{t}</span>
        ))}
        {!built.length && <span className="sent-empty">Bấm các từ bên dưới để dựng câu…</span>}
      </div>
      <div className="sent-tiles">
        {tiles.map((t, i) => (
          <button
            key={i}
            className={`tile ${wrongTile === t ? "wrong" : ""}`}
            onClick={() => pickTile(t, i)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
