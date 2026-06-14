"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import type { Sport } from "@/lib/types";
import { type MapMarker } from "../Map";
import { BirthplaceMap, type GeoPoint } from "../BirthplaceMap";
import { FetchBirthplacesButton } from "../FetchBirthplacesButton";
import { playerKey } from "@/lib/birthplaces";
import { loadStates, useGeo, withUsState } from "@/lib/geojson";

interface PlayerAgg {
  key: string;
  id?: number;
  name: string;
  games: number;
}

export function PlayersTab({ sport }: { sport?: Sport }) {
  const { data } = useApp();
  const [view, setView] = useState<"map" | "list">("map");
  const states = useGeo(loadStates, true); // for "City, State, USA" labels

  // Players come from soccer lineups (the only sport with lineup data).
  const players = useMemo<PlayerAgg[]>(() => {
    const evts = data.events.filter(
      (e) => e.sport === "soccer" && (!sport || e.sport === sport)
    );
    const byKey = new Map<string, PlayerAgg>();
    for (const e of evts) {
      for (const p of [...e.homeLineup, ...e.awayLineup]) {
        const name = p.name?.trim();
        if (!name) continue;
        const key = playerKey({ id: p.playerId, name });
        const cur = byKey.get(key);
        if (cur) cur.games += 1;
        else byKey.set(key, { key, id: p.playerId, name, games: 1 });
      }
    }
    return [...byKey.values()].sort(
      (a, b) => b.games - a.games || a.name.localeCompare(b.name)
    );
  }, [data.events, sport]);

  const markers = useMemo<MapMarker[]>(() => {
    const byCoord = new Map<string, MapMarker>();
    for (const pl of players) {
      const info = data.playerInfo[pl.key];
      if (info?.lat == null || info?.lng == null) continue;
      const key = `${info.lat.toFixed(4)},${info.lng.toFixed(4)}`;
      if (!byCoord.has(key)) {
        byCoord.set(key, {
          id: key,
          lat: info.lat,
          lng: info.lng,
          title: withUsState(info.birthplace, info.lat, info.lng, states) || pl.name,
          lines: [],
        });
      }
      byCoord.get(key)!.lines!.push(pl.name);
    }
    return Array.from(byCoord.values());
  }, [players, data.playerInfo, states]);

  const points = useMemo<GeoPoint[]>(() => {
    const out: GeoPoint[] = [];
    for (const pl of players) {
      const info = data.playerInfo[pl.key];
      if (info?.lat == null || info?.lng == null) continue;
      out.push({ lat: info.lat, lng: info.lng, country: info.country });
    }
    return out;
  }, [players, data.playerInfo]);

  const located = useMemo(
    () => players.filter((p) => data.playerInfo[p.key]?.lat != null).length,
    [players, data.playerInfo]
  );

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2">Players</h2>
      <p className="text-ink-soft mb-5 text-[15px]">
        Every player you&apos;ve seen take the pitch, mapped by where they were born.
      </p>

      {players.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-ink font-semibold">No players yet</p>
          <p className="text-sm text-muted mt-1 max-w-sm mx-auto">
            Log a soccer game with the <strong>Find match</strong> auto-fill — it
            records both lineups, and the players show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="inline-flex p-1 rounded-full bg-paper-2">
              {(["map", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition ${
                    view === v
                      ? "bg-card text-ink shadow-[var(--shadow-soft)]"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {v === "map" ? "Birthplace map" : "List"}
                </button>
              ))}
            </div>
            <FetchBirthplacesButton players={players} />
          </div>

          <p className="text-xs text-muted mb-3">
            {located} of {players.length} players located
          </p>

          {view === "map" ? (
            markers.length > 0 ? (
              <BirthplaceMap markers={markers} points={points} />
            ) : (
              <div className="card p-10 text-center">
                <div className="text-3xl mb-2">🌍</div>
                <p className="text-ink font-semibold">No birthplaces yet</p>
                <p className="text-sm text-muted mt-1">
                  Hit “Fetch birthplaces” to look them up from the football API.
                </p>
              </div>
            )
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {players.map((p) => {
                const info = data.playerInfo[p.key];
                return (
                  <li key={p.key} className="card p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{p.name}</p>
                      {info?.birthplace && (
                        <p className="text-xs text-muted truncate">
                          📍 {withUsState(info.birthplace, info.lat, info.lng, states)}
                        </p>
                      )}
                    </div>
                    <span className="chip shrink-0">
                      {p.games} game{p.games === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
