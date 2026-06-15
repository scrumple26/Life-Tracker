import type { LatLng } from "./types";

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
  addresstype?: string;
  type?: string;
  importance?: number;
}

function rank(r: NominatimResult): number {
  const t = r.addresstype ?? r.type ?? "";
  return PLACE_RANK[t] ?? 1.5; // unknown types sit just above county/state
}

// Geocode a free-text location via OpenStreetMap Nominatim. Returns null on any
// failure — callers treat it as optional.
export async function geocode(query: string): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&limit=5&addressdetails=0`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult[];
    if (!Array.isArray(data) || !data.length) return null;
    // Pick the best populated place; keep Nominatim's importance as tiebreak.
    const best = [...data].sort(
      (a, b) => rank(b) - rank(a) || (b.importance ?? 0) - (a.importance ?? 0)
    )[0];
    return { lat: parseFloat(best.lat), lng: parseFloat(best.lon) };
  } catch {
    return null;
  }
}
