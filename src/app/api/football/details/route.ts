import { FootballError, getFixtureDetails } from "@/lib/football";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fixture = Number(searchParams.get("fixture"));
  const home = Number(searchParams.get("home"));

  if (!Number.isFinite(fixture) || fixture <= 0 || !Number.isFinite(home)) {
    return Response.json(
      { error: "Valid `fixture` and `home` (team id) params are required." },
      { status: 400 }
    );
  }

  try {
    const details = await getFixtureDetails(fixture, home);
    return Response.json(details);
  } catch (err) {
    const status = err instanceof FootballError ? err.status : 500;
    return Response.json({ error: (err as Error).message }, { status });
  }
}
