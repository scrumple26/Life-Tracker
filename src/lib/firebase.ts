import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase web config keys are public identifiers (security is enforced by
// Firestore/Storage rules, not by hiding these). They match the existing
// `life-tracker-6f707` project so all current data loads unchanged.
// Optionally override per-environment via NEXT_PUBLIC_FIREBASE_* env vars.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyD4f98h80C4QZbBKMef4Upz5-R6T6TyJIg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "life-tracker-6f707.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "life-tracker-6f707",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "life-tracker-6f707.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "508282035523",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:508282035523:web:cd2981dcd973ddf93fe3f6",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Firestore rejects `undefined` field values. `ignoreUndefinedProperties` drops
// them instead (matching JSON semantics), so optional fields left empty — a
// player's position, a scorer's minute — don't break saves. The try/catch keeps
// dev hot-reload from throwing "Firestore has already been started".
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
})();

export const storage = getStorage(app);
export default app;
