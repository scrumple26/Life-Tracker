// Slim shapes returned by our /api/football/* routes to the client.
// (Kept separate from football.ts so client components can import the
// types without pulling in any server-only code.)
import type { LineupEntry, Scorer } from "./types";

export interface FixtureSummary {
  id: number;
  date: string; // ISO kickoff
  league: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // short status code, e.g. FT
  finished: boolean;
  venue: string;
  city: string;
}

export interface FixtureDetails {
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  scorers: Scorer[];
}
