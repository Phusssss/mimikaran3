"use client";

import { useEffect, useRef, useState } from "react";
import type { Word } from "@/lib/types";
import { eligibleWords, getBest, getGameMode, pairFor, shuffle, submitScore } from "@/lib/games";
import { speak } from "@/lib/speech";
import GameModeSelect from "./GameModeSelect";

const PAIRS = 6;

export default function MatchGame({ words, furigana }: { words: Word[]; furigana: boolean }) {
  const mode = getGameMode();
  const [round, setRound] = useState(0);
  const [pickedWord, setPickedWord] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const eligible = eligibleWords(words, mode);

  function makeDeck() {
    return shuffle(eligible)
      .slice(0, PAIRS)
      .map((w) => pairFor(w, getGameMode()))
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }

  const [pairs, setPairs] = useState(makeDeck);
  const [leftCol, setLeftCol] = useState<string[]>(() => shuffle(pairs.map((p) => p.left)));
  const [rightCol, setRightCol] = useState<string[]>(() => shuffle(pairs.map((p) => p.right)));

  useEffect(() => {
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [round]);

  const done = matched.length === pairs.length;

  useEffect(() => {
    if (done && running) {
      setRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      submitScore("match", seconds, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function pickRight(rightText: string) {
    if (!pickedWord) return;
    const p = pairs.find((x) => x.left === pickedWord);
    if (p && p.right === rightText) {
      setMatched((m) => [...m, rightText]);
      speak(p.key);
      setPickedWord(null);
    } else {
      setMistakes((c) => c + 1);
      setWrongPair(rightText);
      setTimeout(() => setWrongPair(null), 450);
    }
  }

  function restart() {
    const deck = makeDeck();
    setPairs(deck);
    setLeftCol(shuffle(deck.map((p) => p.left)));
    setRightCol(shuffle(deck.map((p) => p.right)));
    setMatched([]);
    setPickedWord(null);
    setMistakes(0);
    setSeconds(0);
    setRunning(true);
    setRound((r) => r + 1);
  }

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
        <span>⏱ {seconds}s</span>
        <span>Sai: {mistakes}</span>
        <span className="game-best">Kỷ lục: {getBest("match") != null ? `${getBest("match")}s` : "—"}</span>
      </div>
      <div className="match-grid2">
        <div className="match-col">
          {leftCol.map((w) => {
            const p = pairs.find((x) => x.left === w)!;
            const isDone = matched.includes(p.right);
            return (
              <button
                key={w}
                className={`gcell ${isDone ? "done" : ""} ${pickedWord === w ? "picked" : ""}`}
                disabled={isDone}
                onClick={() => { setPickedWord(w); speak(w); }}
              >
                {w}
              </button>
            );
          })}
        </div>
        <div className="match-col">
          {rightCol.map((v) => (
            <button
              key={v}
              className={`gcell ${matched.includes(v) ? "done" : ""} ${wrongPair === v ? "wrong" : ""}`}
              disabled={matched.includes(v)}
              onClick={() => pickRight(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {done && (
        <div className="game-result">
          Hoàn thành trong {seconds}s · {mistakes} lần sai
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={restart}>Chơi lại</button>
          </div>
        </div>
      )}
    </div>
  );
}
