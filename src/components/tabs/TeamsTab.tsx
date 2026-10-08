"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import { geocode } from "@/lib/geo";
import { teamKey, type Sport, type TeamLoc } from "@/lib/types";
import { MapPanel, type MapMarker } from "../Map";
import { Segmented } from "../FilterChip";
import { LocationPicker } from "../PlaceMapEditor";

interface TeamAgg {
  name: string;
  games: number;
  // Where the team is from: set by hand, else the stadium of a game where
  // it was the home side (never an away game — that's the other team's city).
  lat: number | null;
  lng: number | null;
  source: "set" | "home-venue" | null;
  where: string; // "St Paul, Minnesota" or the home venue's name
}

function locText(l: TeamLoc | undefined): string {
  return l ? [l.city, l.state, l.country].filter(Boolean).join(", ") : "";
}

export function TeamsTab({ sport }: { sport?: Sport }) {
  const { data, saveField } = useApp();
  const [view, setView] = useState<"list" | "map">("list");
  const [editing, setEditing] = useState<string | null>(null); // team name

  const teams = useMemo<TeamAgg[]>(() => {
    const src = sport ? data.events.filter((e) => e.sport === sport) : data.events;
    const byTeam = new Map<string, TeamAgg>();
    const add = (raw: string, homeVenue: { lat: number; lng: number; name: string } | null) => {
      const name = raw.trim();
      if (!name) return;
      let t = byTeam.get(name);
      if (!t) {
        const loc = data.teamLocs[teamKey(name)];
        t =
          loc && loc.lat != null && loc.lng != null
            ? { name, games: 0, lat: loc.lat, lng: loc.lng, source: "set", where: locText(loc) }
            : { name, games: 0, lat: null, lng: null, source: null, where: locText(loc) };
        byTeam.set(name, t);
      }
      t.games += 1;
      if (t.source === null && homeVenue) {
        Object.assign(t, { lat: homeVenue.lat, lng: homeVenue.lng, source: "home-venue", where: homeVenue.name });
      }
    };
    for (const e of src) {
      const venue =
        e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng, name: e.stadium || e.address } : null;
      add(e.homeTeam, venue);
      add(e.awayTeam, null);
    }
    return Array.from(byTeam.values()).sort(
      (a, b) => b.games - a.games || a.name.localeCompare(b.name)
    );
  }, [data.events, data.teamLocs, sport]);

  const markers = useMemo<MapMarker[]>(
    () =>
      teams
        .filter((t) => t.lat != null && t.lng != null)
        .map((t) => ({
          id: t.name,
          lat: t.lat!,
          lng: t.lng!,
          title: t.name,
          count: 1,
          lines: [t.where, `${t.games} game${t.games === 1 ? "" : "s"} seen`].filter(Boolean),
        })),
    [teams]
  );

  const unplaced = teams.filter((t) => t.source !== "set").length;

  async function saveLoc(name: string, loc: TeamLoc | null) {
    const next = { ...data.teamLocs };
    if (loc) next[teamKey(name)] = loc;
    else delete next[teamKey(name)];
    await saveField("teamLocs", next);
    setEditing(null);
  }

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2">Teams</h2>
      <p className="text-ink-soft mb-5 text-[15px]">
        Every team you&apos;ve watched play, mapped where they&apos;re from.
      </p>

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <Segmented
          value={view}
          options={[
            { id: "list", label: "List" },
            { id: "map", label: "Map" },
          ]}
          onChange={setView}
        />
        {teams.length > 0 && unplaced > 0 && (
          <span className="text-xs text-muted">
            {unplaced} team{unplaced === 1 ? "" : "s"} without a set location — use Edit location to fix where they show on the map.
          </span>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-ink font-semibold">No teams yet</p>
          <p className="text-sm text-muted mt-1">Log some events to get started.</p>
        </div>
      ) : view === "list" ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {teams.map((t) =>
            editing === t.name ? (
              <TeamLocEditor
                key={t.name}
                team={t.name}
                initial={data.teamLocs[teamKey(t.name)]}
                onCancel={() => setEditing(null)}
                onSave={(loc) => saveLoc(t.name, loc)}
              />
            ) : (
              <div key={t.name} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink truncate">{t.name}</span>
                  <span className="chip shrink-0">
                    {t.games} game{t.games === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-muted truncate">
                    {t.source === "set"
                      ? t.where || "Location set"
                      : t.source === "home-venue"
                        ? `Placed at home venue${t.where ? `: ${t.where}` : ""}`
                        : "Not on the map"}
                  </span>
                  <button
                    className="text-terracotta hover:text-terracotta-dark ml-auto shrink-0"
                    onClick={() => setEditing(t.name)}
                  >
                    {t.source === "set" ? "Edit location" : "Set location"}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      ) : markers.length > 0 ? (
        <div className="card p-3 sm:p-4">
          <MapPanel markers={markers} />
        </div>
      ) : (
        <div className="card p-10 text-center">
          <p className="text-ink font-semibold">No team locations yet</p>
          <p className="text-sm text-muted mt-1">
            Set where a team is from in the list, and it&apos;ll appear here.
          </p>
        </div>
      )}
    </section>
  );
}

/** Inline editor: search the team's home city (fills the fields) or tap the map. */
function TeamLocEditor({
  team,
  initial,
  onSave,
  onCancel,
}: {
  team: string;
  initial: TeamLoc | undefined;
  onSave: (loc: TeamLoc | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [loc, setLoc] = useState<TeamLoc>(
    initial ?? { city: "", state: "", country: "", lat: null, lng: null }
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const rec: TeamLoc = {
        city: loc.city?.trim() || undefined,
        state: loc.state?.trim() || undefined,
        country: loc.country?.trim() || undefined,
        lat: loc.lat,
        lng: loc.lng,
      };
      // Typed a place but never dropped a pin: look it up.
      if (rec.lat == null && locText(rec)) {
        const coords = await geocode(locText(rec));
        if (coords) Object.assign(rec, coords);
      }
      await onSave(rec);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: "city" | "state" | "country", label: string) => (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="field"
        value={loc[key] ?? ""}
        // Editing the text means the old pin may no longer match.
        onChange={(e) => setLoc({ ...loc, [key]: e.target.value, lat: null, lng: null })}
      />
    </div>
  );

  return (
    <div className="card p-4 sm:col-span-2">
      <p className="font-semibold text-ink mb-3">Where is {team} from?</p>
      <LocationPicker
        value={loc.lat != null && loc.lng != null ? { lat: loc.lat, lng: loc.lng } : null}
        suggestion={team}
        onChange={(ll) => setLoc((l) => ({ ...l, lat: ll?.lat ?? null, lng: ll?.lng ?? null }))}
        onPickPlace={(hit) =>
          setLoc((l) => ({
            ...l,
            city: hit.city || l.city,
            state: hit.state || l.state,
            country: hit.country || l.country,
          }))
        }
      />
      <div className="grid gap-3 sm:grid-cols-3 mt-3">
        {field("city", "City")}
        {field("state", "State")}
        {field("country", "Country")}
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {initial && (
          <button className="btn btn-ghost ml-auto" disabled={busy} onClick={() => onSave(null)}>
            Clear location
          </button>
        )}
      </div>
    </div>
  );
}
