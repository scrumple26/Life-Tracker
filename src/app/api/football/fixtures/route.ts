import { FootballError, getFixturesByDate } from "@/lib/football";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const team = searchParams.get("team")?.trim() || undefined;
  const competition = searchParams.get("competition")?.trim() || undefined;
  // Accept IANA tz names only (e.g. America/New_York); ignore anything else.
  const tzRaw = searchParams.get("tz")?.trim();
  const timezone = tzRaw && /^[A-Za-z0-9_+\-/]+$/.test(tzRaw) ? tzRaw : undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { error: "A valid date (YYYY-MM-DD) is required." },
      { status: 400 }
    );
  }

  try {
    const fixtures = await getFixturesByDate(date, team, competition, timezone);
    return Response.json({ fixtures });
  } catch (err) {
    const status = err instanceof FootballError ? err.status : 500;
    return Response.json({ error: (err as Error).message }, { status });
  }
}
