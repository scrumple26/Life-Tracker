import type { LatLng } from "./types";

export interface GeoHit extends LatLng {
  label: string;
  city: string;
  state: string;
  country: string;
}

// Geocode a free-text location (via our /api/geocode Nominatim proxy).
// Returns null on any failure — callers treat it as optional.
export async function geocode(query: string): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const { result } = (await res.json()) as { result: GeoHit | null };
    return result ? { lat: result.lat, lng: result.lng } : null;
  } catch {
    return null;
  }
}

// Try each query in turn until one locates. "Allianz Field, 400 Snelling Ave,
// St Paul" often misses as a whole but hits as the address or the venue alone.
export async function geocodeFirst(queries: string[]): Promise<LatLng | null> {
  const seen = new Set<string>();
  for (const raw of queries) {
    const q = raw.trim();
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    const hit = await geocode(q);
    if (hit) return hit;
  }
  return null;
}

// Several candidate matches for a search box, so the user can pick the right one.
export async function searchPlaces(query: string, limit = 5): Promise<GeoHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=${limit}&v=2`);
    if (!res.ok) return [];
    const { results } = (await res.json()) as { results: GeoHit[] };
    return Array.isArray(results) ? results : [];
  } catch {
    return [];
  }
}

/** Candidate queries for a venue, most specific first. */
export function venueQueries(name: string, address: string): string[] {
  const n = name.trim();
  const a = address.trim();
  // Drop leading address parts one at a time: "400 Snelling Ave, St Paul, MN"
  // → "St Paul, MN" → "MN" is too coarse, so stop at two parts.
  const parts = a.split(",").map((s) => s.trim()).filter(Boolean);
  const tails: string[] = [];
  for (let i = 1; i < parts.length - 1; i++) tails.push(parts.slice(i).join(", "));
  return [
    [n, a].filter(Boolean).join(", "),
    ...(n ? tails.map((t) => `${n}, ${t}`) : []),
    a,
    ...tails,
    n,
  ];
}
