"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import { geocode } from "@/lib/geo";
import type { ScorerInfo, Sport } from "@/lib/types";
import { MapPanel, type MapMarker } from "../Map";
import { FetchBirthplacesButton } from "../FetchBirthplacesButton";
import { playerKey } from "@/lib/birthplaces";

interface ScorerAgg {
  key: string;
  name: string;
  goals: number;
  playerId?: number;
}

export function ScorersTab({ sport }: { sport?: Sport }) {
  const { data, saveField } = useApp();
  const [view, setView] = useState<"list" | "map">("list");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const events = useMemo(
    () => (sport ? data.events.filter((e) => e.sport === sport) : data.events),
    [data.events, sport]
  );

  const scorers = useMemo<ScorerAgg[]>(() => {
    const byKey = new Map<string, ScorerAgg>();
    for (const e of events) {
      for (const s of e.scorers) {
        const name = s.name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, { key, name, goals: 0 });
        const agg = byKey.get(key)!;
        agg.goals += 1;
        if (agg.playerId == null && s.playerId != null) agg.playerId = s.playerId;
      }
    }
    const arr: ScorerAgg[] = Array.from(byKey.values());
    arr.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
    return arr;
  }, [events]);

  // Birthplace: prefer API player data (by id), fall back to manual scorerInfo.
  const birthOf = (s: ScorerAgg) => {
    const api = data.playerInfo[playerKey({ id: s.playerId, name: s.name })];
    const manual = data.scorerInfo[s.key];
    const lat = api?.lat ?? manual?.lat ?? null;
    const lng = api?.lng ?? manual?.lng ?? null;
    const birthplace = api?.birthplace ?? manual?.birthplace ?? "";
    return { lat, lng, birthplace };
  };

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    for (const s of scorers) {
      const b = birthOf(s);
      if (b.lat != null && b.lng != null) {
        out.push({
          id: s.key,
          lat: b.lat,
          lng: b.lng,
          title: s.name,
          lines: [
            b.birthplace,
            `${s.goals} goal${s.goals === 1 ? "" : "s"} seen`,
          ].filter(Boolean),
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scorers, data.scorerInfo, data.playerInfo]);

  async function saveBirthplace(key: string) {
    const place = draft.trim();
    setBusyKey(key);
    try {
      const next: Record<string, ScorerInfo> = { ...data.scorerInfo };
      const info: ScorerInfo = { ...(next[key] ?? {}), birthplace: place };
      if (place) {
        const coords = await geocode(place);
        if (coords) {
          info.lat = coords.lat;
          info.lng = coords.lng;
        }
      } else {
        delete info.lat;
        delete info.lng;
      }
      next[key] = info;
      await saveField("scorerInfo", next);
      setEditing(null);
      setDraft("");
    } finally {
      setBusyKey(null);
    }
  }

  function exportCsv() {
    const rows = [
      ["Name", "Goals", "Birthplace"],
      ...scorers.map((s) => [
        s.name,
        String(s.goals),
        data.scorerInfo[s.key]?.birthplace ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "scorers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2">Goal scorers</h2>
      <p className="text-ink-soft mb-5 text-[15px]">
        Everyone you&apos;ve seen score, across all your games.
      </p>

      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="inline-flex p-1 rounded-full bg-paper-2">
          <button
            onClick={() => setView("list")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              view === "list" ? "bg-card text-ink shadow-[var(--shadow-soft)]" : "text-ink-soft hover:text-ink"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView("map")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              view === "map" ? "bg-card text-ink shadow-[var(--shadow-soft)]" : "text-ink-soft hover:text-ink"
            }`}
          >
            Birthplace map
          </button>
        </div>
        {scorers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <FetchBirthplacesButton
              players={scorers.map((s) => ({ id: s.playerId, name: s.name }))}
            />
            <button className="btn btn-ghost btn-sm" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        )}
      </div>

      {scorers.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">⚽</div>
          <p className="text-ink font-semibold">No goals logged yet</p>
          <p className="text-sm text-muted mt-1">
            Log a soccer game and add the scorers.
          </p>
        </div>
      ) : view === "list" ? (
        <ul className="grid gap-2.5">
          {scorers.map((s) => {
            const info = data.scorerInfo[s.key];
            const birthplace = birthOf(s).birthplace;
            const isEditing = editing === s.key;
            return (
              <li key={s.key} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{s.name}</p>
                    {birthplace && !isEditing && (
                      <p className="text-xs text-muted">📍 {birthplace}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="chip">
                      {s.goals} goal{s.goals === 1 ? "" : "s"}
                    </span>
                    {!isEditing && (
                      <button
                        className="text-xs text-terracotta hover:text-terracotta-dark"
                        onClick={() => {
                          setEditing(s.key);
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
                        if (e.key === "Enter") saveBirthplace(s.key);
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busyKey === s.key}
                      onClick={() => saveBirthplace(s.key)}
                    >
                      {busyKey === s.key ? "Saving…" : "Save"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : markers.length > 0 ? (
        <div className="card p-3 sm:p-4">
          <MapPanel markers={markers} />
        </div>
      ) : (
        <div className="card p-10 text-center">
          <div className="text-3xl mb-2">🌍</div>
          <p className="text-ink font-semibold">No birthplaces set yet</p>
          <p className="text-sm text-muted mt-1">
            Add a birthplace to scorers in the list view to map them.
          </p>
        </div>
      )}
    </section>
  );
}
