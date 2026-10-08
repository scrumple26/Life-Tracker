"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/data";
import { geocodeFirst } from "@/lib/geo";
import { decodePolyline, fmtMiles, pathKm } from "@/lib/route";
import {
  COURSE_TYPES,
  PLACE_TAGS,
  isRouteType,
  type CourseType,
  type Place,
  type PlaceTag,
} from "@/lib/types";
import { Stars } from "../Stars";
import { FilterChip, Segmented } from "../FilterChip";
import { MapPanel, type MapMarker, type MapPath } from "../Map";
import { LocationPicker, RouteEditor } from "../PlaceMapEditor";

const COPY: Record<PlaceTag, { title: string; blurb: string; emoji: string; noun: string }> = {
  course: {
    title: "Courses & Trails",
    blurb: "Golf and disc golf courses, plus the hiking, walking and biking routes you've done.",
    emoji: "🥾",
    noun: "course or trail",
  },
  landmark: {
    title: "Landmarks",
    blurb: "Famous sights and places that stuck with you.",
    emoji: "🏛️",
    noun: "landmark",
  },
  park: {
    title: "Parks",
    blurb: "City, state and national parks you've explored.",
    emoji: "🌳",
    noun: "park",
  },
};

const ROUTE_COLORS: Record<string, string> = {
  hiking: "#8a5a2b",
  walking: "#3c6e47",
  biking: "#2a81cb",
};

function emptyPlace(tag: PlaceTag, courseType: CourseType): Place {
  return {
    id: "",
    name: "",
    tags: [tag],
    courseType: tag === "course" ? courseType : "",
    city: "",
    country: "",
    lat: null,
    lng: null,
    rating: 0,
    date: null,
    notes: "",
    route: "",
    tripId: "",
    createdAt: "",
  };
}

function courseLabel(t: CourseType): string {
  const c = COURSE_TYPES.find((x) => x.id === t);
  return c ? `${c.emoji} ${c.label}` : "Course / trail";
}

/**
 * One Explore list (courses & trails, landmarks, or parks). Places carry
 * tags, so one record shows in every tab it's tagged for. With `courseType`
 * fixed it doubles as the Golf / Disc Golf course log under Sports.
 */
export function PlacesTab({
  tag,
  courseType,
  embedded = false,
}: {
  tag: PlaceTag;
  courseType?: "golf" | "disc-golf";
  embedded?: boolean; // shown under a sport header — skip our own title
}) {
  const { data, saveFields } = useApp();
  const [draft, setDraft] = useState<Place | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [filter, setFilter] = useState<CourseType | "all">("all");
  const [busy, setBusy] = useState(false);
  const copy = COPY[tag];
  const noun = courseType ? "course" : copy.noun;

  const tripName = (id: string) => data.trips.find((t) => t.id === id)?.name ?? "";

  const shown = useMemo(() => {
    const list = data.places.filter(
      (p) =>
        p.tags.includes(tag) &&
        (!courseType || p.courseType === courseType) &&
        (filter === "all" || p.courseType === filter)
    );
    return list.sort(
      (a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.name.localeCompare(b.name)
    );
  }, [data.places, tag, courseType, filter]);

  // Course-type filter chips only for types actually present.
  const typesPresent = useMemo(() => {
    if (tag !== "course" || courseType) return [];
    const have = new Set(data.places.filter((p) => p.tags.includes("course")).map((p) => p.courseType));
    return COURSE_TYPES.filter((t) => have.has(t.id));
  }, [data.places, tag, courseType]);

  const markers = useMemo<MapMarker[]>(
    () =>
      shown
        .filter((p) => p.lat != null && p.lng != null && !p.route)
        .map((p) => ({
          id: p.id,
          lat: p.lat as number,
          lng: p.lng as number,
          title: p.name,
          count: 1,
          lines: [
            p.tags.includes("course") ? courseLabel(p.courseType) : "",
            p.rating ? "★".repeat(p.rating) : "",
            [p.city, p.country].filter(Boolean).join(", "),
          ].filter(Boolean),
        })),
    [shown]
  );

  const paths = useMemo<MapPath[]>(
    () =>
      shown
        .filter((p) => p.route)
        .map((p) => {
          const points = decodePolyline(p.route);
          return {
            id: p.id,
            points,
            color: ROUTE_COLORS[p.courseType],
            title: `${p.name} · ${fmtMiles(pathKm(points))}`,
          };
        }),
    [shown]
  );

  const totalKm = useMemo(() => paths.reduce((km, p) => km + pathKm(p.points), 0), [paths]);

  function startNew() {
    setDraft(emptyPlace(tag, courseType ?? (filter === "all" ? "" : filter)));
  }

  function toggleTag(t: PlaceTag) {
    if (!draft) return;
    const tags = draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t];
    setDraft({ ...draft, tags });
  }

  async function save() {
    if (!draft || !draft.name.trim() || !draft.tags.length) return;
    setBusy(true);
    try {
      const isCourse = draft.tags.includes("course");
      const rec: Place = {
        ...draft,
        name: draft.name.trim(),
        city: draft.city.trim(),
        country: draft.country.trim(),
        notes: draft.notes.trim(),
        courseType: isCourse ? draft.courseType : "",
        route: isCourse && isRouteType(draft.courseType) ? draft.route : "",
        id: draft.id || newId(),
        createdAt: draft.createdAt || new Date().toISOString(),
      };
      // A traced route pins the place at its start.
      if (rec.route && (rec.lat == null || rec.lng == null)) {
        const [first] = decodePolyline(rec.route);
        if (first) Object.assign(rec, first);
      }
      // No pin dropped: best-effort locate from the name and town.
      if (rec.lat == null || rec.lng == null) {
        const where = [rec.city, rec.country].filter(Boolean).join(", ");
        const coords = await geocodeFirst([
          [rec.name, where].filter(Boolean).join(", "),
          where,
        ]);
        if (coords) Object.assign(rec, coords);
      }

      const exists = data.places.some((p) => p.id === rec.id);
      const places = exists
        ? data.places.map((p) => (p.id === rec.id ? rec : p))
        : [...data.places, rec];
      // Keep the linked trip stop's name & notes in step.
      const trips = rec.tripId
        ? data.trips.map((t) =>
            t.id !== rec.tripId
              ? t
              : {
                  ...t,
                  locations: t.locations.map((l) =>
                    l.placeId === rec.id ? { ...l, name: rec.name, notes: rec.notes } : l
                  ),
                }
          )
        : undefined;
      await saveFields(trips ? { places, trips } : { places });
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Place) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const places = data.places.filter((x) => x.id !== p.id);
    // The trip keeps its stop; it just stops being tagged.
    const trips = p.tripId
      ? data.trips.map((t) =>
          t.id !== p.tripId
            ? t
            : {
                ...t,
                locations: t.locations.map((l) =>
                  l.placeId === p.id ? { id: l.id, name: l.name, notes: l.notes } : l
                ),
              }
        )
      : undefined;
    await saveFields(trips ? { places, trips } : { places });
  }

  const draftIsRoute = !!draft && draft.tags.includes("course") && isRouteType(draft.courseType);
  const suggestion = draft
    ? [draft.name, draft.city, draft.country].filter((s) => s.trim()).join(", ")
    : "";

  return (
    <section className="lf-rise">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        {embedded ? (
          <p className="text-ink-soft text-[15px]">
            Courses you&apos;ve played — mapped and rated.
          </p>
        ) : (
          <div>
            <h2 className="text-4xl sm:text-5xl text-ink mb-2">{copy.title}</h2>
            <p className="text-ink-soft text-[15px]">{copy.blurb}</p>
          </div>
        )}
        {!draft && (
          <button className="btn btn-primary" onClick={startNew}>
            + Add {noun}
          </button>
        )}
      </div>

      {draft && (
        <div className="card p-5 mb-6">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="field-label">Name</label>
              <input
                className="field"
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={
                  tag === "course"
                    ? "e.g. Hyland Hills, or Minnehaha Falls loop"
                    : tag === "park"
                      ? "e.g. Yellowstone National Park"
                      : "e.g. Golden Gate Bridge"
                }
              />
            </div>

            {!courseType && (
              <div className="sm:col-span-2">
                <label className="field-label">Shows up in</label>
                <div className="flex flex-wrap gap-1.5">
                  {PLACE_TAGS.map((t) => (
                    <FilterChip key={t.id} active={draft.tags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                      {t.emoji} {t.label}
                    </FilterChip>
                  ))}
                </div>
                {!draft.tags.length && (
                  <p className="text-xs text-clay mt-1">Pick at least one.</p>
                )}
              </div>
            )}

            {draft.tags.includes("course") && !courseType && (
              <div className="sm:col-span-2">
                <label className="field-label">Kind of course / trail</label>
                <div className="flex flex-wrap gap-1.5">
                  {COURSE_TYPES.map((t) => (
                    <FilterChip
                      key={t.id}
                      active={draft.courseType === t.id}
                      onClick={() =>
                        setDraft({ ...draft, courseType: draft.courseType === t.id ? "" : t.id })
                      }
                    >
                      {t.emoji} {t.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="field-label">City</label>
              <input
                className="field"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Country / state</label>
              <input
                className="field"
                value={draft.country}
                onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Last visited</label>
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
              <label className="field-label">{draftIsRoute ? "Route you took" : "Location"}</label>
              {draftIsRoute ? (
                <RouteEditor
                  key={draft.id || "new"}
                  route={draft.route}
                  profile={draft.courseType === "biking" ? "bike" : "foot"}
                  anchor={draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null}
                  suggestion={suggestion}
                  // Re-pin at the new start whenever the route changes.
                  onChange={(route) => {
                    const [first] = route ? decodePolyline(route) : [];
                    setDraft((d) =>
                      d ? { ...d, route, lat: first?.lat ?? d.lat, lng: first?.lng ?? d.lng } : d
                    );
                  }}
                />
              ) : (
                <LocationPicker
                  value={draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null}
                  suggestion={suggestion}
                  onChange={(ll) => setDraft((d) => (d ? { ...d, lat: ll?.lat ?? null, lng: ll?.lng ?? null } : d))}
                />
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="field-label">Notes</label>
              <textarea
                className="field min-h-20"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder={courseType ? "Best score, tricky holes, who you played with…" : ""}
              />
            </div>
            {draft.tripId && (
              <p className="sm:col-span-2 text-xs text-muted">
                Part of your trip <strong>{tripName(draft.tripId)}</strong> — name and notes stay in sync with it.
              </p>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="btn btn-primary"
              disabled={busy || !draft.name.trim() || !draft.tags.length}
              onClick={save}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <Segmented
          value={view}
          options={[
            { id: "list", label: "List" },
            { id: "map", label: "Map" },
          ]}
          onChange={setView}
        />
        {typesPresent.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            {typesPresent.map((t) => (
              <FilterChip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>
                {t.emoji} {t.label}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">{courseType === "golf" ? "⛳" : courseType === "disc-golf" ? "🥏" : copy.emoji}</div>
          <p className="text-ink font-semibold">Nothing here yet</p>
          <p className="text-sm text-muted mt-1">
            Add a {noun}
            {tag !== "course" && !courseType ? ", or tag a stop on one of your vacations" : ""}.
          </p>
        </div>
      ) : view === "map" ? (
        <div className="card p-3 sm:p-4">
          {totalKm > 0 && (
            <div className="flex justify-end px-1 pb-2">
              <span className="text-xs text-muted">
                {paths.length} route{paths.length === 1 ? "" : "s"} · {fmtMiles(totalKm)} travelled
              </span>
            </div>
          )}
          {markers.length || paths.length ? (
            <MapPanel markers={markers} paths={paths} />
          ) : (
            <div className="h-[300px] rounded-2xl bg-paper-2 flex flex-col items-center justify-center text-center px-6">
              <div className="text-3xl mb-2">🗺️</div>
              <p className="text-ink font-semibold">Nothing on the map yet</p>
              <p className="text-sm text-muted mt-1">Edit an entry to drop a pin or trace its route.</p>
            </div>
          )}
        </div>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {shown.map((p) => {
            const km = p.route ? pathKm(decodePolyline(p.route)) : 0;
            const otherTags = PLACE_TAGS.filter((t) => t.id !== tag && p.tags.includes(t.id));
            return (
              <li key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{p.name}</p>
                    <p className="text-xs text-muted">
                      {[[p.city, p.country].filter(Boolean).join(", "), p.date]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {p.rating > 0 && <Stars value={p.rating} />}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.tags.includes("course") && !courseType && (
                    <span className="chip">{courseLabel(p.courseType)}</span>
                  )}
                  {km > 0 && <span className="chip">〰️ {fmtMiles(km)}</span>}
                  {otherTags.map((t) => (
                    <span key={t.id} className="chip">
                      {t.emoji} {t.label}
                    </span>
                  ))}
                  {p.tripId && tripName(p.tripId) && (
                    <span className="chip">✈️ {tripName(p.tripId)}</span>
                  )}
                </div>
                {p.notes && <p className="text-sm text-ink-soft mt-2 whitespace-pre-wrap">{p.notes}</p>}
                <div className="flex items-center gap-3 mt-3 text-xs">
                  {p.lat == null && <span className="text-muted">Not on the map</span>}
                  <button
                    className="text-terracotta hover:text-terracotta-dark ml-auto"
                    onClick={() => setDraft(p)}
                  >
                    Edit
                  </button>
                  <button className="text-muted hover:text-clay" onClick={() => remove(p)}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
