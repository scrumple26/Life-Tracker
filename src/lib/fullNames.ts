"use client";

// Look up players' full names from API-Football (via our /api/football/player
// route, which now returns firstname + lastname). Used to backfill soccer
// players that were logged with the abbreviated lineup/event names.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FullNameProgress {
  done: number;
  total: number;
  current?: string;
}

/**
 * Fetch full names for a set of player ids, throttled to respect the football
 * API rate limit. Returns a map of id -> full name (only ids that resolved).
 */
export async function fetchFullNames(
  ids: number[],
  opts: { onProgress?: (p: FullNameProgress) => void; signal?: AbortSignal } = {}
): Promise<Map<number, string>> {
  const { onProgress, signal } = opts;
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  const out = new Map<number, string>();

  for (let i = 0; i < unique.length; i++) {
    if (signal?.aborted) break;
    const id = unique[i];
    onProgress?.({ done: i, total: unique.length });
    try {
      const res = await fetch(`/api/football/player?id=${id}`);
      if (res.ok) {
        const b = (await res.json()) as { name?: string };
        const name = b.name?.trim();
        if (name) out.set(id, name);
      }
    } catch {
      // skip this player; continue
    }
    if (i < unique.length - 1) await sleep(800);
  }

  onProgress?.({ done: unique.length, total: unique.length });
  return out;
}
