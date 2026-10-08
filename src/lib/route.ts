import type { LatLng } from "./types";

// ── Google encoded polyline (precision 5) ────────────────────────────────
// Same format OSRM returns, so snapped segments drop straight in.

export function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < str.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let s = "";
  while (n >= 0x20) {
    s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return s + String.fromCharCode(n + 63);
}

export function encodePolyline(points: LatLng[]): string {
  let s = "";
  let pLat = 0;
  let pLng = 0;
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    s += encodeValue(lat - pLat) + encodeValue(lng - pLng);
    pLat = lat;
    pLng = lng;
  }
  return s;
}

// ── Distance ─────────────────────────────────────────────────────────────

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathKm(points: LatLng[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += distanceKm(points[i - 1], points[i]);
  return km;
}

export function fmtMiles(km: number): string {
  const mi = km * 0.621371;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

/** Drop points closer than `minMeters` to the last kept one (GPX tracks are dense). */
export function thinPath(points: LatLng[], minMeters = 8): LatLng[] {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (distanceKm(out[out.length - 1], points[i]) * 1000 >= minMeters) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

// ── Snap-to-path routing ─────────────────────────────────────────────────
// FOSSGIS's public OSRM servers (routing.openstreetmap.de) have foot and bike
// profiles, which follow trails and paths — not just car roads.

export type RouteProfile = "foot" | "bike";

export async function snapSegment(
  from: LatLng,
  to: LatLng,
  profile: RouteProfile
): Promise<LatLng[] | null> {
  const svc = profile === "bike" ? "routed-bike/route/v1/bike" : "routed-foot/route/v1/foot";
  try {
    const res = await fetch(
      `https://routing.openstreetmap.de/${svc}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=polyline`
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { code: string; routes?: { geometry: string }[] };
    const geom = body.code === "Ok" ? body.routes?.[0]?.geometry : undefined;
    return geom ? decodePolyline(geom) : null;
  } catch {
    return null;
  }
}

// ── GPX import ───────────────────────────────────────────────────────────

/** Track points (or route points) from a GPX file, thinned for storage. */
export function parseGpx(xml: string): LatLng[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  let nodes = Array.from(doc.getElementsByTagName("trkpt"));
  if (!nodes.length) nodes = Array.from(doc.getElementsByTagName("rtept"));
  const pts = nodes
    .map((n) => ({ lat: Number(n.getAttribute("lat")), lng: Number(n.getAttribute("lon")) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  return thinPath(pts);
}
