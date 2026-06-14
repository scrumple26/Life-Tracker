// Server-only API-Football (RapidAPI) client. The key lives in
// process.env.FOOTBALL_API_KEY and never reaches the browser — clients call
// our /api/football/* route handlers instead.
import "server-only";
import type { LineupEntry, Scorer } from "./types";
import type { FixtureDetails, FixtureSummary } from "./football-types";

// Direct API-Sports access (dashboard.api-football.com).
const BASE = "https://v3.football.api-sports.io";

// Leagues sorted to the top of results (EPL, La Liga, Bundesliga, Serie A,
// Ligue 1, UCL, UEL, MLS, World Cup, Euros, Champ, FA Cup, Copa Lib).
const PRIORITY_LEAGUES = new Set([39, 140, 78, 135, 61, 2, 3, 253, 1, 4, 45, 48, 848]);
const FINISHED = new Set(["FT", "AET", "PEN"]);

export class FootballError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ── Minimal typings for the parts of the response we read ──
interface ApiTeam {
  id: number;
  name: string;
}
interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
    venue: { name: string | null; city: string | null };
  };
  league: { id: number; name: string; country: string };
  teams: { home: ApiTeam; away: ApiTeam };
  goals: { home: number | null; away: number | null };
}
interface ApiPlayer {
  player: { id: number; name: string; pos: string | null };
}
interface ApiLineup {
  team: { id: number };
  startXI?: ApiPlayer[];
  substitutes?: ApiPlayer[];
}
interface ApiEvent {
  type: string;
  detail: string;
  team: { id: number };
  player: { id: number | null; name: string | null };
  assist?: { id: number | null; name: string | null };
  time: { elapsed: number | null };
}

async function footballFetch<T>(path: string): Promise<T[]> {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) {
    throw new FootballError(
      "No football API key configured. Set FOOTBALL_API_KEY in the environment.",
      503
    );
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "x-apisports-key": key },
    });
  } catch {
    throw new FootballError("Could not reach the football API.", 502);
  }
  if (!res.ok) {
    throw new FootballError(`Football API error (${res.status}).`, 502);
  }
  const data = (await res.json()) as { response?: T[]; errors?: unknown };
  // API-Sports returns 200 with a populated `errors` object on bad key /
  // rate limit / plan issues.
  const errs = data.errors;
  const errMsgs = Array.isArray(errs)
    ? (errs as unknown[]).map(String)
    : errs && typeof errs === "object"
      ? Object.values(errs as Record<string, string>)
      : [];
  if (errMsgs.length > 0) {
    throw new FootballError(`Football API: ${errMsgs.join("; ")}`, 502);
  }
  return data.response ?? [];
}

function toSummary(f: ApiFixture): FixtureSummary {
  return {
    id: f.fixture.id,
    date: f.fixture.date,
    league: f.league.name,
    country: f.league.country,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    status: f.fixture.status.short,
    finished: FINISHED.has(f.fixture.status.short),
    venue: f.fixture.venue.name ?? "",
    city: f.fixture.venue.city ?? "",
  };
}

export async function getFixturesByDate(
  date: string,
  team?: string,
  competition?: string,
  timezone?: string
): Promise<FixtureSummary[]> {
  // Pass the caller's timezone so `date` is the LOCAL calendar date. Without it
  // API-Football filters by UTC, which drops late local kickoffs onto the next
  // day (e.g. West-coast MLS games show under the following UTC date).
  const tzParam = timezone ? `&timezone=${encodeURIComponent(timezone)}` : "";
  const fixtures = await footballFetch<ApiFixture>(
    `/fixtures?date=${encodeURIComponent(date)}${tzParam}`
  );
  // Finished matches first, then prioritise the big leagues.
  const rank = (f: ApiFixture) =>
    (FINISHED.has(f.fixture.status.short) ? 0 : 2) +
    (PRIORITY_LEAGUES.has(f.league.id) ? 0 : 1);
  let list = [...fixtures].sort((a, b) => rank(a) - rank(b)).map(toSummary);
  if (team) {
    const q = team.toLowerCase();
    list = list.filter(
      (f) =>
        f.homeTeam.toLowerCase().includes(q) || f.awayTeam.toLowerCase().includes(q)
    );
  }
  if (competition) {
    const q = competition.toLowerCase();
    list = list.filter(
      (f) =>
        f.league.toLowerCase().includes(q) || f.country.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getFixtureDetails(
  fixtureId: number,
  homeTeamId: number
): Promise<FixtureDetails> {
  const [lineups, events] = await Promise.all([
    footballFetch<ApiLineup>(`/fixtures/lineups?fixture=${fixtureId}`),
    footballFetch<ApiEvent>(`/fixtures/events?fixture=${fixtureId}`),
  ]);

  const homeLineup: LineupEntry[] = [];
  const awayLineup: LineupEntry[] = [];
  const homeStart = new Set<number>();
  const awayStart = new Set<number>();

  for (const tl of lineups) {
    const isHome = tl.team.id === homeTeamId;
    const arr = isHome ? homeLineup : awayLineup;
    const startSet = isHome ? homeStart : awayStart;
    for (const p of tl.startXI ?? []) {
      arr.push({ name: p.player.name, pos: p.player.pos ?? undefined, playerId: p.player.id });
      startSet.add(p.player.id);
    }
  }

  // Add only players who actually came on (from substitution events) — anyone
  // in a "subst" event who wasn't in the starting XI. Unused bench is ignored.
  const seen = new Set<number>([...homeStart, ...awayStart]);
  for (const ev of events) {
    if (ev.type !== "subst") continue;
    const isHome = ev.team.id === homeTeamId;
    const arr = isHome ? homeLineup : awayLineup;
    const startSet = isHome ? homeStart : awayStart;
    for (const cand of [ev.player, ev.assist]) {
      if (!cand?.id || !cand.name) continue;
      if (startSet.has(cand.id) || seen.has(cand.id)) continue; // starter or already added
      seen.add(cand.id);
      arr.push({ name: cand.name, sub: true, playerId: cand.id });
    }
  }

  const scorers: Scorer[] = [];
  for (const ev of events) {
    if (ev.type !== "Goal" || ev.detail === "Missed Penalty") continue;
    if (!ev.player?.name) continue;
    const isOwnGoal = ev.detail === "Own Goal";
    const isHome = ev.team.id === homeTeamId;
    // Own goals are credited to the opposing side.
    const team: "home" | "away" = isOwnGoal
      ? isHome
        ? "away"
        : "home"
      : isHome
        ? "home"
        : "away";
    scorers.push({
      name: ev.player.name,
      team,
      minute: ev.time.elapsed != null ? String(ev.time.elapsed) : undefined,
      playerId: ev.player.id ?? undefined,
    });
  }

  return { homeLineup, awayLineup, scorers };
}

interface ApiProfile {
  player: {
    id: number;
    name: string;
    nationality: string | null;
    birth: { date: string | null; place: string | null; country: string | null };
  };
}

export interface PlayerBirth {
  id: number;
  name: string;
  birthplace: string; // "place, country" (may be empty)
  country: string;
  nationality: string;
  dob: string;
}

interface ApiTeamSearch {
  team: { id: number; name: string; country: string | null; logo: string | null };
}

export interface TeamSuggestion {
  id: number;
  name: string;
  country: string;
  logo: string;
}

export async function searchTeams(query: string): Promise<TeamSuggestion[]> {
  const res = await footballFetch<ApiTeamSearch>(
    `/teams?search=${encodeURIComponent(query)}`
  );
  return res.map((r) => ({
    id: r.team.id,
    name: r.team.name,
    country: r.team.country ?? "",
    logo: r.team.logo ?? "",
  }));
}

function toBirth(p: ApiProfile["player"]): PlayerBirth {
  const place = p.birth?.place ?? "";
  const country = p.birth?.country ?? "";
  return {
    id: p.id,
    name: p.name,
    birthplace: [place, country].filter(Boolean).join(", "),
    country,
    nationality: p.nationality ?? "",
    dob: p.birth?.date ?? "",
  };
}

export async function getPlayerBirth(id: number): Promise<PlayerBirth | null> {
  const res = await footballFetch<ApiProfile>(`/players/profiles?player=${id}`);
  const p = res[0]?.player;
  return p ? toBirth(p) : null;
}

// Lowercase, fold accents, drop dots, collapse whitespace.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Resolve a free-text player name (manual / legacy entries) to birth details.
// API-Football's profiles search matches on last name and returns names as
// "F. Lastname", so we search the last token then rank by first-name match.
export async function searchPlayerBirth(name: string): Promise<PlayerBirth | null> {
  const cleaned = norm(name);
  if (!cleaned) return null;
  const parts = cleaned.split(" ");
  const last = parts[parts.length - 1];
  const first = parts.length > 1 ? parts[0] : "";
  const term = last.length >= 3 ? last : cleaned;
  if (term.length < 3) return null;

  const res = await footballFetch<ApiProfile>(
    `/players/profiles?search=${encodeURIComponent(term)}`
  );
  if (!res.length) return null;

  // Prefer players whose last name actually matches.
  const byLast = res.filter((r) => {
    const t = norm(r.player.name).split(" ");
    return t[t.length - 1] === last;
  });
  const pool = byLast.length ? byLast : res;

  // Rank by first-name / first-initial match when we have a first name.
  let best = pool[0];
  if (first) {
    let bestScore = -1;
    for (const r of pool) {
      const apiFirst = norm(r.player.name).split(" ")[0] ?? "";
      const score =
        apiFirst === first ? 2 : apiFirst[0] && apiFirst[0] === first[0] ? 1 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
  }
  return toBirth(best.player);
}
