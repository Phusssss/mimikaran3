"use client";

import { useEffect, useState } from "react";
import type { Word } from "@/lib/types";
import { getGameMode } from "@/lib/games";
import MatchGame from "./MatchGame";
import MemoryGame from "./MemoryGame";
import SentenceGame from "./SentenceGame";
import SpeedGame from "./SpeedGame";

type GameId = "match" | "memory" | "sentence" | "speed";

const GAMES: { id: GameId; name: string; desc: string }[] = [
  { id: "match", name: "Ghép từ", desc: "Nối 2 cột theo chế độ đã chọn — tính giờ" },
  { id: "memory", name: "Trí nhớ", desc: "Lật thẻ tìm cặp theo chế độ đã chọn" },
  { id: "sentence", name: "Sắp xếp câu", desc: "Dựng lại câu ví dụ từ các từ xáo trộn" },
  { id: "speed", name: "Thử tốc độ", desc: "45 giây — trả lời nhanh theo chế độ đã chọn" },
];

export default function GamePicker({ words, all, furigana }: { words: Word[]; all: Word[]; furigana: boolean }) {
  const [game, setGame] = useState<GameId | null>(null);
  const [modeTick, setModeTick] = useState(0);

  useEffect(() => {
    const bump = () => setModeTick((t) => t + 1); // đổi chế độ -> nạp lại game đang mở
    window.addEventListener("gamemodechange", bump);
    return () => window.removeEventListener("gamemodechange", bump);
  }, []);

  if (!game) {
    return (
      <div className="game-picker">
        {GAMES.map((g) => (
          <button key={g.id} className="game-card" onClick={() => setGame(g.id)}>
            <div className="game-name">{g.name}</div>
            <div className="game-desc">{g.desc}</div>
          </button>
        ))}
      </div>
    );
  }

  // key=modeTick để game nạp lại đúng chế độ mới nếu đổi mode từ trong game
  return (
    <>
      <button className="linkbtn" style={{ marginBottom: 10 }} onClick={() => setGame(null)}>
        ‹ Chọn trò chơi khác
      </button>
      {game === "match" && <MatchGame key={"m" + modeTick + getGameMode()} words={words} furigana={furigana} />}
      {game === "memory" && <MemoryGame key={"e" + modeTick + getGameMode()} words={words} furigana={furigana} />}
      {game === "sentence" && <SentenceGame key={"s" + modeTick} words={words} furigana={furigana} />}
      {game === "speed" && <SpeedGame key={"p" + modeTick + getGameMode()} words={words} all={all} />}
    </>
  );
}
