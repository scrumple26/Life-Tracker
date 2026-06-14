"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/data";
import type { Concert } from "@/lib/types";
import { Stars } from "../Stars";

function emptyDraft(): Concert {
  return {
    id: "",
    artist: "",
    venue: "",
    city: "",
    date: null,
    openingAct: "",
    setlist: [],
    spotifyUrl: "",
    rating: 0,
    notes: "",
    createdAt: "",
  };
}

export function ConcertsTab() {
  const { data, saveField } = useApp();
  const [draft, setDraft] = useState<Concert | null>(null);
  const [setlistText, setSetlistText] = useState("");
  const [busy, setBusy] = useState(false);

  const concerts = useMemo(
    () => [...data.concerts].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [data.concerts]
  );

  function startEdit(c: Concert) {
    setDraft(c);
    setSetlistText(c.setlist.join("\n"));
  }
  function startNew() {
    setDraft(emptyDraft());
    setSetlistText("");
  }

  async function save() {
    if (!draft || !draft.artist.trim()) return;
    setBusy(true);
    try {
      const rec: Concert = {
        ...draft,
        artist: draft.artist.trim(),
        id: draft.id || newId(),
        createdAt: draft.createdAt || new Date().toISOString(),
        setlist: setlistText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const exists = data.concerts.some((c) => c.id === rec.id);
      const next = exists
        ? data.concerts.map((c) => (c.id === rec.id ? rec : c))
        : [...data.concerts, rec];
      await saveField("concerts", next);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await saveField("concerts", data.concerts.filter((c) => c.id !== id));
  }

  return (
    <section className="lf-rise">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-4xl sm:text-5xl text-ink mb-2">Concerts</h2>
          <p className="text-ink-soft text-[15px]">
            Shows you&apos;ve seen — the setlists, the openers, the nights.
          </p>
        </div>
        {!draft && (
          <button className="btn btn-primary" onClick={startNew}>
            + Add show
          </button>
        )}
      </div>

      {draft && (
        <div className="card p-5 mb-6">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="field-label">Artist</label>
              <input
                className="field"
                autoFocus
                value={draft.artist}
                onChange={(e) => setDraft({ ...draft, artist: e.target.value })}
                placeholder="e.g. Fleet Foxes"
              />
            </div>
            <div>
              <label className="field-label">Venue</label>
              <input
                className="field"
                value={draft.venue}
                onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">City</label>
              <input
                className="field"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Date</label>
              <input
                type="date"
                className="field"
                value={draft.date ?? ""}
                onChange={(e) => setDraft({ ...draft, date: e.target.value || null })}
              />
            </div>
            <div>
              <label className="field-label">Opening act</label>
              <input
                className="field"
                value={draft.openingAct}
                onChange={(e) => setDraft({ ...draft, openingAct: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Spotify link</label>
              <input
                className="field"
                value={draft.spotifyUrl}
                onChange={(e) => setDraft({ ...draft, spotifyUrl: e.target.value })}
                placeholder="https://open.spotify.com/…"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Rating</label>
              <Stars value={draft.rating} size={26} onChange={(n) => setDraft({ ...draft, rating: n })} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Setlist (one song per line)</label>
              <textarea
                className="field min-h-28"
                value={setlistText}
                onChange={(e) => setSetlistText(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Notes</label>
              <textarea
                className="field min-h-20"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary" disabled={busy || !draft.artist.trim()} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {concerts.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🎸</div>
          <p className="text-ink font-semibold">No shows yet</p>
          <p className="text-sm text-muted mt-1">Add a concert to start your log.</p>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {concerts.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{c.artist}</p>
                  <p className="text-xs text-muted">
                    {[c.venue, c.city, c.date].filter(Boolean).join(" · ")}
                  </p>
                  {c.openingAct && (
                    <p className="text-xs text-muted mt-0.5">with {c.openingAct}</p>
                  )}
                </div>
                {c.rating > 0 && <Stars value={c.rating} />}
              </div>

              {c.setlist.length > 0 && (
                <details className="mt-2.5 group">
                  <summary className="text-sm font-semibold text-terracotta cursor-pointer select-none">
                    Setlist · {c.setlist.length} songs
                  </summary>
                  <ol className="mt-2 ml-4 list-decimal text-sm text-ink-soft space-y-0.5">
                    {c.setlist.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </details>
              )}

              {c.notes && <p className="text-sm text-ink-soft mt-2">{c.notes}</p>}

              <div className="flex items-center gap-3 mt-3 text-xs">
                {c.spotifyUrl && (
                  <a
                    href={c.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sage font-semibold hover:underline"
                  >
                    ▶ Spotify
                  </a>
                )}
                <button
                  className="text-terracotta hover:text-terracotta-dark ml-auto"
                  onClick={() => startEdit(c)}
                >
                  Edit
                </button>
                <button className="text-muted hover:text-clay" onClick={() => remove(c.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
