// Server-side proxy for OpenStreetMap Nominatim.
//
// Calling Nominatim straight from the browser is fragile: its usage policy
// requires an identifying User-Agent, some browsers/extensions strip the
// Referer, and bursts get throttled. Going through here sends a proper
// User-Agent, lets Vercel's CDN cache repeat lookups, and keeps one place to
// tune the ranking.
//
//   GET /api/geocode?q=<text>            → { result: { lat, lng, label } | null }
//   GET /api/geocode?q=<text>&limit=5    → { results: [{ lat, lng, label }] }

const USER_AGENT = "lifelong-tracker/1.0 (https://github.com/scrumple26/Life-Tracker)";

// Prefer real populated places over administrative regions, so an ambiguous
// city name resolves to the town — not a same-named county/state. E.g.
// "Woodbury, USA" → Woodbury, MN (a town) instead of Woodbury County, Iowa.
const PLACE_RANK: Record<string, number> = {
  city: 6,
  town: 5,
  municipality: 5,
  village: 4,
  hamlet: 3,
  suburb: 2,
  county: 1,
  state: 0,
};

interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
  addresstype?: string;
  type?: string;
  importance?: number;
}

function rank(r: NominatimResult): number {
  const t = r.addresstype ?? r.type ?? "";
  return PLACE_RANK[t] ?? 1.5; // unknown types (stadiums, parks…) sit just above county/state
}

function toHit(r: NominatimResult) {
  return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: r.display_name ?? "" };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 1, 1), 8);
  const many = searchParams.has("limit");

  if (!q) return Response.json(many ? { results: [] } : { result: null });

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&limit=${Math.max(limit, 5)}&addressdetails=0`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } }
    );
    if (!res.ok) {
      return Response.json({ error: `Geocoder returned ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as NominatimResult[];
    const list = Array.isArray(data) ? data : [];

    const body = many
      ? { results: list.slice(0, limit).map(toHit) }
      : {
          // Pick the best populated place; keep Nominatim's importance as tiebreak.
          result: list.length
            ? toHit(
                [...list].sort(
                  (a, b) => rank(b) - rank(a) || (b.importance ?? 0) - (a.importance ?? 0)
                )[0]
              )
            : null,
        };

    return Response.json(body, {
      // Places don't move — let the CDN reuse lookups for a week.
      headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" },
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
