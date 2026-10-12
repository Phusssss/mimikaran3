// Lộ trình học: chia 880 từ thành các ngày, mỗi ngày ~perDay từ.
import type { Word } from "./types";

export type Day = {
  day: number;
  from: number; // số thứ tự từ đầu
  to: number;
  words: Word[];
};

export function buildDays(words: Word[], perDay: number): Day[] {
  const days: Day[] = [];
  const size = Math.max(5, Math.min(50, perDay || 20));
  for (let i = 0; i < words.length; i += size) {
    const chunk = words.slice(i, i + size);
    days.push({
      day: days.length + 1,
      from: chunk[0]?.no ?? i + 1,
      to: chunk[chunk.length - 1]?.no ?? i + chunk.length,
      words: chunk,
    });
  }
  return days;
}

/** Từ của các ngày trước ngày hiện tại (để ôn tập ngẫu nhiên). */
export function earlierWords(days: Day[], currentDay: number): Word[] {
  return days
    .filter((d) => d.day < currentDay)
    .flatMap((d) => d.words);
}

/** Chia đều ngữ pháp cho từng ngày học (grammar được sắp theo thứ tự sách). */
export function grammarForDay(
  grammar: { pattern: string }[] | undefined,
  day: number,
  totalDays: number
): { pattern: string }[] {
  if (!grammar || grammar.length === 0) return [];
  const per = grammar.length / totalDays;
  const start = Math.floor((day - 1) * per);
  const end = Math.max(start + 1, Math.floor(day * per));
  return grammar.slice(start, end);
}
