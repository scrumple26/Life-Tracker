"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/data";
import type { Restaurant } from "@/lib/types";
import { Stars } from "../Stars";

function emptyDraft(): Restaurant {
  return {
    id: "",
    name: "",
    categoryId: "",
    cuisine: "",
    rating: 0,
    city: "",
    country: "",
    dish: "",
    notes: "",
    date: null,
    createdAt: "",
  };
}

export function RestaurantsTab() {
  const { data, saveField } = useApp();
  const [draft, setDraft] = useState<Restaurant | null>(null);
  const [filter, setFilter] = useState<string>("all"); // "all" | categoryId
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);

  const catName = (id: string) =>
    data.restCategories.find((c) => c.id === id)?.name ?? "";

  const shown = useMemo(() => {
    const list =
      filter === "all"
        ? data.restaurants
        : data.restaurants.filter((r) => r.categoryId === filter);
    return [...list].sort(
      (a, b) => b.rating - a.rating || a.name.localeCompare(b.name)
    );
  }, [data.restaurants, filter]);

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    try {
      const rec: Restaurant = {
        ...draft,
        name: draft.name.trim(),
        id: draft.id || newId(),
        createdAt: draft.createdAt || new Date().toISOString(),
      };
      const exists = data.restaurants.some((r) => r.id === rec.id);
      const next = exists
        ? data.restaurants.map((r) => (r.id === rec.id ? rec : r))
        : [...data.restaurants, rec];
      await saveField("restaurants", next);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await saveField(
      "restaurants",
      data.restaurants.filter((r) => r.id !== id)
    );
  }

  async function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    const cat = { id: newId(), name };
    await saveField("restCategories", [...data.restCategories, cat]);
    setNewCat("");
    if (draft) setDraft({ ...draft, categoryId: cat.id });
  }

  return (
    <section className="lf-rise">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-4xl sm:text-5xl text-ink mb-2">Restaurants</h2>
          <p className="text-ink-soft text-[15px]">
            Places you&apos;ve loved, what you ordered, and how they rated.
          </p>
        </div>
        {!draft && (
          <button className="btn btn-primary" onClick={() => setDraft(emptyDraft())}>
            + Add place
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
                placeholder="e.g. Trattoria da Enzo"
              />
            </div>
            <div>
              <label className="field-label">Category</label>
              <select
                className="field"
                value={draft.categoryId}
                onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
              >
                <option value="">Uncategorized</option>
                {data.restCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <input
                  className="field"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                  placeholder="New category…"
                />
                <button className="btn btn-ghost btn-sm" onClick={addCategory}>
                  Add
                </button>
              </div>
            </div>
            <div>
              <label className="field-label">Cuisine</label>
              <input
                className="field"
                value={draft.cuisine}
                onChange={(e) => setDraft({ ...draft, cuisine: e.target.value })}
                placeholder="Italian, Thai, …"
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
              <label className="field-label">Country</label>
              <input
                className="field"
                value={draft.country}
                onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Standout dish</label>
              <input
                className="field"
                value={draft.dish}
                onChange={(e) => setDraft({ ...draft, dish: e.target.value })}
                placeholder="Cacio e pepe"
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
            <div className="sm:col-span-2">
              <label className="field-label">Rating</label>
              <Stars
                value={draft.rating}
                size={26}
                onChange={(n) => setDraft({ ...draft, rating: n })}
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
            <button className="btn btn-primary" disabled={busy || !draft.name.trim()} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {data.restCategories.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterChip>
          {data.restCategories.map((c) => (
            <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.name}
            </FilterChip>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🍝</div>
          <p className="text-ink font-semibold">No places yet</p>
          <p className="text-sm text-muted mt-1">Add a restaurant to start your list.</p>
        </div>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{r.name}</p>
                  <p className="text-xs text-muted">
                    {[r.cuisine, [r.city, r.country].filter(Boolean).join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {r.categoryId && <span className="chip shrink-0">{catName(r.categoryId)}</span>}
              </div>
              {r.rating > 0 && (
                <div className="mt-2">
                  <Stars value={r.rating} />
                </div>
              )}
              {r.dish && (
                <p className="text-sm text-ink-soft mt-2">
                  <span className="text-muted">Dish:</span> {r.dish}
                </p>
              )}
              {r.notes && <p className="text-sm text-ink-soft mt-1">{r.notes}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs">
                {r.date && <span className="text-muted">{r.date}</span>}
                <button
                  className="text-terracotta hover:text-terracotta-dark ml-auto"
                  onClick={() => setDraft(r)}
                >
                  Edit
                </button>
                <button className="text-muted hover:text-clay" onClick={() => remove(r.id)}>
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${
        active
          ? "bg-terracotta text-white"
          : "bg-paper-2 text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
