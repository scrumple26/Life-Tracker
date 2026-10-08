"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/data";
import { geocodeFirst, venueQueries } from "@/lib/geo";
import { type Sport } from "@/lib/types";
import { MapPanel, type MapMarker } from "../Map";
import { EventCard } from "../EventCard";

export function StadiumsTab({ sport }: { sport?: Sport }) {
  const { data, saveEvents } = useApp();
  const [year, setYear] = useState<string>("");
  const [locating, setLocating] = useState<{ text: string; busy: boolean } | null>(null);
  const latest = useRef(data.events);
  useEffect(() => {
    latest.current = data.events;
  }, [data.events]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const e of data.events) if (e.date) set.add(e.date.slice(0, 4));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [data.events]);

  const filtered = useMemo(
    () =>
      data.events.filter(
        (e) =>
          (!sport || e.sport === sport) &&
          (!year || (e.date && e.date.startsWith(year)))
      ),
    [data.events, sport, year]
  );

  const markers = useMemo<MapMarker[]>(() => {
    const byCoord = new Map<string, MapMarker>();
    for (const e of filtered) {
      if (e.lat == null || e.lng == null) continue;
      const key = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
      if (!byCoord.has(key)) {
        byCoord.set(key, {
          id: key,
          lat: e.lat,
          lng: e.lng,
          title: e.stadium || "Venue",
          lines: [],
        });
      }
      byCoord
        .get(key)!
        .lines!.push(
          `${e.homeTeam || "?"} ${e.homeScore ?? "–"}–${e.awayScore ?? "–"} ${
            e.awayTeam || "?"
          }${e.date ? ` · ${e.date}` : ""}`
        );
    }
    return Array.from(byCoord.values());
  }, [filtered]);

  const venueCount = markers.length;

  // Events with a venue but no pin (logged before the geocoder fix, or the
  // lookup failed at the time).
  const unlocated = useMemo(
    () => filtered.filter((e) => e.lat == null && (e.stadium.trim() || e.address.trim())),
    [filtered]
  );

  async function locateMissing() {
    const found = new Map<string, { lat: number; lng: number }>();
    const byVenue = new Map<string, { lat: number; lng: number } | null>();
    for (let i = 0; i < unlocated.length; i++) {
      const e = unlocated[i];
      setLocating({ text: `Locating ${i + 1} of ${unlocated.length}…`, busy: true });
      const key = `${e.stadium}|${e.address}`.toLowerCase();
      let coords = byVenue.get(key);
      if (coords === undefined) {
        coords = await geocodeFirst(venueQueries(e.stadium, e.address));
        byVenue.set(key, coords);
        await new Promise((r) => setTimeout(r, 1100)); // Nominatim: ~1 req/sec
      }
      if (coords) found.set(e.id, coords);
    }
    if (found.size) {
      await saveEvents(
        latest.current.map((e) => (found.has(e.id) ? { ...e, ...found.get(e.id)! } : e))
      );
    }
    setLocating({
      text: `Placed ${found.size} of ${unlocated.length}.${
        found.size < unlocated.length ? " Edit the rest to add a city or address." : ""
      }`,
      busy: false,
    });
  }
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [filtered]
  );

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2">My stadiums</h2>
      <p className="text-ink-soft mb-6 text-[15px]">
        Every venue you&apos;ve visited. Tap a pin to see the games played there.
      </p>

      <div className="mb-5 max-w-xs">
        <label className="field-label">Filter by year</label>
        <select className="field" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="card p-3 sm:p-4 mb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap px-1 pb-2">
          <span className="overline">Stadium map</span>
          <div className="flex items-center gap-3">
            {locating && <span className="text-xs text-muted">{locating.text}</span>}
            {unlocated.length > 0 && !locating?.busy && (
              <button className="btn btn-ghost btn-sm" onClick={locateMissing}>
                Locate {unlocated.length} missing
              </button>
            )}
            <span className="text-xs text-muted">
              {venueCount} venue{venueCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {markers.length > 0 ? (
          <MapPanel markers={markers} />
        ) : (
          <div className="h-[300px] rounded-2xl bg-paper-2 flex flex-col items-center justify-center text-center px-6">
            <div className="text-3xl mb-2">🗺️</div>
            <p className="text-ink font-semibold">No mapped venues yet</p>
            <p className="text-sm text-muted mt-1 max-w-sm">
              Log events with a stadium and city — new ones are located
              automatically and will appear here.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-2xl text-ink mb-4">Event history</h3>
        {sorted.length === 0 ? (
          <p className="text-muted text-sm">No events match these filters.</p>
        ) : (
          <div className="grid gap-3">
            {sorted.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
