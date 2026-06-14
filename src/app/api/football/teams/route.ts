import { FootballError, searchTeams } from "@/lib/football";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  // API-Football requires at least 3 characters for team search.
  if (!search || search.length < 3) {
    return Response.json({ teams: [] });
  }

  try {
    const teams = await searchTeams(search);
    return Response.json({ teams });
  } catch (err) {
    const status = err instanceof FootballError ? err.status : 500;
    return Response.json({ error: (err as Error).message }, { status });
  }
}
