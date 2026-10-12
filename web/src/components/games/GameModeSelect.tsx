"use client";

import { GAME_MODES, getGameMode, saveGameMode, type GameMode } from "@/lib/games";

export default function GameModeSelect({
  allowed = ["meaning", "reverse", "reading", "write"],
  value,
  onChange,
}: {
  allowed?: GameMode[];
  value?: GameMode;
  onChange?: (m: GameMode) => void;
}) {
  const cur = value || getGameMode();
  return (
    <label className="gamemode-row">
      Chế độ:{" "}
      <select
        value={cur}
        onChange={(e) => {
          const m = e.target.value as GameMode;
          saveGameMode(m);
          onChange?.(m);
          window.dispatchEvent(new CustomEvent("gamemodechange"));
        }}
      >
        {GAME_MODES.filter((m) => allowed.includes(m.id)).map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.note}
          </option>
        ))}
      </select>
    </label>
  );
}
