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
  player: { name: string; pos: string | null };
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
  player: { name: string };
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
  team?: string
): Promise<FixtureSummary[]> {
  const fixtures = await footballFetch<ApiFixture>(
    `/fixtures?date=${encodeURIComponent(date)}`
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
  for (const tl of lineups) {
    const arr = tl.team.id === homeTeamId ? homeLineup : awayLineup;
    for (const p of tl.startXI ?? []) {
      arr.push({ name: p.player.name, pos: p.player.pos ?? undefined });
    }
    for (const p of tl.substitutes ?? []) {
      arr.push({ name: p.player.name, pos: p.player.pos ?? undefined, sub: true });
    }
  }

  const scorers: Scorer[] = [];
  for (const ev of events) {
    if (ev.type !== "Goal" || ev.detail === "Missed Penalty") continue;
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
    });
  }

  return { homeLineup, awayLineup, scorers };
}
