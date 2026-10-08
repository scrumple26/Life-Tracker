"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/data";
import { geocodeFirst, type GeoHit } from "@/lib/geo";
import {
  featureForPoint,
  loadCountries,
  loadStates,
  nearestFeature,
  normCountry,
  useGeo,
  type GeoCollection,
} from "@/lib/geojson";
import { decodePolyline, fmtMiles, pathKm } from "@/lib/route";
import {
  COURSE_TYPES,
  LANDMARK_TYPES,
  PARK_DESIGNATIONS,
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

const COPY: Record<PlaceTag, { title: string; blurb: string; noun: string }> = {
  course: {
    title: "Courses & Trails",
    blurb: "Golf and disc golf courses, plus the hiking, walking and biking routes you've done.",
    noun: "course or trail",
  },
  landmark: {
    title: "Landmarks",
    blurb: "Famous sights and places that stuck with you.",
    noun: "landmark",
  },
  park: {
    title: "Parks",
    blurb: "City, state and national parks you've explored.",
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
    landmarkTypes: [],
    parkDesignation: "",
    city: "",
    state: "",
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

interface StadiumLandmark {
  name: string;
  address: string;
  games: number;
  lastDate: string | null;
  lat: number | null;
  lng: number | null;
}

function courseLabel(t: CourseType): string {
  const c = COURSE_TYPES.find((x) => x.id === t);
  return c ? c.label : "Course / trail";
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
  const [typeFilter, setTypeFilter] = useState("all"); // landmark type or park designation
  const [newType, setNewType] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = COPY[tag];
  // State/country outlines, for grouping entries whose location is only a pin.
  const states = useGeo(loadStates, view === "list");
  const countries = useGeo(loadCountries, view === "list");
  const geo = { states, countries };
  const noun = courseType ? "course" : copy.noun;

  const tripName = (id: string) => data.trips.find((t) => t.id === id)?.name ?? "";

  const shown = useMemo(() => {
    const list = data.places.filter(
      (p) =>
        p.tags.includes(tag) &&
        (!courseType || p.courseType === courseType) &&
        (filter === "all" || p.courseType === filter) &&
        (typeFilter === "all" ||
          (tag === "landmark" && p.landmarkTypes.includes(typeFilter)) ||
          (tag === "park" && p.parkDesignation === typeFilter))
    );
    return list.sort(
      (a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.name.localeCompare(b.name)
    );
  }, [data.places, tag, courseType, filter, typeFilter]);

  // Landmark types: the presets plus any the user has made up.
  const allLandmarkTypes = useMemo(() => {
    const custom = data.places.flatMap((p) => p.landmarkTypes).filter((t) => !LANDMARK_TYPES.includes(t));
    return [...LANDMARK_TYPES, ...new Set(custom)];
  }, [data.places]);

  // Course-type filter chips only for types actually present.
  const typesPresent = useMemo(() => {
    if (tag !== "course" || courseType) return [];
    const have = new Set(data.places.filter((p) => p.tags.includes("course")).map((p) => p.courseType));
    return COURSE_TYPES.filter((t) => have.has(t.id));
  }, [data.places, tag, courseType]);

  // With "Count stadiums as landmarks" on, venues from logged games join the
  // Landmarks list (read-only — they're edited through their games). A venue
  // already saved as a landmark by name isn't listed twice.
  const stadiums = useMemo<StadiumLandmark[]>(() => {
    if (tag !== "landmark" || courseType || !data.settings.stadiumsAsLandmarks) return [];
    if (typeFilter !== "all" && typeFilter !== "Stadium") return [];
    const saved = new Set(shown.map((p) => p.name.trim().toLowerCase()));
    const byName = new Map<string, StadiumLandmark>();
    for (const e of data.events) {
      const name = e.stadium.trim();
      if (!name || saved.has(name.toLowerCase())) continue;
      const key = name.toLowerCase();
      const s =
        byName.get(key) ??
        { name, address: e.address, games: 0, lastDate: null, lat: null, lng: null };
      s.games += 1;
      if (e.date && (!s.lastDate || e.date > s.lastDate)) s.lastDate = e.date;
      if (s.lat == null && e.lat != null && e.lng != null) Object.assign(s, { lat: e.lat, lng: e.lng });
      if (!s.address) s.address = e.address;
      byName.set(key, s);
    }
    return [...byName.values()].sort(
      (a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? "") || a.name.localeCompare(b.name)
    );
  }, [tag, courseType, typeFilter, data.settings.stadiumsAsLandmarks, data.events, shown]);

  // Filter chips (landmark types / park designations) — only ones in use here.
  const typesInUse = useMemo(() => {
    if (courseType) return [];
    const mine = data.places.filter((p) => p.tags.includes(tag));
    if (tag === "park") {
      const used = new Set(mine.map((p) => p.parkDesignation));
      return PARK_DESIGNATIONS.filter((d) => used.has(d));
    }
    if (tag !== "landmark") return [];
    const used = new Set(mine.flatMap((p) => p.landmarkTypes));
    if (data.settings.stadiumsAsLandmarks && data.events.some((e) => e.stadium.trim())) used.add("Stadium");
    return allLandmarkTypes.filter((t) => used.has(t));
  }, [tag, courseType, data.places, data.events, data.settings.stadiumsAsLandmarks, allLandmarkTypes]);

  const markers = useMemo<MapMarker[]>(
    () => [
      ...shown
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
            [p.city, p.state, p.country].filter(Boolean).join(", "),
          ].filter(Boolean),
        })),
      ...stadiums
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({
          id: `stadium:${s.name}`,
          lat: s.lat as number,
          lng: s.lng as number,
          title: s.name,
          count: 1,
          lines: ["Stadium", `${s.games} game${s.games === 1 ? "" : "s"}`],
        })),
    ],
    [shown, stadiums]
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

  function toggleLandmarkType(t: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            landmarkTypes: d.landmarkTypes.includes(t)
              ? d.landmarkTypes.filter((x) => x !== t)
              : [...d.landmarkTypes, t],
          }
        : d
    );
  }

  function addCustomType() {
    const t = newType.trim();
    if (!t) return;
    const existing = allLandmarkTypes.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t;
    setDraft((d) =>
      d && !d.landmarkTypes.includes(existing) ? { ...d, landmarkTypes: [...d.landmarkTypes, existing] } : d
    );
    setNewType("");
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
        state: draft.state.trim(),
        country: draft.country.trim(),
        notes: draft.notes.trim(),
        courseType: isCourse ? draft.courseType : "",
        landmarkTypes: draft.tags.includes("landmark") ? draft.landmarkTypes : [],
        parkDesignation: draft.tags.includes("park") ? draft.parkDesignation : "",
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
        const where = [rec.city, rec.state, rec.country].filter(Boolean).join(", ");
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

  // Picking a search result fills in where it is.
  function fillFromSearch(hit: GeoHit) {
    setDraft((d) =>
      d
        ? {
            ...d,
            city: hit.city || d.city,
            state: hit.state || d.state,
            country: hit.country || d.country,
          }
        : d
    );
  }

  const draftIsRoute = !!draft && draft.tags.includes("course") && isRouteType(draft.courseType);
  const suggestion = draft
    ? [draft.name, draft.city, draft.state, draft.country].filter((s) => s.trim()).join(", ")
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
                      {t.label}
                    </FilterChip>
                  ))}
                </div>
                {!draft.tags.length && (
                  <p className="text-xs text-clay mt-1">Pick at least one.</p>
                )}
              </div>
            )}

            {draft.tags.includes("landmark") && !courseType && (
              <div className="sm:col-span-2">
                <label className="field-label">Type of landmark</label>
                <div className="flex flex-wrap gap-1.5">
                  {allLandmarkTypes.map((t) => (
                    <FilterChip key={t} active={draft.landmarkTypes.includes(t)} onClick={() => toggleLandmarkType(t)}>
                      {t}
                    </FilterChip>
                  ))}
                </div>
                <div className="flex gap-2 mt-2 max-w-sm">
                  <input
                    className="field"
                    value={newType}
                    placeholder="Add your own type…"
                    onChange={(e) => setNewType(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomType();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomType}>
                    Add
                  </button>
                </div>
              </div>
            )}

            {draft.tags.includes("park") && !courseType && (
              <div className="sm:col-span-2">
                <label className="field-label">Park designation</label>
                <div className="flex flex-wrap gap-1.5">
                  {PARK_DESIGNATIONS.map((d) => (
                    <FilterChip
                      key={d}
                      active={draft.parkDesignation === d}
                      onClick={() => setDraft({ ...draft, parkDesignation: draft.parkDesignation === d ? "" : d })}
                    >
                      {d}
                    </FilterChip>
                  ))}
                </div>
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
                      {t.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="field-label">{draftIsRoute ? "Route you took" : "Location"}</label>
              {draftIsRoute ? (
                <RouteEditor
                  key={draft.id || "new"}
                  route={draft.route}
                  profile={draft.courseType === "biking" ? "bike" : "foot"}
                  anchor={draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null}
                  suggestion={suggestion}
                  onPickPlace={fillFromSearch}
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
                  onPickPlace={fillFromSearch}
                  onChange={(ll) => setDraft((d) => (d ? { ...d, lat: ll?.lat ?? null, lng: ll?.lng ?? null } : d))}
                />
              )}
            </div>

            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="field-label">City</label>
                <input
                  className="field"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">State</label>
                <input
                  className="field"
                  value={draft.state}
                  onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Country</label>
                <input
                  className="field"
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                />
              </div>
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
        {typesInUse.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
              All
            </FilterChip>
            {typesInUse.map((t) => (
              <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                {t}
              </FilterChip>
            ))}
          </div>
        )}
        {typesPresent.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            {typesPresent.map((t) => (
              <FilterChip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>
                {t.label}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 && stadiums.length === 0 ? (
        <div className="card p-10 text-center">
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
              <p className="text-ink font-semibold">Nothing on the map yet</p>
              <p className="text-sm text-muted mt-1">Edit an entry to drop a pin or trace its route.</p>
            </div>
          )}
        </div>
      ) : (
        <LocationGroups
          items={[
            ...shown.map((p) => ({ id: p.id, ...whereIs(p, geo), node: renderPlace(p) })),
            ...stadiums.map((s) => ({ id: `stadium:${s.name}`, ...whereIs(s, geo), node: renderStadium(s) })),
          ]}
        />
      )}
    </section>
  );

  function renderPlace(p: Place) {
            const km = p.route ? pathKm(decodePolyline(p.route)) : 0;
            const otherTags = PLACE_TAGS.filter((t) => t.id !== tag && p.tags.includes(t.id));
            return (
              <li key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{p.name}</p>
                    <p className="text-xs text-muted">
                      {[[p.city, p.state, p.country].filter(Boolean).join(", "), p.date]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {p.rating > 0 && <Stars value={p.rating} />}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tag === "park" && p.parkDesignation && (
                    <span className="chip">{p.parkDesignation}</span>
                  )}
                  {tag === "landmark" &&
                    p.landmarkTypes.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  {p.tags.includes("course") && !courseType && (
                    <span className="chip">{courseLabel(p.courseType)}</span>
                  )}
                  {km > 0 && <span className="chip">{fmtMiles(km)}</span>}
                  {otherTags.map((t) => (
                    <span key={t.id} className="chip">
                      {t.label}
                    </span>
                  ))}
                  {p.tripId && tripName(p.tripId) && (
                    <span className="chip">Trip: {tripName(p.tripId)}</span>
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
  }

  function renderStadium(s: StadiumLandmark) {
    return (
            <li key={`stadium:${s.name}`} className="card p-4">
              <p className="font-semibold text-ink truncate">{s.name}</p>
              <p className="text-xs text-muted">
                {[s.address, s.lastDate && `last visit ${s.lastDate}`].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip">Stadium</span>
                <span className="chip">
                  {s.games} game{s.games === 1 ? "" : "s"}
                </span>
              </div>
              {s.lat == null && <p className="text-xs text-muted mt-3">Not on the map</p>}
            </li>
    );
  }
}

// ── Grouping by country → state ─────────────────────────────────────────

const NO_LOCATION = "Location not set";

/**
 * Country and state for grouping. Typed values win; otherwise the pin is
 * looked up in the state/country outlines (stadiums from games only have a
 * free-text address, and older places may have no state).
 */
function whereIs(
  item: { lat: number | null; lng: number | null; country?: string; state?: string },
  geo: { states: GeoCollection | null; countries: GeoCollection | null }
): { country: string; state: string } {
  let country = (item.country ?? "").trim();
  let state = (item.state ?? "").trim();
  if (item.lat != null && item.lng != null && (!country || !state)) {
    const { lat, lng } = item;
    const usState = geo.states ? featureForPoint(lat, lng, geo.states) : null;
    if (usState && (!country || normCountry(country) === "usa")) {
      country = "USA";
      state ||= usState;
    } else {
      if (!country && geo.countries) country = featureForPoint(lat, lng, geo.countries) ?? "";
      // Off every state outline (over water, an island) but not in another
      // country: take the nearest state.
      if ((!country || normCountry(country) === "usa") && !state && geo.states) {
        const near = nearestFeature(lat, lng, geo.states);
        if (near) {
          country = "USA";
          state = near;
        }
      }
    }
  }
  if (normCountry(country) === "usa") country = "USA";
  return { country: country || NO_LOCATION, state };
}

/** Countries (USA first) that each open into states; items without a state sit directly under their country. */
function LocationGroups({
  items,
}: {
  items: { id: string; country: string; state: string; node: React.ReactNode }[];
}) {
  const [closedCountries, setClosedCountries] = useState<Set<string>>(new Set());
  const [openStates, setOpenStates] = useState<Set<string>>(new Set());
  const flip = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const countries = new Map<string, Map<string, typeof items>>();
  for (const it of items) {
    const states = countries.get(it.country) ?? new Map<string, typeof items>();
    states.set(it.state, [...(states.get(it.state) ?? []), it]);
    countries.set(it.country, states);
  }
  const rankCountry = (c: string) => (c === "USA" ? 0 : c === NO_LOCATION ? 2 : 1);
  const countryNames = [...countries.keys()].sort(
    (a, b) => rankCountry(a) - rankCountry(b) || a.localeCompare(b)
  );

  return (
    <div className="grid gap-3">
      {countryNames.map((country) => {
        const states = countries.get(country)!;
        const total = [...states.values()].reduce((n, l) => n + l.length, 0);
        const open = !closedCountries.has(country);
        const named = [...states.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b));
        const loose = states.get("") ?? [];
        return (
          <section key={country} className="rounded-2xl border border-line bg-paper-2/40">
            <button
              type="button"
              onClick={() => setClosedCountries((s) => flip(s, country))}
              aria-expanded={open}
              className="w-full flex items-center gap-2 px-4 py-3 text-left"
            >
              <span className="flex-1 font-semibold text-ink">{country}</span>
              <span className="text-xs text-muted">
                {total} place{total === 1 ? "" : "s"}
              </span>
              <span className="text-xs text-terracotta w-10 text-right">{open ? "Hide" : "Show"}</span>
            </button>
            {open && (
              <div className="px-3 pb-3 grid gap-2">
                {named.map((state) => {
                  const key = `${country}|${state}`;
                  const list = states.get(state)!;
                  const stateOpen = openStates.has(key);
                  return (
                    <div key={key} className="rounded-xl border border-line bg-card">
                      <button
                        type="button"
                        onClick={() => setOpenStates((s) => flip(s, key))}
                        aria-expanded={stateOpen}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                      >
                        <span className="flex-1 text-sm font-medium text-ink">{state}</span>
                        <span className="text-xs text-muted">{list.length}</span>
                        <span className="text-xs text-terracotta w-10 text-right">
                          {stateOpen ? "Hide" : "Open"}
                        </span>
                      </button>
                      {stateOpen && (
                        <ul className="grid gap-2.5 sm:grid-cols-2 px-2.5 pb-2.5">
                          {list.map((it) => it.node)}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {loose.length > 0 && (
                  <ul className="grid gap-2.5 sm:grid-cols-2">{loose.map((it) => it.node)}</ul>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
