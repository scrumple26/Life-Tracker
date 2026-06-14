"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import type { SportEvent } from "@/lib/types";
import { MapPanel, type MapMarker } from "../Map";

interface TeamAgg {
  name: string;
  games: SportEvent[];
  lat: number | null;
  lng: number | null;
}

export function TeamsTab() {
  const { data } = useApp();
  const [view, setView] = useState<"list" | "map">("list");

  const teams = useMemo<TeamAgg[]>(() => {
    const byTeam = new Map<string, TeamAgg>();
    const add = (name: string, e: SportEvent) => {
      const key = name.trim();
      if (!key) return;
      if (!byTeam.has(key))
        byTeam.set(key, { name: key, games: [], lat: null, lng: null });
      const t = byTeam.get(key)!;
      t.games.push(e);
      if (t.lat == null && e.lat != null && e.lng != null) {
        t.lat = e.lat;
        t.lng = e.lng;
      }
    };
    for (const e of data.events) {
      add(e.homeTeam, e);
      add(e.awayTeam, e);
    }
    return Array.from(byTeam.values()).sort(
      (a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name)
    );
  }, [data.events]);

  const markers = useMemo<MapMarker[]>(
    () =>
      teams
        .filter((t) => t.lat != null && t.lng != null)
        .map((t) => ({
          id: t.name,
          lat: t.lat!,
          lng: t.lng!,
          title: t.name,
          lines: [`${t.games.length} game${t.games.length === 1 ? "" : "s"} seen`],
        })),
    [teams]
  );

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2">Teams</h2>
      <p className="text-ink-soft mb-5 text-[15px]">
        Every team you&apos;ve watched play.
      </p>

      <div className="inline-flex p-1 rounded-full bg-paper-2 mb-5">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition ${
              view === v
                ? "bg-card text-ink shadow-[var(--shadow-soft)]"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {teams.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🛡️</div>
          <p className="text-ink font-semibold">No teams yet</p>
          <p className="text-sm text-muted mt-1">Log some events to get started.</p>
        </div>
      ) : view === "list" ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {teams.map((t) => (
            <div key={t.name} className="card p-4 flex items-center justify-between gap-3">
              <span className="font-medium text-ink">{t.name}</span>
              <span className="chip">
                {t.games.length} game{t.games.length === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      ) : markers.length > 0 ? (
        <div className="card p-3 sm:p-4">
          <MapPanel markers={markers} />
        </div>
      ) : (
        <div className="card p-10 text-center">
          <div className="text-3xl mb-2">🗺️</div>
          <p className="text-ink font-semibold">No team locations yet</p>
          <p className="text-sm text-muted mt-1">
            Locations appear automatically once events are geocoded.
          </p>
        </div>
      )}
    </section>
  );
}
