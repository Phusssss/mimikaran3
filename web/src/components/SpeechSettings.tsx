"use client";

import { useState } from "react";
import {
  useVoices,
  currentVoice,
  setPreferredVoice,
  getRate,
  setRate,
  speak,
  isSpeechSupported,
} from "@/lib/speech";

export default function SpeechSettings() {
  const voices = useVoices();
  const [open, setOpen] = useState(false);
  const rate = getRate();

  if (!isSpeechSupported()) return null;
  const cur = currentVoice();

  return (
    <div className="speech-settings">
      <button
        className="btn-ghost btn-furigana"
        onClick={() => setOpen((o) => !o)}
      >
        Giọng đọc: {cur ? cur.name.replace(/^Microsoft |^Google /, "").slice(0, 18) : "—"} ▾
      </button>
      {open && (
        <div className="speech-panel">
          <label className="sp-row">
            Giọng:
            <select
              value={cur?.name || ""}
              onChange={(e) => setPreferredVoice(e.target.value || null)}
            >
              {voices.length === 0 && <option value="">(không có giọng ja)</option>}
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="sp-row">
            Tốc độ:
            <select
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            >
              <option value={0.7}>0.7x chậm</option>
              <option value={0.85}>0.85x</option>
              <option value={0.95}>0.95x thường</option>
              <option value={1.1}>1.1x nhanh</option>
            </select>
          </label>
          <button
            className="btn btn-ghost"
            onClick={() => speak("日本語能力試験、三級。頑張りましょう。")}
          >
            Thử giọng
          </button>
          <p className="sp-note">
            Giọng "Natural/Online" nghe hay nhưng khởi động chậm hơn (1–2 giây
            vì đọc qua mạng). Muốn phản hồi tức thì hãy chọn giọng local
            (không chữ Online). Cài thêm giọng: Settings → Time &amp; Language
            → Speech → Add voices → Japanese.
          </p>
        </div>
      )}
    </div>
  );
}
