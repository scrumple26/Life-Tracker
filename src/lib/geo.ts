import type { LatLng } from "./types";

// Geocode a free-text location via OpenStreetMap Nominatim (same service the
// legacy app used). Returns null on any failure — callers treat it as optional.
export async function geocode(query: string): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&limit=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
