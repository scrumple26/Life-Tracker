// Data shapes — mirror the legacy `lifeTrackerData/{uid}` document exactly
// so existing Firebase data loads unchanged.

// Sport ids are open-ended: the known ones with metadata below, their
// `college-*` variants, plus any custom slug the user invents (e.g. "cricket").
// Kept as a string so users can add sports that aren't in our list.
export type Sport = string;

export type Side = "home" | "away" | "neutral";

export interface Scorer {
  name: string;
  team: "home" | "away";
  minute?: string;
  playerId?: number; // API-Football player id, when filled from the API
}

export interface Penalties {
  home: number;
  away: number;
}

export interface LineupEntry {
  name: string;
  pos?: string;
  sub?: boolean;
  playerId?: number; // API-Football player id, when filled from the API
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

// A stop/place within a trip — shown as an expandable sub-point under the trip.
export interface TripLocation {
  id: string;
  name: string; // e.g. "Kyoto" or "Fushimi Inari Shrine"
  notes: string; // details revealed when the location is expanded
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
  locations: TripLocation[]; // expandable sub-locations within the trip
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

// playerInfo: keyed by API-Football player id -> birth details (covers every
// player seen in lineups, scorers included).
export interface PlayerInfo {
  name: string;
  birthplace?: string;
  country?: string;
  nationality?: string;
  dob?: string;
  lat?: number;
  lng?: number;
  approx?: boolean; // coords are country-level (city couldn't be geocoded)
}

// The whole per-user document.
export interface UserData {
  events: SportEvent[];
  scorerInfo: Record<string, ScorerInfo>;
  playerInfo: Record<string, PlayerInfo>;
  teamLocs: Record<string, LatLng & { city?: string; state?: string; country?: string }>;
  restCategories: RestCategory[];
  restaurants: Restaurant[];
  trips: Trip[];
  concerts: Concert[];
}

export const EMPTY_USER_DATA: UserData = {
  events: [],
  scorerInfo: {},
  playerInfo: {},
  teamLocs: {},
  restCategories: [],
  restaurants: [],
  trips: [],
  concerts: [],
};

interface SportMeta {
  label: string; // full label, e.g. "Soccer / Football"
  short: string; // compact label for chips/cards
  emoji: string;
}

// Display metadata for the sports we know about (standard + college variants).
// Anything not listed here is a custom sport and falls back to a title-cased
// version of its id.
const SPORT_META: Record<string, SportMeta> = {
  soccer: { label: "Soccer / Football", short: "Soccer", emoji: "⚽" },
  basketball: { label: "Basketball", short: "Basketball", emoji: "🏀" },
  baseball: { label: "Baseball", short: "Baseball", emoji: "⚾" },
  "american-football": { label: "American Football", short: "Football", emoji: "🏈" },
  hockey: { label: "Hockey", short: "Hockey", emoji: "🏒" },
  tennis: { label: "Tennis", short: "Tennis", emoji: "🎾" },
  rugby: { label: "Rugby", short: "Rugby", emoji: "🏉" },
  mma: { label: "MMA / Boxing", short: "MMA", emoji: "🥊" },
  "college-soccer": { label: "College Soccer", short: "College Soccer", emoji: "⚽" },
  "college-basketball": { label: "College Basketball", short: "College Hoops", emoji: "🏀" },
  "college-baseball": { label: "College Baseball", short: "College Baseball", emoji: "⚾" },
  "college-football": { label: "College Football", short: "College FB", emoji: "🏈" },
  "college-hockey": { label: "College Hockey", short: "College Hockey", emoji: "🏒" },
  other: { label: "Other", short: "Other", emoji: "🎟️" },
};

// Offered in the "Add sport" picker, in display order. Users can also type a
// custom sport that isn't in this list.
export const SPORT_PRESETS: Sport[] = [
  "soccer",
  "basketball",
  "american-football",
  "baseball",
  "hockey",
  "tennis",
  "rugby",
  "mma",
  "college-soccer",
  "college-basketball",
  "college-football",
  "college-baseball",
  "college-hockey",
];

// Order sports are shown in (grids, filters). Custom sports sort after these.
export const SPORT_ORDER: Sport[] = [...SPORT_PRESETS, "other"];

/** "college-baseball" -> "College Baseball" (for custom / unknown sports). */
function titleCaseSport(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sportLabel(id: Sport): string {
  return SPORT_META[id]?.label ?? (titleCaseSport(id) || "Sport");
}
export function sportShort(id: Sport): string {
  return SPORT_META[id]?.short ?? (titleCaseSport(id) || "Sport");
}
export function sportEmoji(id: Sport): string {
  return SPORT_META[id]?.emoji ?? "🎽";
}
/** Soccer-family sports get the extra soccer-only form sections + API auto-fill. */
export function isSoccerSport(id: Sport): boolean {
  return id === "soccer" || id === "college-soccer";
}
/** Normalize free-text sport input into an id: "College Baseball" -> "college-baseball". */
export function slugifySport(input: string): Sport {
  return input.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
