"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/data";
import { geocodeFirst, type GeoHit } from "@/lib/geo";
import {
  COURSE_TYPES,
  LANDMARK_TYPES,
  PARK_DESIGNATIONS,
  SPORT_PRESETS,
  sportLabel,
  type CourseType,
  type Place,
  type PlaceTag,
  type WishCategory,
  type WishItem,
} from "@/lib/types";
import { FilterChip, Segmented } from "../FilterChip";
import { MapPanel, type MapMarker } from "../Map";
import { LocationPicker } from "../PlaceMapEditor";

interface CategoryDef {
  id: WishCategory;
  label: string;
  noun: string; // "place", "park"… for placeholders
  kinds: string[];
  placeTag?: PlaceTag; // visiting one can add it to that Explore tab
  placeTab?: string; // that tab's name
  placeholder: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "travel",
    label: "Travel",
    noun: "destination",
    kinds: ["City", "State / Region", "Country", "Other"],
    placeholder: "e.g. Lisbon, or Iceland",
  },
  {
    id: "landmarks",
    label: "Landmarks",
    noun: "landmark",
    kinds: LANDMARK_TYPES,
    placeTag: "landmark",
    placeTab: "Landmarks",
    placeholder: "e.g. Eiffel Tower",
  },
  {
    id: "parks",
    label: "Parks",
    noun: "park",
    kinds: PARK_DESIGNATIONS,
    placeTag: "park",
    placeTab: "Parks",
    placeholder: "e.g. Glacier National Park",
  },
  {
    id: "courses",
    label: "Courses & Trails",
    noun: "course or trail",
    kinds: COURSE_TYPES.map((c) => c.label),
    placeTag: "course",
    placeTab: "Courses & Trails",
    placeholder: "e.g. Pebble Beach, or the Superior Hiking Trail",
  },
  {
    id: "sports",
    label: "Sports",
    noun: "sports wish",
    kinds: ["Stadium", "Team", "Player", "Game / Event", "Other"],
    placeholder: "e.g. Wrigley Field, or see Messi play",
  },
  {
    id: "restaurants",
    label: "Restaurants",
    noun: "restaurant",
    kinds: [],
    placeholder: "e.g. Franklin Barbecue",
  },
  {
    id: "events",
    label: "Events",
    noun: "event",
    kinds: ["Concert", "Festival", "Show", "Movie", "Other"],
    placeholder: "e.g. Glastonbury, or see Taylor Swift",
  },
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<WishCategory, CategoryDef>;

// Travel is grouped by kind, sports by sport; the rest are one sorted list.
function subgroupOf(w: WishItem): string {
  if (w.category === "sports") return w.sport || "Any sport";
  if (w.category === "travel") return w.kind || "Other";
  return "";
}

function emptyWish(category: WishCategory): WishItem {
  return {
    id: "",
    category,
    kind: "",
    sport: "",
    name: "",
    city: "",
    state: "",
    country: "",
    lat: null,
    lng: null,
    notes: "",
    topPick: false,
    done: false,
    doneDate: null,
    createdAt: "",
  };
}

const byPriority = (a: WishItem, b: WishItem) =>
  Number(b.topPick) - Number(a.topPick) || a.name.localeCompare(b.name);

const today = () => new Date().toISOString().slice(0, 10);

export function WishlistTab() {
  const { data, saveField, saveFields } = useApp();
  const [filter, setFilter] = useState<WishCategory | "all">("all");
  const [view, setView] = useState<"list" | "map">("list");
  const [draft, setDraft] = useState<WishItem | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = useMemo(() => data.wishlist.filter((w) => !w.done), [data.wishlist]);
  const done = useMemo(
    () =>
      data.wishlist
        .filter((w) => w.done && (filter === "all" || w.category === filter))
        .sort((a, b) => (b.doneDate ?? "").localeCompare(a.doneDate ?? "")),
    [data.wishlist, filter]
  );
  const counts = useMemo(() => {
    const m = new Map<WishCategory, number>();
    for (const w of open) m.set(w.category, (m.get(w.category) ?? 0) + 1);
    return m;
  }, [open]);

  // Sections: one per category (in the fixed order), each split into subgroups.
  const sections = useMemo(() => {
    return CATEGORIES.filter((c) => filter === "all" || c.id === filter)
      .map((c) => {
        const items = open.filter((w) => w.category === c.id);
        const groups = new Map<string, WishItem[]>();
        for (const w of items) groups.set(subgroupOf(w), [...(groups.get(subgroupOf(w)) ?? []), w]);
        const order = c.id === "travel" ? c.kinds : null;
        const names = [...groups.keys()].sort((a, b) =>
          order ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b)
        );
        return { cat: c, total: items.length, groups: names.map((g) => ({ name: g, items: groups.get(g)!.sort(byPriority) })) };
      })
      .filter((s) => s.total > 0);
  }, [open, filter]);

  const markers = useMemo<MapMarker[]>(
    () =>
      open
        .filter((w) => (filter === "all" || w.category === filter) && w.lat != null && w.lng != null)
        .map((w) => ({
          id: w.id,
          lat: w.lat as number,
          lng: w.lng as number,
          title: w.name,
          count: 1,
          lines: [
            [CAT[w.category].label, w.sport, w.kind].filter(Boolean).join(" · "),
            w.topPick ? "Top pick" : "",
            [w.city, w.state, w.country].filter(Boolean).join(", "),
          ].filter(Boolean),
        })),
    [open, filter]
  );

  const sportOptions = useMemo(() => {
    const logged = data.events.map((e) => sportLabel(e.sport));
    const wished = data.wishlist.map((w) => w.sport).filter(Boolean);
    return [...new Set([...SPORT_PRESETS.map(sportLabel), ...logged, ...wished])];
  }, [data.events, data.wishlist]);

  async function saveWishlist(next: WishItem[]) {
    await saveField("wishlist", next);
  }

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    try {
      const rec: WishItem = {
        ...draft,
        name: draft.name.trim(),
        sport: draft.category === "sports" ? draft.sport.trim() : "",
        city: draft.city.trim(),
        state: draft.state.trim(),
        country: draft.country.trim(),
        notes: draft.notes.trim(),
        id: draft.id || newId(),
        createdAt: draft.createdAt || new Date().toISOString(),
      };
      // Locate it from the typed place if no pin was dropped (not for teams/players).
      const where = [rec.city, rec.state, rec.country].filter(Boolean).join(", ");
      if (rec.lat == null && wantsLocation(rec) && (where || rec.category === "travel")) {
        const coords = await geocodeFirst([[rec.name, where].filter(Boolean).join(", "), where]);
        if (coords) Object.assign(rec, coords);
      }
      const exists = data.wishlist.some((w) => w.id === rec.id);
      await saveWishlist(
        exists ? data.wishlist.map((w) => (w.id === rec.id ? rec : w)) : [...data.wishlist, rec]
      );
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function setDone(w: WishItem, isDone: boolean) {
    await saveWishlist(
      data.wishlist.map((x) =>
        x.id === w.id ? { ...x, done: isDone, doneDate: isDone ? today() : null } : x
      )
    );
  }

  // Visited a wished-for landmark/park/course: log it there and tick it off.
  async function visit(w: WishItem) {
    const cat = CAT[w.category];
    if (!cat.placeTag) return;
    const courseType = (COURSE_TYPES.find((c) => c.label === w.kind)?.id ?? "") as CourseType;
    const place: Place = {
      id: newId(),
      name: w.name,
      tags: [cat.placeTag],
      courseType: cat.placeTag === "course" ? courseType : "",
      landmarkTypes: cat.placeTag === "landmark" && w.kind ? [w.kind] : [],
      parkDesignation: cat.placeTag === "park" ? w.kind : "",
      city: w.city,
      state: w.state,
      country: w.country,
      lat: w.lat,
      lng: w.lng,
      rating: 0,
      date: today(),
      notes: w.notes,
      route: "",
      tripId: "",
      createdAt: new Date().toISOString(),
    };
    await saveFields({
      places: [...data.places, place],
      wishlist: data.wishlist.map((x) => (x.id === w.id ? { ...x, done: true, doneDate: today() } : x)),
    });
  }

  async function remove(w: WishItem) {
    if (!confirm(`Remove "${w.name}" from your wishlist?`)) return;
    await saveWishlist(data.wishlist.filter((x) => x.id !== w.id));
  }

  const newCategory = filter === "all" ? "travel" : filter;

  return (
    <section className="lf-rise">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-4xl sm:text-5xl text-ink mb-2">Wishlist</h2>
          <p className="text-ink-soft text-[15px]">
            Places to go, things to see, games to catch — someday.
          </p>
        </div>
        {!draft && (
          <button className="btn btn-primary" onClick={() => setDraft(emptyWish(newCategory))}>
            + Add to wishlist
          </button>
        )}
      </div>

      {draft && (
        <WishForm
          draft={draft}
          setDraft={setDraft}
          sportOptions={sportOptions}
          busy={busy}
          onSave={save}
          onCancel={() => setDraft(null)}
        />
      )}

      <div className="flex gap-1.5 flex-wrap mb-4">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All · {open.length}
        </FilterChip>
        {CATEGORIES.filter((c) => counts.get(c.id) || filter === c.id).map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.label} · {counts.get(c.id) ?? 0}
          </FilterChip>
        ))}
      </div>

      <div className="mb-5">
        <Segmented
          value={view}
          options={[
            { id: "list", label: "List" },
            { id: "map", label: "Map" },
          ]}
          onChange={setView}
        />
      </div>

      {view === "map" ? (
        <div className="card p-3 sm:p-4">
          {markers.length ? (
            <MapPanel markers={markers} />
          ) : (
            <div className="h-[300px] rounded-2xl bg-paper-2 flex flex-col items-center justify-center text-center px-6">
              <p className="text-ink font-semibold">Nothing on the map yet</p>
              <p className="text-sm text-muted mt-1">Wishes with a location show up here.</p>
            </div>
          )}
        </div>
      ) : sections.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-ink font-semibold">Your wishlist is empty</p>
          <p className="text-sm text-muted mt-1">
            Add a city to visit, a park to hike, a stadium to see a game in…
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {sections.map((s) => (
            <section key={s.cat.id}>
              {filter === "all" && (
                <h3 className="text-2xl text-ink mb-3 flex items-baseline gap-2">
                  {s.cat.label}
                  <span className="text-sm font-sans font-normal text-muted">{s.total}</span>
                </h3>
              )}
              <div className="grid gap-4">
                {s.groups.map((g) => (
                  <div key={g.name || "all"}>
                    {g.name && <p className="overline mb-2">{g.name}</p>}
                    <ul className="grid gap-2.5 sm:grid-cols-2">
                      {g.items.map((w) => (
                        <WishCard
                          key={w.id}
                          w={w}
                          onEdit={() => setDraft(w)}
                          onDone={() => setDone(w, true)}
                          onVisit={CAT[w.category].placeTag ? () => visit(w) : undefined}
                          onRemove={() => remove(w)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {view === "list" && done.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            className="text-sm font-semibold text-ink-soft hover:text-ink"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
          >
            Done · {done.length} {showDone ? "(hide)" : "(show)"}
          </button>
          {showDone && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {done.map((w) => (
                <li key={w.id} className="card p-3 flex items-center gap-3 opacity-80">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate line-through decoration-line-strong">
                      {w.name}
                    </p>
                    <p className="text-xs text-muted">
                      {[CAT[w.category].label, w.doneDate && `done ${w.doneDate}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button className="text-xs text-terracotta hover:text-terracotta-dark" onClick={() => setDone(w, false)}>
                    Undo
                  </button>
                  <button className="text-xs text-muted hover:text-clay" onClick={() => remove(w)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// Teams and players don't have a fixed spot worth mapping.
function wantsLocation(w: WishItem): boolean {
  return !(w.category === "sports" && (w.kind === "Team" || w.kind === "Player"));
}

function WishCard({
  w,
  onEdit,
  onDone,
  onVisit,
  onRemove,
}: {
  w: WishItem;
  onEdit: () => void;
  onDone: () => void;
  onVisit?: () => void;
  onRemove: () => void;
}) {
  const where = [w.city, w.state, w.country].filter(Boolean).join(", ");
  const cat = CAT[w.category];
  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink min-w-0 truncate">{w.name}</p>
        {w.topPick && <span className="chip shrink-0">Top pick</span>}
      </div>
      <p className="text-xs text-muted mt-0.5">
        {/* Travel's kind is already its subgroup heading. */}
        {[w.category === "travel" ? "" : w.kind, where].filter(Boolean).join(" · ")}
      </p>
      {w.notes && <p className="text-sm text-ink-soft mt-2 whitespace-pre-wrap">{w.notes}</p>}
      <div className="flex items-center gap-3 mt-3 text-xs flex-wrap">
        {onVisit ? (
          <button className="font-semibold text-terracotta hover:text-terracotta-dark" onClick={onVisit}>
            Visited — add to {cat.placeTab}
          </button>
        ) : (
          <button className="font-semibold text-terracotta hover:text-terracotta-dark" onClick={onDone}>
            Mark done
          </button>
        )}
        {onVisit && (
          <button className="text-ink-soft hover:text-ink" onClick={onDone}>
            Just mark done
          </button>
        )}
        <button className="text-terracotta hover:text-terracotta-dark ml-auto" onClick={onEdit}>
          Edit
        </button>
        <button className="text-muted hover:text-clay" onClick={onRemove}>
          Delete
        </button>
      </div>
    </li>
  );
}

function WishForm({
  draft,
  setDraft,
  sportOptions,
  busy,
  onSave,
  onCancel,
}: {
  draft: WishItem;
  setDraft: React.Dispatch<React.SetStateAction<WishItem | null>>;
  sportOptions: string[];
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const cat = CAT[draft.category];
  const set = (patch: Partial<WishItem>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const fill = (hit: GeoHit) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            city: hit.city || d.city,
            state: hit.state || d.state,
            country: hit.country || d.country,
            // Wishing for "Portugal": the search result is the place itself.
            name: d.name.trim() ? d.name : hit.label.split(",")[0],
          }
        : d
    );

  return (
    <div className="card p-5 mb-6">
      <div className="grid gap-4">
        <div>
          <label className="field-label">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c.id}
                active={draft.category === c.id}
                onClick={() => set({ category: c.id, kind: "" })}
              >
                {c.label}
              </FilterChip>
            ))}
          </div>
        </div>

        {draft.category === "sports" && (
          <div className="max-w-sm">
            <label className="field-label">Sport</label>
            <input
              className="field"
              list="wish-sports"
              value={draft.sport}
              placeholder="e.g. Baseball"
              onChange={(e) => set({ sport: e.target.value })}
            />
            <datalist id="wish-sports">
              {sportOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        )}

        {cat.kinds.length > 0 && (
          <div>
            <label className="field-label">
              {draft.category === "parks" ? "Designation" : draft.category === "sports" ? "What" : "Type"}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {cat.kinds.map((k) => (
                <FilterChip key={k} active={draft.kind === k} onClick={() => set({ kind: draft.kind === k ? "" : k })}>
                  {k}
                </FilterChip>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="field-label">Name</label>
          <input
            className="field"
            autoFocus
            value={draft.name}
            placeholder={cat.placeholder}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>

        {wantsLocation(draft) && (
          <div>
            <label className="field-label">Location (optional)</label>
            <LocationPicker
              value={draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null}
              suggestion={[draft.name, draft.city, draft.state, draft.country].filter((s) => s.trim()).join(", ")}
              onPickPlace={fill}
              onChange={(ll) => set({ lat: ll?.lat ?? null, lng: ll?.lng ?? null })}
            />
            <div className="grid gap-3 sm:grid-cols-3 mt-3">
              {(["city", "state", "country"] as const).map((k) => (
                <div key={k}>
                  <label className="field-label capitalize">{k}</label>
                  <input className="field" value={draft[k]} onChange={(e) => set({ [k]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="field-label">Notes</label>
          <textarea
            className="field min-h-20"
            value={draft.notes}
            placeholder="Why it's on the list, best time to go…"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={draft.topPick} onChange={(e) => set({ topPick: e.target.checked })} />
          Top pick — keep it at the top of its list
        </label>
      </div>
      <div className="flex gap-2 mt-5">
        <button className="btn btn-primary" disabled={busy || !draft.name.trim()} onClick={onSave}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
