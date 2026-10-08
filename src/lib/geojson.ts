"use client";

import { useEffect, useState } from "react";

export interface GeoFeature {
  type: "Feature";
  properties: { name: string };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}
export interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

let statesCache: GeoCollection | null = null;
let countriesCache: GeoCollection | null = null;

export async function loadStates(): Promise<GeoCollection> {
  if (!statesCache) statesCache = await fetch("/geo/us-states.geojson").then((r) => r.json());
  return statesCache!;
}
export async function loadCountries(): Promise<GeoCollection> {
  if (!countriesCache)
    countriesCache = await fetch("/geo/countries.geojson").then((r) => r.json());
  return countriesCache!;
}

// React hook: load a geojson collection once (lazily, when `enabled`).
export function useGeo(
  loader: () => Promise<GeoCollection>,
  enabled: boolean
): GeoCollection | null {
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  useEffect(() => {
    let live = true;
    if (enabled && !geo) loader().then((g) => live && setGeo(g));
    return () => {
      live = false;
    };
  }, [enabled, geo, loader]);
  return geo;
}

// ── Point-in-polygon (ray casting) ───────────────────────────
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function pointInPolygon(x: number, y: number, poly: number[][][]): boolean {
  if (!poly.length || !pointInRing(x, y, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (pointInRing(x, y, poly[i])) return false; // hole
  return true;
}
export function pointInFeature(lat: number, lng: number, f: GeoFeature): boolean {
  const g = f.geometry;
  if (g.type === "Polygon") return pointInPolygon(lng, lat, g.coordinates);
  return g.coordinates.some((poly) => pointInPolygon(lng, lat, poly));
}

// Which feature (state / country) contains this point?
export function featureForPoint(
  lat: number,
  lng: number,
  geo: GeoCollection
): string | null {
  for (const f of geo.features) if (pointInFeature(lat, lng, f)) return f.properties.name;
  return null;
}

// Closest feature by outline vertex, within `maxKm`. For pins just outside
// every polygon — bridges over water, islands, coastal spots the simplified
// outlines miss (the Golden Gate Bridge sits outside California's shape).
export function nearestFeature(
  lat: number,
  lng: number,
  geo: GeoCollection,
  maxKm = 30
): string | null {
  const kx = 111 * Math.cos((lat * Math.PI) / 180); // km per degree of longitude here
  let best: string | null = null;
  let bestD2 = maxKm * maxKm;
  for (const f of geo.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys)
      for (const [x, y] of poly[0]) {
        const d2 = ((x - lng) * kx) ** 2 + ((y - lat) * 111) ** 2;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = f.properties.name;
        }
      }
  }
  return best;
}

// ── Country name normalisation -> names used in countries.geojson ──
const COUNTRY_NORM: Record<string, string> = {
  "united states": "usa",
  "united states of america": "usa",
  us: "usa",
  "u.s.": "usa",
  "u.s.a.": "usa",
  america: "usa",
  uk: "england",
  "united kingdom": "england",
  "great britain": "england",
  britain: "england",
  scotland: "england",
  wales: "england",
  "northern ireland": "england",
  "russian federation": "russia",
  "republic of korea": "south korea",
  "korea, south": "south korea",
  "korea republic": "south korea",
  "korea, north": "north korea",
  "korea dpr": "north korea",
  dprk: "north korea",
  czechia: "czech republic",
  "côte d'ivoire": "ivory coast",
  "cote d'ivoire": "ivory coast",
  "republic of ireland": "ireland",
  // API-Football / FIFA spellings the outlines name differently.
  "türkiye": "turkey",
  turkiye: "turkey",
  "guinea-bissau": "guinea bissau",
  bahamas: "the bahamas",
  eswatini: "swaziland",
  "timor-leste": "east timor",
  congo: "republic of the congo",
  "congo dr": "democratic republic of the congo",
  "dr congo": "democratic republic of the congo",
  "kyrgyz republic": "kyrgyzstan",
  "brunei darussalam": "brunei",
  "lao pdr": "laos",
  "syrian arab republic": "syria",
  "ir iran": "iran",
  "chinese taipei": "taiwan",
  "china pr": "china",
  "bosnia": "bosnia and herzegovina",
  "bosnia & herzegovina": "bosnia and herzegovina",
  "trinidad & tobago": "trinidad and tobago",
  "czech rep.": "czech republic",
  eire: "ireland",
  uae: "united arab emirates",
  tanzania: "united republic of tanzania",
  "viet nam": "vietnam",
  // Serbia: the geojson feature is named "Republic of Serbia"; player data says "Serbia".
  "republic of serbia": "serbia",
  // North Macedonia: the geojson feature predates the rename and is just "Macedonia".
  "north macedonia": "macedonia",
  "fyr macedonia": "macedonia",
  "macedonia (fyrom)": "macedonia",
};

export function normCountry(name: string | undefined): string {
  const lower = (name ?? "").toLowerCase().trim();
  return COUNTRY_NORM[lower] || lower;
}

// If the point falls inside a US state, rewrite "City, USA" -> "City, State, USA".
export function withUsState(
  birthplace: string | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
  states: GeoCollection | null,
  approx = false
): string {
  if (!birthplace) return "";
  // Country-level (approx) coords don't pin a real city, so don't claim a state.
  if (approx || !states || lat == null || lng == null) return birthplace;
  const st = featureForPoint(lat, lng, states);
  if (!st) return birthplace;
  const city = birthplace.split(",")[0].trim();
  return `${city}, ${st}, USA`;
}
