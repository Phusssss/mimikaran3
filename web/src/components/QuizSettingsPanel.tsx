"use client";

import { useState } from "react";
import {
  QUIZ_TYPE_LABELS,
  saveQuizSettings,
  type QuizSettings,
  type QuizTypeId,
} from "@/lib/quiz";

/** Panel cài đặt đề dùng chung: chọn dạng câu + xáo trộn. */
export default function QuizSettingsPanel({
  settings,
  onChange,
  showTypes = true,
}: {
  settings: QuizSettings;
  onChange: (s: QuizSettings) => void;
  showTypes?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function update(next: QuizSettings) {
    onChange(next);
    saveQuizSettings(next);
  }

  return (
    <div className="qset-zone">
      <button className="linkbtn" onClick={() => setOpen((v) => !v)}>
        Cài đặt đề {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="qset-grid">
          {showTypes &&
            (Object.keys(QUIZ_TYPE_LABELS) as QuizTypeId[]).map((t) => (
              <label key={t} className="qset-item">
                <input
                  type="checkbox"
                  checked={settings.types[t]}
                  onChange={(e) =>
                    update({ ...settings, types: { ...settings.types, [t]: e.target.checked } })
                  }
                />
                {QUIZ_TYPE_LABELS[t]}
              </label>
            ))}
          <label className="qset-item shuffle">
            <input
              type="checkbox"
              checked={settings.shuffle}
              onChange={(e) => update({ ...settings, shuffle: e.target.checked })}
            />
            Xáo trộn thứ tự câu
          </label>
        </div>
      )}
    </div>
  );
}
