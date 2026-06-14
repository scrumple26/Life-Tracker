import { FootballError, searchPlayerBirth } from "@/lib/football";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();

  if (!name || name.length < 2) {
    return Response.json({ error: "A player `name` is required." }, { status: 400 });
  }

  try {
    const player = await searchPlayerBirth(name);
    if (!player) return Response.json({ error: "No match found." }, { status: 404 });
    return Response.json(player);
  } catch (err) {
    const status = err instanceof FootballError ? err.status : 500;
    return Response.json({ error: (err as Error).message }, { status });
  }
}
