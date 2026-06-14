// Data shapes — mirror the legacy `lifeTrackerData/{uid}` document exactly
// so existing Firebase data loads unchanged.

export type Sport =
  | "soccer"
  | "basketball"
  | "baseball"
  | "american-football"
  | "hockey"
  | "tennis"
  | "rugby"
  | "mma"
  | "other";

export type Side = "home" | "away" | "neutral";

export interface Scorer {
  name: string;
  team: "home" | "away";
  minute?: string;
}

export interface Penalties {
  home: number;
  away: number;
}

export interface LineupEntry {
  name: string;
  pos?: string;
  sub?: boolean;
}

export interface SportEvent {
  id: string;
  date: string | null; // YYYY-MM-DD or null (unknown)
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  stadium: string;
  address: string;
  side: Side;
  scorers: Scorer[];
  competition: string;
  penalties: Penalties | null;
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  notes: string;
  photos: string[]; // Storage download URLs
  lat: number | null;
  lng: number | null;
  createdAt: string; // ISO
}

export interface LatLng {
  lat: number;
  lng: number;
}

// scorerInfo: keyed by normalized scorer name -> birthplace info.
// Legacy data stored structured city/state/country; newer data stores a
// single `birthplace` string. Both are kept so nothing is lost.
export interface ScorerInfo {
  birthplace?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

// ── Life modules ─────────────────────────────────────────────
export interface RestCategory {
  id: string;
  name: string;
}

export interface Restaurant {
  id: string;
  name: string;
  categoryId: string; // -> RestCategory.id, or "" for uncategorized
  cuisine: string;
  rating: number; // 0–5
  city: string;
  country: string;
  dish: string; // standout dish
  notes: string;
  date: string | null; // last visited (YYYY-MM-DD)
  createdAt: string;
}

export interface Trip {
  id: string;
  name: string;
  city: string;
  country: string;
  startDate: string | null;
  endDate: string | null;
  rating: number; // 0–5
  highlights: string[]; // places / stops
  notes: string;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface Concert {
  id: string;
  artist: string;
  venue: string;
  city: string;
  date: string | null;
  openingAct: string;
  setlist: string[];
  spotifyUrl: string;
  rating: number; // 0–5
  notes: string;
  createdAt: string;
}

// The whole per-user document.
export interface UserData {
  events: SportEvent[];
  scorerInfo: Record<string, ScorerInfo>;
  teamLocs: Record<string, LatLng & { city?: string; state?: string; country?: string }>;
  restCategories: RestCategory[];
  restaurants: Restaurant[];
  trips: Trip[];
  concerts: Concert[];
}

export const EMPTY_USER_DATA: UserData = {
  events: [],
  scorerInfo: {},
  teamLocs: {},
  restCategories: [],
  restaurants: [],
  trips: [],
  concerts: [],
};

export const SPORT_LABELS: Record<Sport, string> = {
  soccer: "Soccer / Football",
  basketball: "Basketball",
  baseball: "Baseball",
  "american-football": "American Football",
  hockey: "Hockey",
  tennis: "Tennis",
  rugby: "Rugby",
  mma: "MMA / Boxing",
  other: "Other",
};

// Short labels for compact filter chips.
export const SPORT_SHORT: Record<Sport, string> = {
  soccer: "Soccer",
  basketball: "Basketball",
  baseball: "Baseball",
  "american-football": "Football",
  hockey: "Hockey",
  tennis: "Tennis",
  rugby: "Rugby",
  mma: "MMA",
  other: "Other",
};

export const SPORT_EMOJI: Record<Sport, string> = {
  soccer: "⚽",
  basketball: "🏀",
  baseball: "⚾",
  "american-football": "🏈",
  hockey: "🏒",
  tennis: "🎾",
  rugby: "🏉",
  mma: "🥊",
  other: "🎟️",
};
