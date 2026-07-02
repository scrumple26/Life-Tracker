"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/data";
import { geocode } from "@/lib/geo";
import type { Trip, TripLocation } from "@/lib/types";
import { Stars } from "../Stars";
import { MapPanel, type MapMarker } from "../Map";

function emptyDraft(): Trip {
  return {
    id: "",
    name: "",
    city: "",
    country: "",
    startDate: null,
    endDate: null,
    rating: 0,
    highlights: [],
    locations: [],
    notes: "",
    lat: null,
    lng: null,
    createdAt: "",
  };
}

function fmtRange(t: Trip): string {
  if (!t.startDate && !t.endDate) return "";
  if (t.startDate && t.endDate) return `${t.startDate} → ${t.endDate}`;
  return t.startDate ?? t.endDate ?? "";
}

export function TripsTab() {
  const { data, saveField } = useApp();
  const [draft, setDraft] = useState<Trip | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [highlightText, setHighlightText] = useState("");
  const [busy, setBusy] = useState(false);

  const trips = useMemo(
    () =>
      [...data.trips].sort((a, b) =>
        (b.startDate ?? "").localeCompare(a.startDate ?? "")
      ),
    [data.trips]
  );

  const markers = useMemo<MapMarker[]>(
    () =>
      trips
        .filter((t) => t.lat != null && t.lng != null)
        .map((t) => ({
          id: t.id,
          lat: t.lat as number,
          lng: t.lng as number,
          title: t.name || [t.city, t.country].filter(Boolean).join(", "),
          lines: [[t.city, t.country].filter(Boolean).join(", "), fmtRange(t)].filter(Boolean),
        })),
    [trips]
  );

  function startEdit(t: Trip) {
    setDraft(t);
    setHighlightText(t.highlights.join("\n"));
  }
  function startNew() {
    setDraft(emptyDraft());
    setHighlightText("");
  }

  function addLocation() {
    if (!draft) return;
    setDraft({ ...draft, locations: [...draft.locations, { id: newId(), name: "", notes: "" }] });
  }
  function updateLocation(id: string, patch: Partial<TripLocation>) {
    if (!draft) return;
    setDraft({
      ...draft,
      locations: draft.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }
  function removeLocation(id: string) {
    if (!draft) return;
    setDraft({ ...draft, locations: draft.locations.filter((l) => l.id !== id) });
  }

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    try {
      const rec: Trip = {
        ...draft,
        name: draft.name.trim(),
        id: draft.id || newId(),
        createdAt: draft.createdAt || new Date().toISOString(),
        highlights: highlightText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        locations: draft.locations
          .map((l) => ({ ...l, name: l.name.trim(), notes: l.notes.trim() }))
          .filter((l) => l.name),
      };
      // Geocode the destination if we don't have coords yet.
      if (rec.lat == null || rec.lng == null) {
        const place = [rec.city, rec.country].filter(Boolean).join(", ");
        if (place) {
          const coords = await geocode(place);
          if (coords) {
            rec.lat = coords.lat;
            rec.lng = coords.lng;
          }
        }
      }
      const exists = data.trips.some((t) => t.id === rec.id);
      const next = exists
        ? data.trips.map((t) => (t.id === rec.id ? rec : t))
        : [...data.trips, rec];
      await saveField("trips", next);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await saveField("trips", data.trips.filter((t) => t.id !== id));
  }

  return (
    <section className="lf-rise">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-4xl sm:text-5xl text-ink mb-2">Trips</h2>
          <p className="text-ink-soft text-[15px]">
            Where you&apos;ve been, when, and what made each one worth it.
          </p>
        </div>
        {!draft && (
          <button className="btn btn-primary" onClick={startNew}>
            + Add trip
          </button>
        )}
      </div>

      {draft && (
        <div className="card p-5 mb-6">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="field-label">Trip name</label>
              <input
                className="field"
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Japan, spring 2025"
              />
            </div>
            <div>
              <label className="field-label">City</label>
              <input
                className="field"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value, lat: null, lng: null })}
              />
            </div>
            <div>
              <label className="field-label">Country</label>
              <input
                className="field"
                value={draft.country}
                onChange={(e) => setDraft({ ...draft, country: e.target.value, lat: null, lng: null })}
              />
            </div>
            <div>
              <label className="field-label">Start date</label>
              <input
                type="date"
                className="field"
                value={draft.startDate ?? ""}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value || null })}
              />
            </div>
            <div>
              <label className="field-label">End date</label>
              <input
                type="date"
                className="field"
                value={draft.endDate ?? ""}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value || null })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Rating</label>
              <Stars value={draft.rating} size={26} onChange={(n) => setDraft({ ...draft, rating: n })} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Highlights (one per line)</label>
              <textarea
                className="field min-h-24"
                value={highlightText}
                onChange={(e) => setHighlightText(e.target.value)}
                placeholder={"Fushimi Inari at dawn\nRamen in Osaka"}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Locations</label>
              <p className="text-xs text-muted -mt-1 mb-2">
                Stops within this trip. Each expands to show its details.
              </p>
              {draft.locations.length > 0 && (
                <div className="grid gap-2 mb-2">
                  {draft.locations.map((l) => (
                    <div key={l.id} className="rounded-xl border border-line p-3 grid gap-2">
                      <div className="flex gap-2">
                        <input
                          className="field flex-1"
                          placeholder="Location name (e.g. Kyoto)"
                          value={l.name}
                          onChange={(e) => updateLocation(l.id, { name: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => removeLocation(l.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        className="field min-h-16"
                        placeholder="Details (optional) — what you did, where you stayed…"
                        value={l.notes}
                        onChange={(e) => updateLocation(l.id, { notes: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={addLocation}>
                + Add location
              </button>
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

      <div className="inline-flex p-1 rounded-full bg-paper-2 mb-5">
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
          Map
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🌍</div>
          <p className="text-ink font-semibold">No trips yet</p>
          <p className="text-sm text-muted mt-1">Add your first trip to map it.</p>
        </div>
      ) : view === "map" ? (
        markers.length > 0 ? (
          <div className="card p-3 sm:p-4">
            <MapPanel markers={markers} />
          </div>
        ) : (
          <div className="card p-10 text-center">
            <div className="text-3xl mb-2">🗺️</div>
            <p className="text-ink font-semibold">No locations to map</p>
            <p className="text-sm text-muted mt-1">Add a city/country to a trip to place it.</p>
          </div>
        )
      ) : (
        <ul className="grid gap-2.5">
          {trips.map((t) => (
            <li key={t.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{t.name}</p>
                  <p className="text-xs text-muted">
                    {[[t.city, t.country].filter(Boolean).join(", "), fmtRange(t)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {t.rating > 0 && <Stars value={t.rating} />}
              </div>
              {t.highlights.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {t.highlights.map((h, i) => (
                    <li key={i} className="chip">
                      {h}
                    </li>
                  ))}
                </ul>
              )}
              {t.locations.length > 0 && <TripLocations locations={t.locations} />}
              {t.notes && <p className="text-sm text-ink-soft mt-2">{t.notes}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs">
                <button
                  className="text-terracotta hover:text-terracotta-dark ml-auto"
                  onClick={() => startEdit(t)}
                >
                  Edit
                </button>
                <button className="text-muted hover:text-clay" onClick={() => remove(t.id)}>
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

/** Expandable sub-locations under a trip. Each row toggles open to show its details. */
function TripLocations({ locations }: { locations: TripLocation[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-xs font-semibold text-ink-soft mb-1.5">
        Locations · {locations.length}
      </p>
      <ul className="grid gap-1.5">
        {locations.map((l) => {
          const isOpen = open.has(l.id);
          return (
            <li key={l.id} className="rounded-xl border border-line bg-paper-2/60">
              <button
                type="button"
                onClick={() => toggle(l.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                aria-expanded={isOpen}
              >
                <span
                  className={`text-muted text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}
                  aria-hidden
                >
                  ▸
                </span>
                <span className="flex-1 truncate text-sm font-medium text-ink">{l.name}</span>
                <span className="shrink-0 text-xs text-muted">{isOpen ? "Hide" : "Details"}</span>
              </button>
              {isOpen && (
                <p className="px-3 pb-2.5 pl-8 text-sm text-ink-soft whitespace-pre-wrap">
                  {l.notes || <span className="text-muted italic">No details added.</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
