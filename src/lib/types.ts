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
// Tagging a stop (landmark, park, course/trail) creates a linked Place, so it
// also shows up in that Explore tab.
export interface TripLocation {
  id: string;
  name: string; // e.g. "Kyoto" or "Fushimi Inari Shrine"
  notes: string; // details revealed when the location is expanded
  placeId?: string; // -> Place.id when the stop is tagged
}

// ── Explore: courses & trails, landmarks, parks ─────────────────────────
// One record can carry several tags and appears in every matching tab —
// e.g. a state-park hiking trail tagged both "park" and "course".
export type PlaceTag = "course" | "landmark" | "park";

export const PLACE_TAGS: { id: PlaceTag; label: string }[] = [
  { id: "course", label: "Course / Trail" },
  { id: "landmark", label: "Landmark" },
  { id: "park", label: "Park" },
];

// "" = a course/trail whose kind wasn't specified (e.g. tagged from a trip).
export type CourseType = "golf" | "disc-golf" | "hiking" | "walking" | "biking" | "";

export const COURSE_TYPES: { id: Exclude<CourseType, "">; label: string }[] = [
  { id: "golf", label: "Golf" },
  { id: "disc-golf", label: "Disc Golf" },
  { id: "hiking", label: "Hiking" },
  { id: "walking", label: "Walking" },
  { id: "biking", label: "Biking" },
];

/** Course types that are traced as a route on the map rather than a single pin. */
export function isRouteType(t: CourseType): t is "hiking" | "walking" | "biking" {
  return t === "hiking" || t === "walking" || t === "biking";
}

export interface Place {
  id: string;
  name: string;
  tags: PlaceTag[];
  courseType: CourseType; // only meaningful when tags include "course"
  city: string;
  state: string; // state / province / region
  country: string;
  lat: number | null;
  lng: number | null;
  rating: number; // 0–5
  date: string | null; // last visited (YYYY-MM-DD)
  notes: string;
  // Path actually travelled (walking/biking/hiking), Google-encoded polyline
  // (precision 5). Encoded because Firestore can't store nested arrays and the
  // whole user doc must stay under 1 MiB.
  route: string;
  tripId: string; // -> Trip.id when created from a tagged trip stop, else ""
  createdAt: string;
}

// ── Events: movies & other ──────────────────────────────────────────────
export interface Movie {
  id: string;
  title: string;
  date: string | null;
  theater: string;
  city: string;
  rating: number; // 0–5
  notes: string;
  createdAt: string;
}

export interface OtherEvent {
  id: string;
  name: string;
  kind: string; // free text: "Comedy show", "Festival", "Theater"…
  date: string | null;
  venue: string;
  city: string;
  rating: number; // 0–5
  notes: string;
  createdAt: string;
}

// Where a team is from (its home city), set on the Teams tab. Keyed by
// teamKey(name) — the legacy app's format, so its saved locations carry over.
export interface TeamLoc {
  city?: string;
  state?: string;
  country?: string;
  lat: number | null;
  lng: number | null;
}

export function teamKey(name: string): string {
  return name.toLowerCase().trim();
}

// ── Settings ─────────────────────────────────────────────────────────────
export interface Settings {
  hiddenMenu: string[]; // MenuItemId values switched off in Settings
  stadiumsAsLandmarks: boolean; // list venues from logged games under Landmarks
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
  teamLocs: Record<string, TeamLoc>; // keyed by teamKey(name)
  restCategories: RestCategory[];
  restaurants: Restaurant[];
  trips: Trip[];
  concerts: Concert[];
  places: Place[];
  movies: Movie[];
  otherEvents: OtherEvent[];
  settings: Settings;
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
  places: [],
  movies: [],
  otherEvents: [],
  settings: { hiddenMenu: [], stadiumsAsLandmarks: false },
};

interface SportMeta {
  label: string; // full label, e.g. "Soccer / Football"
  short: string; // compact label for chips/cards
}

// Display metadata for the sports we know about (standard + college variants).
// Anything not listed here is a custom sport and falls back to a title-cased
// version of its id.
const SPORT_META: Record<string, SportMeta> = {
  soccer: { label: "Soccer / Football", short: "Soccer" },
  basketball: { label: "Basketball", short: "Basketball" },
  baseball: { label: "Baseball", short: "Baseball" },
  "american-football": { label: "American Football", short: "Football" },
  hockey: { label: "Hockey", short: "Hockey" },
  tennis: { label: "Tennis", short: "Tennis" },
  rugby: { label: "Rugby", short: "Rugby" },
  mma: { label: "MMA / Boxing", short: "MMA" },
  golf: { label: "Golf", short: "Golf" },
  "disc-golf": { label: "Disc Golf", short: "Disc Golf" },
  "college-soccer": { label: "College Soccer", short: "College Soccer" },
  "college-basketball": { label: "College Basketball", short: "College Hoops" },
  "college-baseball": { label: "College Baseball", short: "College Baseball" },
  "college-football": { label: "College Football", short: "College FB" },
  "college-hockey": { label: "College Hockey", short: "College Hockey" },
  other: { label: "Other", short: "Other" },
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
  "golf",
  "disc-golf",
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
/** Soccer-family sports get the extra soccer-only form sections + API auto-fill. */
export function isSoccerSport(id: Sport): boolean {
  return id === "soccer" || id === "college-soccer";
}
/**
 * Golf & disc golf are played on courses, not watched as games: picking one
 * opens a log of courses (Places tagged "course" of that type) instead of the
 * Log Event form.
 */
export function isCourseSport(id: Sport): id is "golf" | "disc-golf" {
  return id === "golf" || id === "disc-golf";
}
/** Normalize free-text sport input into an id: "College Baseball" -> "college-baseball". */
export function slugifySport(input: string): Sport {
  return input.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
