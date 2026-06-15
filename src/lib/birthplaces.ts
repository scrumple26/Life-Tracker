"use client";

import { geocode } from "./geo";
import type { PlayerInfo } from "./types";

export interface FetchProgress {
  done: number;
  total: number;
  current?: string;
}

export interface PlayerRef {
  id?: number; // API-Football id when known
  name: string;
}

// Stable key for the playerInfo map: by id when we have one, else by name.
export function playerKey(p: PlayerRef): string {
  return p.id != null ? String(p.id) : `nm:${p.name.trim().toLowerCase()}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch birth details + coordinates for a set of players, throttled to respect
 * Nominatim's ~1 req/sec limit. Geocoding is deduped per run. Results are
 * merged into `existing` and flushed via `onBatch` periodically so progress
 * survives interruption.
 */
export async function fetchPlayerBirthplaces(
  players: PlayerRef[],
  existing: Record<string, PlayerInfo>,
  opts: {
    onProgress?: (p: FetchProgress) => void;
    onBatch?: (info: Record<string, PlayerInfo>) => Promise<void> | void;
    signal?: AbortSignal;
    force?: boolean; // re-fetch even players that already have coordinates
  } = {}
): Promise<Record<string, PlayerInfo>> {
  const { onProgress, onBatch, signal, force } = opts;
  const result: Record<string, PlayerInfo> = { ...existing };

  // Dedupe by key. By default skip players we already have coords for; with
  // `force`, re-fetch everyone (e.g. to re-geocode after a geocoder change).
  const seen = new Set<string>();
  const todo = players.filter((p) => {
    if (!p.name.trim()) return false;
    const key = playerKey(p);
    if (seen.has(key)) return false;
    seen.add(key);
    if (force) return true;
    const cur = result[key];
    return !cur || cur.lat == null || cur.lng == null;
  });

  const geoCache = new Map<string, { lat: number; lng: number } | null>();
  let processedSinceFlush = 0;

  for (let i = 0; i < todo.length; i++) {
    if (signal?.aborted) break;
    const p = todo[i];
    const key = playerKey(p);
    onProgress?.({ done: i, total: todo.length, current: p.name });

    try {
      const url =
        p.id != null
          ? `/api/football/player?id=${p.id}`
          : `/api/football/player-search?name=${encodeURIComponent(p.name)}`;
      const res = await fetch(url);
      if (res.ok) {
        const b = (await res.json()) as {
          name: string;
          birthplace: string;
          country: string;
          nationality: string;
          dob: string;
        };
        const info: PlayerInfo = {
          name: b.name || p.name,
          birthplace: b.birthplace || undefined,
          country: b.country || undefined,
          nationality: b.nationality || undefined,
          dob: b.dob || undefined,
        };
        if (b.birthplace) {
          let coords = geoCache.get(b.birthplace);
          if (coords === undefined) {
            coords = await geocode(b.birthplace);
            geoCache.set(b.birthplace, coords);
          }
          if (coords) {
            info.lat = coords.lat;
            info.lng = coords.lng;
          }
        }
        result[key] = info;
      }
    } catch {
      // skip this player; continue
    }

    processedSinceFlush++;
    if (processedSinceFlush >= 10 && onBatch) {
      await onBatch({ ...result });
      processedSinceFlush = 0;
    }

    // Throttle for Nominatim (and to stay well under API rate limits).
    if (i < todo.length - 1) await sleep(1100);
  }

  if (onBatch) await onBatch({ ...result });
  onProgress?.({ done: todo.length, total: todo.length });
  return result;
}
