"use client";

import { useRef, useState } from "react";
import { searchPlaces, type GeoHit } from "@/lib/geo";
import {
  decodePolyline,
  encodePolyline,
  fmtMiles,
  parseGpx,
  pathKm,
  snapSegment,
  type RouteProfile,
} from "@/lib/route";
import type { LatLng } from "@/lib/types";
import { MapPanel } from "./Map";

type Focus = LatLng & { zoom: number };

/** Place search → pick a result. Shared by the pin picker and route editor. */
function PlaceSearch({
  placeholder,
  fallbackQuery,
  onPick,
}: {
  placeholder: string;
  fallbackQuery?: string;
  onPick: (hit: GeoHit) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoHit[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const q = query.trim() || fallbackQuery?.trim() || "";
    if (!q) return;
    setBusy(true);
    setResults(await searchPlaces(q));
    setBusy(false);
  }

  return (
    <div className="mb-2">
      <div className="flex gap-2">
        <input
          className="field flex-1"
          value={query}
          placeholder={fallbackQuery?.trim() ? `Search — e.g. ${fallbackQuery.trim()}` : placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={run} disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      {results && (
        <ul className="mt-2 grid gap-1">
          {results.length === 0 && <li className="text-xs text-muted px-1">No matches — try fewer words.</li>}
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-paper-2 text-ink-soft truncate"
                onClick={() => {
                  onPick(r);
                  setResults(null);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Single-pin location: search for it, or tap the map to drop/move the pin. */
export function LocationPicker({
  value,
  onChange,
  suggestion,
}: {
  value: LatLng | null;
  onChange: (ll: LatLng | null) => void;
  suggestion?: string; // e.g. "<name>, <city>" — used when the search box is empty
}) {
  const [focus, setFocus] = useState<Focus | null>(null);
  return (
    <div>
      <PlaceSearch
        placeholder="Search for the place"
        fallbackQuery={suggestion}
        onPick={(hit) => {
          onChange({ lat: hit.lat, lng: hit.lng });
          setFocus({ lat: hit.lat, lng: hit.lng, zoom: 15 });
        }}
      />
      <MapPanel
        className="h-[260px]"
        markers={value ? [{ id: "pin", lat: value.lat, lng: value.lng, title: "Here", count: 1 }] : []}
        autoFit={false}
        initialCenter={value ? { ...value, zoom: 14 } : undefined}
        focus={focus}
        onMapClick={onChange}
      />
      <div className="flex items-center justify-between mt-1.5 text-xs text-muted">
        <span>{value ? "Tap the map to move the pin." : "Tap the map to drop a pin."}</span>
        {value && (
          <button type="button" className="hover:text-clay" onClick={() => onChange(null)}>
            Remove pin
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Trace a walked/biked/hiked route: tap points along the way. With "Follow
 * paths" on, each tap is routed along real roads and trails from the last
 * point; off, it draws a straight line (for off-network bits). GPX files from
 * a watch or Strava can be imported instead.
 */
export function RouteEditor({
  route,
  onChange,
  profile,
  anchor,
  suggestion,
}: {
  route: string;
  onChange: (route: string) => void;
  profile: RouteProfile;
  anchor?: LatLng | null; // where to centre an empty map (the place's pin)
  suggestion?: string;
}) {
  // Each tap appends one segment, so Undo removes exactly what the last tap added.
  const [segments, setSegments] = useState<LatLng[][]>(() => {
    const pts = route ? decodePolyline(route) : [];
    return pts.length ? [pts] : [];
  });
  const segRef = useRef(segments);
  const [snap, setSnap] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const points = segments.flat();
  const start = points[0] ?? anchor ?? null;

  function commit(next: LatLng[][]) {
    segRef.current = next;
    setSegments(next);
    onChange(encodePolyline(next.flat()));
  }

  async function addPoint(ll: LatLng) {
    if (busy) return;
    setNote("");
    const flat = segRef.current.flat();
    if (!flat.length) {
      commit([[ll]]);
      return;
    }
    let seg: LatLng[] = [ll];
    if (snap) {
      setBusy(true);
      const routed = await snapSegment(flat[flat.length - 1], ll, profile);
      setBusy(false);
      if (routed && routed.length > 1) seg = routed.slice(1);
      else setNote("Couldn't find a path there — drew a straight line.");
    }
    commit([...segRef.current, seg]);
  }

  async function importGpx(file: File) {
    const pts = parseGpx(await file.text());
    if (pts.length < 2) {
      setNote("No track points found in that file.");
      return;
    }
    commit([pts]);
    setFocus({ ...pts[0], zoom: 13 });
    setNote(`Imported ${pts.length} points.`);
  }

  return (
    <div>
      <PlaceSearch
        placeholder="Jump to an area"
        fallbackQuery={suggestion}
        onPick={(hit) => setFocus({ lat: hit.lat, lng: hit.lng, zoom: 15 })}
      />
      <MapPanel
        className="h-[340px]"
        markers={points.length ? [{ id: "start", ...points[0], title: "Start", count: 1 }] : []}
        paths={points.length > 1 ? [{ id: "route", points }] : []}
        autoFit={false}
        initialCenter={start ? { ...start, zoom: points.length ? 14 : 13 } : undefined}
        focus={focus}
        onMapClick={addPoint}
      />
      <div className="flex items-center gap-2 flex-wrap mt-2">
        <label className="inline-flex items-center gap-1.5 text-sm text-ink-soft mr-1">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          Follow roads &amp; trails
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!segments.length || busy}
          onClick={() => commit(segRef.current.slice(0, -1))}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!segments.length || busy}
          onClick={() => commit([])}
        >
          Clear
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          Import GPX
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importGpx(f);
            e.target.value = "";
          }}
        />
        <span className="ml-auto text-sm font-semibold text-ink">
          {points.length > 1 ? fmtMiles(pathKm(points)) : ""}
        </span>
      </div>
      <p className="text-xs text-muted mt-1.5">
        {busy
          ? "Finding the path…"
          : note ||
            (points.length
              ? "Tap the next spot you reached — the line follows the path between taps."
              : "Tap where you started, then each spot along the way.")}
      </p>
    </div>
  );
}
