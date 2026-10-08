"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/data";
import type { Movie } from "@/lib/types";
import { Stars } from "../Stars";

function emptyDraft(): Movie {
  return {
    id: "",
    title: "",
    date: null,
    theater: "",
    city: "",
    rating: 0,
    notes: "",
    createdAt: "",
  };
}

export function MoviesTab() {
  const { data, saveField } = useApp();
  const [draft, setDraft] = useState<Movie | null>(null);
  const [busy, setBusy] = useState(false);

  const movies = useMemo(
    () => [...data.movies].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [data.movies]
  );

  async function save() {
    if (!draft || !draft.title.trim()) return;
    setBusy(true);
    try {
      const rec: Movie = {
        ...draft,
        title: draft.title.trim(),
        id: draft.id || newId(),
        createdAt: draft.createdAt || new Date().toISOString(),
      };
      const exists = data.movies.some((m) => m.id === rec.id);
      const next = exists
        ? data.movies.map((m) => (m.id === rec.id ? rec : m))
        : [...data.movies, rec];
      await saveField("movies", next);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await saveField("movies", data.movies.filter((m) => m.id !== id));
  }

  return (
    <section className="lf-rise">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-4xl sm:text-5xl text-ink mb-2">Movies</h2>
          <p className="text-ink-soft text-[15px]">
            Films you&apos;ve seen out — where, when, and whether they were worth it.
          </p>
        </div>
        {!draft && (
          <button className="btn btn-primary" onClick={() => setDraft(emptyDraft())}>
            + Add movie
          </button>
        )}
      </div>

      {draft && (
        <div className="card p-5 mb-6">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="field-label">Title</label>
              <input
                className="field"
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Dune: Part Two"
              />
            </div>
            <div>
              <label className="field-label">Theater</label>
              <input
                className="field"
                value={draft.theater}
                onChange={(e) => setDraft({ ...draft, theater: e.target.value })}
                placeholder="e.g. Riverview Theater, or Home"
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
              <label className="field-label">Rating</label>
              <Stars value={draft.rating} size={26} onChange={(n) => setDraft({ ...draft, rating: n })} />
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
            <button className="btn btn-primary" disabled={busy || !draft.title.trim()} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {movies.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-ink font-semibold">No movies yet</p>
          <p className="text-sm text-muted mt-1">Add the last one you saw.</p>
        </div>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {movies.map((m) => (
            <li key={m.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{m.title}</p>
                  <p className="text-xs text-muted">
                    {[m.theater, m.city, m.date].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {m.rating > 0 && <Stars value={m.rating} />}
              </div>
              {m.notes && <p className="text-sm text-ink-soft mt-2">{m.notes}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs">
                <button
                  className="text-terracotta hover:text-terracotta-dark ml-auto"
                  onClick={() => setDraft(m)}
                >
                  Edit
                </button>
                <button className="text-muted hover:text-clay" onClick={() => remove(m.id)}>
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
