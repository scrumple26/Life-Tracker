"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import { geocode } from "@/lib/geo";
import { isSoccerSport, type LineupEntry, type PlayerInfo, type Sport, type SportEvent } from "@/lib/types";
import { type MapMarker } from "../Map";
import { BirthplaceMap, type GeoPoint } from "../BirthplaceMap";
import { FetchBirthplacesButton } from "../FetchBirthplacesButton";
import { UpdateFullNamesButton } from "../UpdateFullNamesButton";
import { playerKey } from "@/lib/birthplaces";
import { loadStates, normCountry, useGeo, withUsState } from "@/lib/geojson";

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
  const [view, setView] = useState<"map" | "list" | "countries">("map");
  const [onlyUnlocated, setOnlyUnlocated] = useState(false);
  const [gamesOpen, setGamesOpen] = useState<string | null>(null); // player key
  const states = useGeo(loadStates, true); // for "City, State, USA" labels
  const eventsById = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events]);
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
        const country = parts.length > 1 ? parts[parts.length - 1].trim() : "";
        if (country) info.country = country;
        delete info.approx;
        const coords = await geocode(place);
        if (coords) {
          info.lat = coords.lat;
          info.lng = coords.lng;
        } else if (country) {
          // Couldn't pin the exact place — fall back to the country.
          const cc = await geocode(country);
          if (cc) {
            info.lat = cc.lat;
            info.lng = cc.lng;
            info.approx = true;
          }
        }
      } else {
        delete info.birthplace;
        delete info.lat;
        delete info.lng;
        delete info.approx;
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
    const evts = data.events.filter((e) =>
      sport ? e.sport === sport : isSoccerSport(e.sport)
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
          title:
            withUsState(info.birthplace, info.lat, info.lng, states, info.approx) || pl.name,
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
      out.push({ lat: info.lat, lng: info.lng, country: info.country, approx: info.approx });
    }
    return out;
  }, [players, data.playerInfo]);

  const located = useMemo(
    () => players.filter((p) => data.playerInfo[p.key]?.lat != null).length,
    [players, data.playerInfo]
  );

  // List view can be filtered down to players we haven't pinned a birthplace for.
  const listedPlayers = useMemo(
    () =>
      onlyUnlocated
        ? players.filter((p) => {
            const info = data.playerInfo[p.key];
            return info?.lat == null || info?.lng == null;
          })
        : players,
    [players, data.playerInfo, onlyUnlocated]
  );

  // Countries ranked by how many distinct players you've seen born there.
  // Spellings of the same country ("USA" / "United States") count as one, so
  // this list and the birthplace map's country count agree.
  const countryRanks = useMemo<CountryRank[]>(() => {
    const byCountry = new Map<string, CountryRank>();
    for (const p of players) {
      const info = data.playerInfo[p.key];
      const country = info?.country?.trim();
      if (!country) continue;
      const key = normCountry(country);
      const r = byCountry.get(key) ?? { country, count: 0, players: [] };
      r.count += 1;
      r.players.push({
        key: p.key,
        name: info?.name || p.name,
        birthplace: info?.birthplace ?? "",
        apps: p.apps.length,
      });
      byCountry.set(key, r);
    }
    return [...byCountry.values()]
      .map((r) => ({ ...r, players: r.players.sort((a, b) => b.apps - a.apps || a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
  }, [players, data.playerInfo]);
  const countryNames = useMemo(() => countryRanks.map((r) => r.country), [countryRanks]);
  const playersWithCountry = useMemo(
    () => countryRanks.reduce((sum, r) => sum + r.count, 0),
    [countryRanks]
  );

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2">Players</h2>
      <p className="text-ink-soft mb-5 text-[15px]">
        Every player you&apos;ve seen take the pitch, mapped by where they were born.
      </p>

      {players.length === 0 ? (
        <div className="card p-10 text-center">
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
              {(["map", "list", "countries"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition ${
                    view === v
                      ? "bg-card text-ink shadow-[var(--shadow-soft)]"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {v === "map" ? "Birthplace map" : v === "list" ? "List" : "Countries"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <UpdateFullNamesButton players={players} />
              <FetchBirthplacesButton players={players} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-xs text-muted">
              {located} of {players.length} players located
            </p>
            {view === "list" && (
              <label className="flex items-center gap-2 text-sm text-ink-soft select-none">
                <input
                  type="checkbox"
                  className="accent-[var(--color-terracotta)]"
                  checked={onlyUnlocated}
                  onChange={(e) => setOnlyUnlocated(e.target.checked)}
                />
                Only players without a birth location
              </label>
            )}
          </div>

          {view === "countries" ? (
            <CountriesRanked ranks={countryRanks} totalPlayers={playersWithCountry} />
          ) : view === "map" ? (
            markers.length > 0 ? (
              <BirthplaceMap markers={markers} points={points} countries={countryNames} />
            ) : (
              <div className="card p-10 text-center">
                <p className="text-ink font-semibold">No birthplaces yet</p>
                <p className="text-sm text-muted mt-1">
                  Hit “Fetch birthplaces” to look them up from the football API.
                </p>
              </div>
            )
          ) : listedPlayers.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-ink font-semibold">Every player has a birth location</p>
              <p className="text-sm text-muted mt-1">
                Uncheck the filter to see all {players.length} players.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {listedPlayers.map((p) => {
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
                            {withUsState(info.birthplace, info.lat, info.lng, states, info.approx)}
                            {!hasLoc && " (not located)"}
                            {hasLoc && info.approx && " (country approx.)"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="chip hover:border-terracotta hover:text-terracotta transition"
                          aria-expanded={gamesOpen === p.key}
                          onClick={() => setGamesOpen(gamesOpen === p.key ? null : p.key)}
                        >
                          {p.apps.length} game{p.apps.length === 1 ? "" : "s"}
                          {gamesOpen === p.key ? " · hide" : ""}
                        </button>
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
                    {gamesOpen === p.key && (
                      <ul className="mt-2.5 grid gap-1 border-t border-line pt-2.5">
                        {[...p.apps]
                          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                          .map((a) => {
                            const e = eventsById.get(a.eventId);
                            const isHome = e ? e.homeTeam === a.team : true;
                            const mine = isHome ? e?.homeScore : e?.awayScore;
                            const theirs = isHome ? e?.awayScore : e?.homeScore;
                            return (
                              <li key={a.eventId}>
                                <a
                                  href={`#log-event-${a.eventId}`}
                                  className="flex items-baseline gap-2 rounded-lg px-2 py-1 text-xs hover:bg-paper-2"
                                >
                                  <span className="w-20 shrink-0 text-muted tabular-nums">
                                    {a.date ?? "Date unknown"}
                                  </span>
                                  <span className="flex-1 truncate text-ink">
                                    {a.team} {isHome ? "vs" : "at"} {a.opponent}
                                  </span>
                                  {mine != null && theirs != null && (
                                    <span className="shrink-0 font-semibold text-ink tabular-nums">
                                      {mine}–{theirs}
                                    </span>
                                  )}
                                </a>
                              </li>
                            );
                          })}
                      </ul>
                    )}
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

interface CountryRank {
  country: string;
  count: number;
  players: { key: string; name: string; birthplace: string; apps: number }[];
}

/** Countries ranked by how many players you've seen who were born there. Tap one to see them. */
function CountriesRanked({
  ranks,
  totalPlayers,
}: {
  ranks: CountryRank[];
  totalPlayers: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (ranks.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ink font-semibold">No countries yet</p>
        <p className="text-sm text-muted mt-1">
          Fetch birthplaces so each player has a country to rank.
        </p>
      </div>
    );
  }
  const max = ranks[0].count;
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs text-muted mb-3">
        {ranks.length} countr{ranks.length === 1 ? "y" : "ies"} · {totalPlayers} player
        {totalPlayers === 1 ? "" : "s"} with a known country
      </p>
      <ol className="grid gap-1.5">
        {ranks.map((r, i) => (
          <li key={r.country}>
            <button
              type="button"
              onClick={() => setOpen(open === r.country ? null : r.country)}
              aria-expanded={open === r.country}
              className="w-full flex items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-paper-2"
            >
              <span className="w-6 shrink-0 text-right text-sm font-semibold text-muted tabular-nums">
                {i + 1}
              </span>
              <span className="w-28 sm:w-40 shrink-0 truncate text-sm font-medium text-ink">
                {r.country}
              </span>
              <span className="relative flex-1 h-2.5 rounded-full bg-paper-2 overflow-hidden">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-terracotta"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-sm font-semibold text-ink tabular-nums">
                {r.count}
              </span>
            </button>
            {open === r.country && (
              <ul className="ml-9 mt-1 mb-2 grid gap-1 sm:grid-cols-2">
                {r.players.map((p) => (
                  <li key={p.key} className="rounded-lg border border-line bg-card px-3 py-2">
                    <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                    <p className="text-xs text-muted truncate">
                      {[p.birthplace, `${p.apps} game${p.apps === 1 ? "" : "s"} seen`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
