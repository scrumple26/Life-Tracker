"use client";

import { useRef, useState } from "react";
import { useApp } from "@/lib/data";
import {
  fetchPlayerBirthplaces,
  playerKey,
  type FetchProgress,
  type PlayerRef,
} from "@/lib/birthplaces";

export function FetchBirthplacesButton({
  players,
  label = "Fetch birthplaces",
}: {
  players: PlayerRef[];
  label?: string;
}) {
  const { data, saveField } = useApp();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const missing = players.filter((p) => {
    if (!p.name.trim()) return false;
    const cur = data.playerInfo[playerKey(p)];
    return !cur || cur.lat == null || cur.lng == null;
  });

  async function run(force = false) {
    if (!players.length) return;
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await fetchPlayerBirthplaces(players, data.playerInfo, {
        signal: ac.signal,
        force,
        onProgress: setProgress,
        onBatch: (info) => saveField("playerInfo", info),
      });
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  if (!players.length) return null;

  if (running) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted">
          {progress
            ? `Fetching ${progress.done}/${progress.total}${
                progress.current ? ` · ${progress.current}` : ""
              }`
            : "Starting…"}
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
        onClick={() => run(false)}
        disabled={missing.length === 0}
      >
        {missing.length === 0 ? "Birthplaces up to date" : `${label} (${missing.length})`}
      </button>
      <button
        className="text-xs text-muted hover:text-terracotta"
        onClick={() => run(true)}
        title="Re-look-up every birthplace (fixes wrong locations)"
      >
        ↻ Re-fetch all
      </button>
    </div>
  );
}
