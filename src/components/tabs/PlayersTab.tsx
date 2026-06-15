"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import { geocode } from "@/lib/geo";
import type { LineupEntry, PlayerInfo, Sport, SportEvent } from "@/lib/types";
import { type MapMarker } from "../Map";
import { BirthplaceMap, type GeoPoint } from "../BirthplaceMap";
import { FetchBirthplacesButton } from "../FetchBirthplacesButton";
import { playerKey } from "@/lib/birthplaces";
import { loadStates, useGeo, withUsState } from "@/lib/geojson";

interface Appearance {
  eventId: string;
  team: string;
  opponent: string;
  date: string | null;
}
interface PlayerAgg {
  key: string;
  id?: number;
  name: string;
  apps: Appearance[];
}

export function PlayersTab({ sport }: { sport?: Sport }) {
  const { data, saveField } = useApp();
  const [view, setView] = useState<"map" | "list">("map");
  const states = useGeo(loadStates, true); // for "City, State, USA" labels
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Manually set/correct a player's birthplace (for ones the API can't resolve).
  async function saveBirthplace(p: { key: string; name: string }) {
    const place = draft.trim();
    setBusyKey(p.key);
    try {
      const next: Record<string, PlayerInfo> = { ...data.playerInfo };
      const info: PlayerInfo = { ...(next[p.key] ?? {}), name: p.name };
      if (place) {
        info.birthplace = place;
        const parts = place.split(",");
        if (parts.length > 1) info.country = parts[parts.length - 1].trim();
        const coords = await geocode(place);
        if (coords) {
          info.lat = coords.lat;
          info.lng = coords.lng;
        }
      } else {
        delete info.birthplace;
        delete info.lat;
        delete info.lng;
      }
      next[p.key] = info;
      await saveField("playerInfo", next);
      setEditKey(null);
      setDraft("");
    } finally {
      setBusyKey(null);
    }
  }

  // Players come from soccer lineups (the only sport with lineup data).
  const players = useMemo<PlayerAgg[]>(() => {
    const evts = data.events.filter(
      (e) => e.sport === "soccer" && (!sport || e.sport === sport)
    );
    const byKey = new Map<string, PlayerAgg>();
    const add = (p: LineupEntry, e: SportEvent, team: string, opponent: string) => {
      const name = p.name?.trim();
      if (!name) return;
      const key = playerKey({ id: p.playerId, name });
      let cur = byKey.get(key);
      if (!cur) {
        cur = { key, id: p.playerId, name, apps: [] };
        byKey.set(key, cur);
      }
      cur.apps.push({ eventId: e.id, team, opponent, date: e.date });
    };
    for (const e of evts) {
      for (const p of e.homeLineup) add(p, e, e.homeTeam, e.awayTeam);
      for (const p of e.awayLineup) add(p, e, e.awayTeam, e.homeTeam);
    }
    return [...byKey.values()].sort(
      (a, b) => b.apps.length - a.apps.length || a.name.localeCompare(b.name)
    );
  }, [data.events, sport]);

  const markers = useMemo<MapMarker[]>(() => {
    interface Pin {
      lat: number;
      lng: number;
      title: string;
      // one bucket per unique player (by normalized name) at this location
      players: Map<string, { name: string; apps: Appearance[] }>;
    }
    const byCoord = new Map<string, Pin>();
    for (const pl of players) {
      const info = data.playerInfo[pl.key];
      if (info?.lat == null || info?.lng == null) continue;
      const ckey = `${info.lat.toFixed(4)},${info.lng.toFixed(4)}`;
      let pin = byCoord.get(ckey);
      if (!pin) {
        pin = {
          lat: info.lat,
          lng: info.lng,
          title: withUsState(info.birthplace, info.lat, info.lng, states) || pl.name,
          players: new Map(),
        };
        byCoord.set(ckey, pin);
      }
      const nk = pl.name.trim().toLowerCase();
      const cur = pin.players.get(nk);
      const apps = pl.apps.map((a) => ({ ...a })); // copy out of the memoized value
      if (cur) cur.apps.push(...apps);
      else pin.players.set(nk, { name: pl.name, apps });
    }

    const out: MapMarker[] = [];
    for (const [ckey, pin] of byCoord) {
      const rows: { text: string; href?: string }[] = [];
      for (const p of pin.players.values()) {
        // one entry per player; dedupe their appearances by match
        const seen = new Set<string>();
        const apps = p.apps.filter((a) => (seen.has(a.eventId) ? false : seen.add(a.eventId)));
        if (apps.length === 1) {
          const a = apps[0];
          rows.push({
            text: `${p.name} — ${a.team}${a.date ? ` · ${a.date}` : ""}`,
            href: `#log-event-${a.eventId}`,
          });
        } else {
          rows.push({ text: p.name });
          for (const a of apps) {
            rows.push({
              text: `· ${a.team}${a.date ? ` · ${a.date}` : ""}`,
              href: `#log-event-${a.eventId}`,
            });
          }
        }
      }
      out.push({
        id: ckey,
        lat: pin.lat,
        lng: pin.lng,
        title: pin.title,
        rows,
        count: pin.players.size,
      });
    }
    return out;
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
                const isEditing = editKey === p.key;
                const hasLoc = info?.lat != null && info?.lng != null;
                return (
                  <li key={p.key} className="card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{p.name}</p>
                        {info?.birthplace && !isEditing && (
                          <p className={`text-xs truncate ${hasLoc ? "text-muted" : "text-clay"}`}>
                            📍 {withUsState(info.birthplace, info.lat, info.lng, states)}
                            {!hasLoc && " (not located)"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="chip">
                          {p.apps.length} game{p.apps.length === 1 ? "" : "s"}
                        </span>
                        {!isEditing && (
                          <button
                            className="text-xs text-terracotta hover:text-terracotta-dark"
                            onClick={() => {
                              setEditKey(p.key);
                              setDraft(info?.birthplace ?? "");
                            }}
                          >
                            {info?.birthplace ? "Edit" : "Add birthplace"}
                          </button>
                        )}
                      </div>
                    </div>
                    {isEditing && (
                      <div className="flex gap-2 mt-3">
                        <input
                          className="field flex-1"
                          placeholder="City, Country"
                          value={draft}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveBirthplace(p);
                            if (e.key === "Escape") setEditKey(null);
                          }}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busyKey === p.key}
                          onClick={() => saveBirthplace(p)}
                        >
                          {busyKey === p.key ? "Saving…" : "Save"}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditKey(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
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
