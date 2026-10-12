// Âm thanh tiếng Nhật bằng Web Speech API.
// Chọn giọng tốt nhất có sẵn trên máy + cho phép người dùng tự chọn.
import { useEffect, useState } from "react";

const LS_VOICE = "mimiN3_voice_v1";
const LS_RATE = "mimiN3_rate_v1";

let preferredVoiceName: string | null = null;
let defaultRate = 0.95;

if (typeof window !== "undefined") {
  preferredVoiceName = localStorage.getItem(LS_VOICE);
  const r = Number(localStorage.getItem(LS_RATE));
  if (r > 0) defaultRate = r;
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

export function isSpeechSupported(): boolean {
  return synth() !== null;
}

/** Điểm ưu tiên: giọng Natural/Neural > Google > tên quen thuộc > giọng ja thường. */
function score(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  if (!v.lang?.toLowerCase().startsWith("ja")) return -1;
  if (n.includes("natural")) return 100;
  if (n.includes("neural")) return 90;
  if (n.includes("google")) return 80;
  if (n.includes("edge")) return 70;
  if (/nanami|haruki|keita|sayaka|orena|aoi|mizuki/.test(n)) return 60;
  if (n.includes("online")) return 50;
  return 10;
}

export function jaVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  if (!s) return [];
  return s
    .getVoices()
    .filter((v) => v.lang?.toLowerCase().startsWith("ja"))
    .sort((a, b) => score(b) - score(a));
}

export function currentVoice(): SpeechSynthesisVoice | null {
  const voices = jaVoices();
  if (preferredVoiceName) {
    const found = voices.find((v) => v.name === preferredVoiceName);
    if (found) return found;
  }
  return voices[0] || null;
}

export function setPreferredVoice(name: string | null) {
  preferredVoiceName = name;
  if (name) localStorage.setItem(LS_VOICE, name);
  else localStorage.removeItem(LS_VOICE);
  notify();
}

export function getRate(): number {
  return defaultRate;
}

export function setRate(r: number) {
  defaultRate = r;
  localStorage.setItem(LS_RATE, String(r));
  notify();
}

/** Đợi voices load xong rồi callback (Chrome load async). */
export function warmUpVoices(onReady?: () => void) {
  const s = synth();
  if (!s) return;
  const ping = () => {
    if (jaVoices().length) {
      s.onvoiceschanged = null;
      onReady?.();
      prewarmEngine(true); // khởi động máy đọc trước để bấm "Nghe" nói được ngay
      startKeepAlive();
    }
  };
  ping();
  s.onvoiceschanged = ping;
}

let prewarmed = false;
let lastPrewarmAt = 0;

/** Nói thầm 1 âm ngắn (volume 0) để máy TTS khởi động + giữ kết nối "ấm",
 *  nhờ đó bấm "Nghe" là nói được gần như tức thì. */
function prewarmEngine(force = false) {
  const s = synth();
  if (!s) return;
  const now = Date.now();
  if (!force && prewarmed && now - lastPrewarmAt < 15000) return;
  if (s.speaking || s.pending) return; // đang nói thật thì không nhản vào
  prewarmed = true;
  lastPrewarmAt = now;
  try {
    const u = new SpeechSynthesisUtterance("あ");
    u.volume = 0;
    u.rate = 1;
    u.lang = "ja-JP";
    const v = currentVoice();
    if (v) u.voice = v;
    s.speak(u);
  } catch {
    /* bỏ qua */
  }
}

/** Giữ kết nối TTS luôn sẵn sàng trong lúc dùng app. */
let keepAliveStarted = false;
function startKeepAlive() {
  const s = synth();
  if (!s || keepAliveStarted) return;
  keepAliveStarted = true;
  setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      prewarmEngine(true);
    }
  }, 20000);
  // Làm ận trước tay: đổ chuột/tam vào gần nút Nghe cũng khởi động kết nối
  document.addEventListener(
    "pointerenter",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".btn-speak, .flash-card, .quiz-opt")) prewarmEngine();
    },
    { capture: true, passive: true }
  );
}

let lastLatencyMs: number | null = null;

/** Độ trễ lần đọc gần nhất (ms) — để debug/hiển thị. */
export function getSpeechLatency(): number | null {
  return lastLatencyMs;
}

export function speak(text: string, rate = defaultRate) {
  const s = synth();
  if (!s || !text) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  const v = currentVoice();
  if (v) u.voice = v;
  u.rate = rate;
  const t0 = performance.now();
  u.onstart = () => {
    lastLatencyMs = Math.round(performance.now() - t0);
    (window as unknown as { __ttsLatency?: number }).__ttsLatency = lastLatencyMs;
  };
  // Chrome có bug: speak() gọi ngay sau cancel() bị trễ hoặc rơi — chờ một nhịp
  setTimeout(() => s.speak(u), 60);
}

/** Hook: re-render khi danh sách giọng/cài đặt đổi. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const update = () => setVoices(jaVoices());
    warmUpVoices(update);
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return voices;
}
