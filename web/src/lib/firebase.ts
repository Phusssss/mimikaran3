// Firebase (tuỳ chọn): chỉ kích hoạt khi có .env.local đầy đủ.
// Chưa cấu hình -> firebaseEnabled = false, app chạy thuần localStorage.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export async function getFirebase() {
  if (!firebaseEnabled) return null;
  if (cached) return cached;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}

export async function ensureAnonUser(): Promise<string | null> {
  if (!firebaseEnabled) return null;
  try {
    const { auth } = (await getFirebase())!;
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (e) {
    console.warn("[firebase] anonymous sign-in failed:", e);
    return null;
  }
}
