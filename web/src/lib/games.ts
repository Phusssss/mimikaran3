// Lưu điểm cao nhất của mini game + chế độ học.
import type { Word } from "./types";

const LS_GAMES = "mimiN3_games_v1";

type GameBest = Record<string, number>; // key: game id -> best score (thấp hơn = tốt hơn cho thời gian)

let best: GameBest = load();

function load(): GameBest {
  try { return JSON.parse(localStorage.getItem(LS_GAMES) || "") || {}; }
  catch { return {}; }
}

export function getBest(gameId: string): number | null {
  return best[gameId] ?? null;
}

export function submitScore(gameId: string, score: number, lowerIsBetter = false): boolean {
  const cur = best[gameId];
  const better = cur == null || (lowerIsBetter ? score < cur : score > cur);
  if (better) {
    best = { ...best, [gameId]: score };
    localStorage.setItem(LS_GAMES, JSON.stringify(best));
  }
  return better;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---- Chế độ học (chiều hỏi – đáp) cho game ---- */
export type GameMode = "meaning" | "reverse" | "reading" | "write" | "listening";

export const GAME_MODES: { id: GameMode; label: string; note: string }[] = [
  { id: "meaning", label: "kanji → nghĩa", note: "thấy kanji, chọn nghĩa tiếng Việt" },
  { id: "reverse", label: "nghĩa → kanji", note: "thấy nghĩa, chọn kanji" },
  { id: "reading", label: "kanji → kana", note: "thấy kanji, chọn cách đọc" },
  { id: "write", label: "kana → kanji", note: "thấy cách đọc, chọn kanji" },
  { id: "listening", label: "nghe → kanji", note: "nghe âm thanh, chọn kanji" },
];

const LS_MODE = "mimiN3_gamemode_v1";

export function getGameMode(): GameMode {
  const v = typeof window !== "undefined" ? localStorage.getItem(LS_MODE) : null;
  return (v as GameMode) || "meaning";
}

export function saveGameMode(m: GameMode) {
  localStorage.setItem(LS_MODE, m);
}

export type GamePair = { left: string; right: string; key: string };

/** Tạo cặp theo chế độ; trả null nếu từ không phù hợp (vd: không có kana riêng). */
export function pairFor(
  w: Word,
  mode: GameMode
): GamePair | null {
  const kanji = w.kanji || "";
  const kana = w.kana || "";
  const vi = w.vi || "";
  switch (mode) {
    case "meaning":
      return kanji && vi ? { left: kanji, right: vi, key: kanji } : null;
    case "reverse":
      return kanji && vi ? { left: vi, right: kanji, key: kanji } : null;
    case "reading":
      return kanji && kana && kana !== kanji ? { left: kanji, right: kana, key: kanji } : null;
    case "write":
      return kanji && kana && kana !== kanji ? { left: kana, right: kanji, key: kanji } : null;
    case "listening":
      return null; // chỉ dùng cho SpeedGame
  }
}

/** Lọc từ phù hợp theo chế độ (reading/write cần kana khác kanji). */
export function eligibleWords(words: Word[], mode: GameMode): Word[] {
  if (mode === "reading" || mode === "write") {
    return words.filter(
      (w) => w.kana && w.kana !== w.kanji && w.kana.length <= 10 && w.kanji
    );
  }
  return words.filter((w) => w.kanji && w.vi);
}
