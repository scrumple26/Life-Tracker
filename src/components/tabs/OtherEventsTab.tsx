"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/data";
import type { OtherEvent } from "@/lib/types";
import { Stars } from "../Stars";
import { FilterChip } from "../FilterChip";

function emptyDraft(): OtherEvent {
  return {
    id: "",
    name: "",
    kind: "",
    date: null,
    venue: "",
    city: "",
    rating: 0,
    notes: "",
    createdAt: "",
  };
}

/** Anything that isn't a concert, movie or game — comedy, theater, festivals… */
export function OtherEventsTab() {
  const { data, saveField } = useApp();
  const [draft, setDraft] = useState<OtherEvent | null>(null);
  const [filter, setFilter] = useState("all"); // "all" | kind
  const [busy, setBusy] = useState(false);

  const kinds = useMemo(
    () => [...new Set(data.otherEvents.map((e) => e.kind).filter(Boolean))].sort(),
    [data.otherEvents]
  );

  const shown = useMemo(
    () =>
      data.otherEvents
        .filter((e) => filter === "all" || e.kind === filter)
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [data.otherEvents, filter]
  );

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    try {
      const rec: OtherEvent = {
        ...draft,
        name: draft.name.trim(),
        kind: draft.kind.trim(),
        id: draft.id || newId(),
        createdAt: draft.createdAt || new Date().toISOString(),
      };
      const exists = data.otherEvents.some((e) => e.id === rec.id);
      const next = exists
        ? data.otherEvents.map((e) => (e.id === rec.id ? rec : e))
        : [...data.otherEvents, rec];
      await saveField("otherEvents", next);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await saveField("otherEvents", data.otherEvents.filter((e) => e.id !== id));
  }

  return (
    <section className="lf-rise">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-4xl sm:text-5xl text-ink mb-2">Other events</h2>
          <p className="text-ink-soft text-[15px]">
            Comedy shows, theater, festivals — everything else worth remembering.
          </p>
        </div>
        {!draft && (
          <button className="btn btn-primary" onClick={() => setDraft(emptyDraft())}>
            + Add event
          </button>
        )}
      </div>

      {draft && (
        <div className="card p-5 mb-6">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="field-label">Event</label>
              <input
                className="field"
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Minnesota State Fair"
              />
            </div>
            <div>
              <label className="field-label">Kind</label>
              <input
                className="field"
                list="other-event-kinds"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                placeholder="Comedy, Theater, Festival…"
              />
              <datalist id="other-event-kinds">
                {kinds.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
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
            <div className="sm:col-span-2">
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
            <button className="btn btn-primary" disabled={busy || !draft.name.trim()} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {kinds.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterChip>
          {kinds.map((k) => (
            <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}>
              {k}
            </FilterChip>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🎟️</div>
          <p className="text-ink font-semibold">No events yet</p>
          <p className="text-sm text-muted mt-1">Add a show, festival or anything else you went to.</p>
        </div>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {shown.map((e) => (
            <li key={e.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{e.name}</p>
                  <p className="text-xs text-muted">
                    {[e.venue, e.city, e.date].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {e.kind && <span className="chip shrink-0">{e.kind}</span>}
              </div>
              {e.rating > 0 && (
                <div className="mt-2">
                  <Stars value={e.rating} />
                </div>
              )}
              {e.notes && <p className="text-sm text-ink-soft mt-2">{e.notes}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs">
                <button
                  className="text-terracotta hover:text-terracotta-dark ml-auto"
                  onClick={() => setDraft(e)}
                >
                  Edit
                </button>
                <button className="text-muted hover:text-clay" onClick={() => remove(e.id)}>
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
