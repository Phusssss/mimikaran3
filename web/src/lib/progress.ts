// Tiến độ học: localStorage là nguồn chính; Firebase (nếu cấu hình) đồng bộ union-merge.
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { firebaseEnabled, getFirebase, ensureAnonUser } from "./firebase";
import type { Progress } from "./types";

const LS_KEY = "mimiN3_progress_v2";

let state: Progress = loadLocal();
const listeners = new Set<() => void>();

function loadLocal(): Progress {
  if (typeof window === "undefined") {
    return { learned: {}, quizBest: null, days: {} };
  }
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "");
    return {
      learned: raw?.learned ?? {},
      quizBest: raw?.quizBest ?? null,
      days: raw?.days ?? {},
    };
  } catch {
    return { learned: {}, quizBest: null, days: {} };
  }
}

function persistLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function notify() {
  listeners.forEach((fn) => fn());
}

function apply(next: Progress, { sync = true } = {}) {
  state = next;
  persistLocal();
  notify();
  if (sync && firebaseEnabled) void pushToCloud();
}

async function pushToCloud() {
  try {
    const uid = await ensureAnonUser();
    if (!uid) return;
    const { db } = (await getFirebase())!;
    await setDoc(
      doc(db, "users", uid, "progress", "main"),
      { ...state, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.warn("[firebase] push progress failed:", e);
  }
}

/** Gọi 1 lần khi app mount: pull tiến độ trên cloud và union-merge với máy. */
export async function initSync() {
  if (!firebaseEnabled) return;
  try {
    const uid = await ensureAnonUser();
    if (!uid) return;
    const { db } = (await getFirebase())!;
    const snap = await getDoc(doc(db, "users", uid, "progress", "main"));
    if (!snap.exists()) {
      await pushToCloud(); // lần đầu: đẩy dữ liệu máy lên
      return;
    }
    const remote = snap.data() as Partial<Progress> & {
      learned?: Record<string, true>;
      quizBest?: number | null;
      days?: Progress["days"];
    };
    const mergedLearned = { ...(remote.learned || {}), ...state.learned };
    const mergedDays: Progress["days"] = { ...(remote.days || {}) };
    for (const [k, v] of Object.entries(state.days || {})) mergedDays[k] = { ...mergedDays[k], ...v };
    const mergedQuiz = pickBest(state.quizBest, remote.quizBest ?? null);
    apply(
      { learned: mergedLearned, quizBest: mergedQuiz, days: mergedDays },
      { sync: false }
    );
    await pushToCloud();
  } catch (e) {
    console.warn("[firebase] pull progress failed:", e);
  }
}

function pickBest(a: number | null, b: number | null) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

export function getProgress(): Progress {
  return state;
}

export function subscribeProgress(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isLearned(no: number | null): boolean {
  return no != null && Boolean(state.learned[String(no)]);
}

export function toggleLearned(no: number | null) {
  if (no == null) return;
  const learned = { ...state.learned };
  if (learned[String(no)]) delete learned[String(no)];
  else learned[String(no)] = true;
  apply({ ...state, learned });
}

export function recordQuizScore(pct: number) {
  apply({ ...state, quizBest: pickBest(state.quizBest, pct) });
}

export function recordDayQuiz(day: number, pct: number) {
  const days = { ...state.days };
  const prev = days[String(day)] || {};
  days[String(day)] = {
    ...prev,
    quizPct: pickBest(prev.quizPct ?? null, pct) ?? undefined,
    done: (prev.quizPct ?? 0) >= 70 || pct >= 70 ? true : prev.done,
    updatedAt: Date.now(),
  };
  apply({ ...state, days });
}

export function recordJlptQuiz(day: number, pct: number) {
  const days = { ...state.days };
  const prev = days[String(day)] || {};
  days[String(day)] = {
    ...prev,
    jlptPct: pickBest(prev.jlptPct ?? null, pct) ?? undefined,
    updatedAt: Date.now(),
  };
  apply({ ...state, days });
}

export function markDayDone(day: number) {
  const days = { ...state.days };
  days[String(day)] = { ...(days[String(day)] || {}), done: true, updatedAt: Date.now() };
  apply({ ...state, days });
}
