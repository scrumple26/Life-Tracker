"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  EMPTY_USER_DATA,
  type SportEvent,
  type UserData,
} from "./types";

// ── Normalization (mirrors legacy defaults so old data is safe) ──────────
function normalizeEvent(e: Record<string, unknown>): SportEvent {
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: String(e.id),
    date: typeof e.date === "string" && e.date ? e.date : null,
    sport: (typeof e.sport === "string" ? e.sport : "other") as SportEvent["sport"],
    homeTeam: str(e.homeTeam),
    awayTeam: str(e.awayTeam),
    homeScore: num(e.homeScore),
    awayScore: num(e.awayScore),
    stadium: str(e.stadium),
    address: str(e.address) || str(e.city),
    side: (["home", "away", "neutral"].includes(e.side as string)
      ? e.side
      : "neutral") as SportEvent["side"],
    scorers: Array.isArray(e.scorers) ? (e.scorers as SportEvent["scorers"]) : [],
    competition: str(e.competition),
    penalties:
      e.penalties && typeof (e.penalties as { home?: unknown }).home === "number"
        ? (e.penalties as SportEvent["penalties"])
        : null,
    homeLineup: Array.isArray(e.homeLineup) ? (e.homeLineup as SportEvent["homeLineup"]) : [],
    awayLineup: Array.isArray(e.awayLineup) ? (e.awayLineup as SportEvent["awayLineup"]) : [],
    notes: str(e.notes),
    photos: Array.isArray(e.photos)
      ? (e.photos as unknown[]).filter((s): s is string => typeof s === "string")
      : [],
    lat: num(e.lat),
    lng: num(e.lng),
    createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
  };
}

function normalizeData(raw: Record<string, unknown> | undefined): UserData {
  if (!raw) return EMPTY_USER_DATA;
  return {
    events: Array.isArray(raw.events)
      ? (raw.events as Record<string, unknown>[])
          .filter((e) => e && typeof e.id === "string")
          .map(normalizeEvent)
      : [],
    scorerInfo: (raw.scorerInfo as UserData["scorerInfo"]) ?? {},
    teamLocs: (raw.teamLocs as UserData["teamLocs"]) ?? {},
    restCategories: Array.isArray(raw.restCategories) ? raw.restCategories : [],
    restaurants: Array.isArray(raw.restaurants) ? raw.restaurants : [],
    trips: Array.isArray(raw.trips) ? raw.trips : [],
    concerts: Array.isArray(raw.concerts) ? raw.concerts : [],
  };
}

export function newId() {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Context ──────────────────────────────────────────────────────────────
interface AppContextValue {
  user: User | null;
  authLoading: boolean;
  data: UserData;
  dataLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  // Persisters — write back to lifeTrackerData/{uid}, merge.
  saveField: <K extends keyof UserData>(field: K, value: UserData[K]) => Promise<void>;
  saveEvents: (events: SportEvent[]) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<UserData>(EMPTY_USER_DATA);
  const [dataLoading, setDataLoading] = useState(true);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      userRef.current = u;
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setData(EMPTY_USER_DATA);
        setDataLoading(false);
      } else {
        setDataLoading(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "lifeTrackerData", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(normalizeData(snap.data() as Record<string, unknown> | undefined));
        setDataLoading(false);
      },
      () => setDataLoading(false)
    );
    return unsub;
  }, [user]);

  const value = useMemo<AppContextValue>(() => {
    const docRefForUser = () => {
      const u = userRef.current;
      return u ? doc(db, "lifeTrackerData", u.uid) : null;
    };
    return {
      user,
      authLoading,
      data,
      dataLoading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      register: async (email, password) => {
        await createUserWithEmailAndPassword(auth, email, password);
      },
      signOutUser: async () => {
        await signOut(auth);
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(auth, email);
      },
      saveField: async (field, value) => {
        const ref = docRefForUser();
        if (!ref) return;
        await setDoc(ref, { [field]: value }, { merge: true });
      },
      saveEvents: async (events) => {
        const ref = docRefForUser();
        if (!ref) return;
        await setDoc(ref, { events }, { merge: true });
      },
    };
  }, [user, authLoading, data, dataLoading]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
