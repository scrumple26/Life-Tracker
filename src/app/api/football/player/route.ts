import { FootballError, getPlayerBirth } from "@/lib/football";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: "A valid player `id` is required." }, { status: 400 });
  }

  try {
    const player = await getPlayerBirth(id);
    if (!player) return Response.json({ error: "Player not found." }, { status: 404 });
    return Response.json(player);
  } catch (err) {
    const status = err instanceof FootballError ? err.status : 500;
    return Response.json({ error: (err as Error).message }, { status });
  }
}
