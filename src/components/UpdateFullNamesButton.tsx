"use client";

import { useRef, useState } from "react";
import { useApp } from "@/lib/data";
import { fetchFullNames, type FullNameProgress } from "@/lib/fullNames";
import { isSoccerSport, type PlayerInfo } from "@/lib/types";

interface NamedRef {
  id?: number;
  name: string;
}

/**
 * Backfills soccer players' stored names to their full names (from
 * API-Football). Rewrites the lineup/scorer entries in every event plus the
 * matching playerInfo record, so the full name shows everywhere it's derived.
 */
export function UpdateFullNamesButton({ players }: { players: NamedRef[] }) {
  const { data, saveEvents, saveField } = useApp();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<FullNameProgress | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ids = [...new Set(players.map((p) => p.id).filter((id): id is number => id != null))];

  async function run() {
    if (!ids.length) return;
    setRunning(true);
    setDone(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const map = await fetchFullNames(ids, { signal: ac.signal, onProgress: setProgress });
      if (map.size === 0) {
        setDone("No names to update.");
        return;
      }

      // Rewrite lineup/scorer names by player id, only where the name changes.
      let renamed = 0;
      const rename = <T extends { name: string; playerId?: number }>(p: T): T => {
        if (p.playerId != null && map.has(p.playerId)) {
          const full = map.get(p.playerId)!;
          if (full && full !== p.name) {
            renamed++;
            return { ...p, name: full };
          }
        }
        return p;
      };
      const newEvents = data.events.map((e) =>
        isSoccerSport(e.sport)
          ? {
              ...e,
              homeLineup: e.homeLineup.map(rename),
              awayLineup: e.awayLineup.map(rename),
              scorers: e.scorers.map(rename),
            }
          : e
      );

      // Keep the matching playerInfo (birthplace) records in sync.
      const newInfo: Record<string, PlayerInfo> = { ...data.playerInfo };
      let infoChanged = false;
      for (const [key, info] of Object.entries(newInfo)) {
        const id = Number(key);
        if (Number.isFinite(id) && map.has(id)) {
          const full = map.get(id)!;
          if (full && info.name !== full) {
            newInfo[key] = { ...info, name: full };
            infoChanged = true;
          }
        }
      }

      if (renamed > 0) await saveEvents(newEvents);
      if (infoChanged) await saveField("playerInfo", newInfo);
      setDone(renamed > 0 ? `Updated ${renamed} name${renamed === 1 ? "" : "s"}.` : "Already up to date.");
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  if (!ids.length) return null;

  if (running) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted">
          {progress ? `Names ${progress.done}/${progress.total}` : "Starting…"}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => abortRef.current?.abort()}>
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn btn-ghost btn-sm"
        onClick={run}
        title="Look up each player's full name from the football database"
      >
        Full names ({ids.length})
      </button>
      {done && <span className="text-xs text-muted">{done}</span>}
    </div>
  );
}
