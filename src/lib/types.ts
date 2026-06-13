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

// scorerInfo: keyed by normalized scorer name -> birthplace info
export interface ScorerInfo {
  birthplace?: string;
  lat?: number;
  lng?: number;
}

// The whole per-user document.
export interface UserData {
  events: SportEvent[];
  scorerInfo: Record<string, ScorerInfo>;
  teamLocs: Record<string, LatLng & { city?: string; state?: string; country?: string }>;
  restCategories: unknown[];
  restaurants: unknown[];
  trips: unknown[];
  concerts: unknown[];
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
