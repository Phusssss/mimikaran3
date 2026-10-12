"use client";

import { useRef, useState } from "react";
import type { Word } from "@/lib/types";
import { eligibleWords, getBest, getGameMode, pairFor, shuffle, submitScore } from "@/lib/games";
import { speak } from "@/lib/speech";
import GameModeSelect from "./GameModeSelect";

const PAIRS = 6;

type Card = { id: number; face: string; key: string; side: "a" | "b" };

export default function MemoryGame({ words }: { words: Word[]; furigana: boolean }) {
  const mode = getGameMode();
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState<number[]>([]);
  const [cleared, setCleared] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);

  const eligible = eligibleWords(words, mode);

  function makeDeck(): Card[] {
    const picked = shuffle(eligible).slice(0, PAIRS);
    return shuffle(
      picked.flatMap((w, i) => {
        const p = pairFor(w, getGameMode())!;
        return [
          { id: i * 2, face: p.left, key: p.key, side: "a" as const },
          { id: i * 2 + 1, face: p.right, key: p.key, side: "b" as const },
        ];
      })
    );
  }

  const [cards, setCards] = useState<Card[]>(makeDeck);
  const done = cleared.length === PAIRS;

  function flip(c: Card) {
    if (busy || open.includes(c.id) || cleared.includes(c.key)) return;
    const next = [...open, c.id];
    setOpen(next);
    if (c.side === "a") speak(c.face);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((id) => cards.find((x) => x.id === id)!);
      if (a.key === b.key && a.side !== b.side) {
        setCleared((s) => [...s, a.key]);
        setOpen([]);
      } else {
        setBusy(true);
        setTimeout(() => { setOpen([]); setBusy(false); }, 750);
      }
    }
  }

  function restart() {
    setCards(makeDeck());
    setOpen([]);
    setCleared([]);
    setMoves(0);
    setBusy(false);
  }

  if (done && moves > 0) submitScore("memory", moves, true);

  if (eligible.length < PAIRS) {
    return (
      <div className="game-box">
        <GameModeSelect />
        <div className="empty">Không đủ từ phù hợp cho chế độ này — chọn chế độ khác.</div>
      </div>
    );
  }

  return (
    <div className="game-box" key={round}>
      <GameModeSelect />
      <div className="game-head">
        <span>Lượt lật: {moves}</span>
        <span>Tìm được: {cleared.length}/{PAIRS}</span>
        <span className="game-best">Kỷ lục: {getBest("memory") != null ? `${getBest("memory")} lượt` : "—"}</span>
      </div>
      <div className="memory-grid">
        {cards.map((c) => {
          const isOpen = open.includes(c.id) || cleared.includes(c.key);
          return (
            <button
              key={c.id}
              className={`mcard ${isOpen ? "open" : ""} ${cleared.includes(c.key) ? "cleared" : ""} ${c.side === "b" ? "vi" : ""}`}
              onClick={() => flip(c)}
            >
              {isOpen ? c.face : "?"}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="game-result">
          Xuất sắc — tìm hết trong {moves} lượt lật!
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={restart}>Chơi lại</button>
          </div>
        </div>
      )}
    </div>
  );
}
