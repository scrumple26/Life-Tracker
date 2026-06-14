"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import type { Sport } from "@/lib/types";

interface Photo {
  url: string;
  caption: string;
  year: string;
}

export function PhotosTab({ sport }: { sport?: Sport }) {
  const { data } = useApp();
  const [lightbox, setLightbox] = useState<number | null>(null);

  const photos = useMemo<Photo[]>(() => {
    const out: Photo[] = [];
    const evts = sport ? data.events.filter((e) => e.sport === sport) : data.events;
    for (const e of evts) {
      const year = e.date ? e.date.slice(0, 4) : "Undated";
      const caption = [
        [e.homeTeam, e.awayTeam].filter(Boolean).join(" vs "),
        e.stadium,
      ]
        .filter(Boolean)
        .join(" · ");
      for (const url of e.photos) out.push({ url, caption, year });
    }
    return out;
  }, [data.events, sport]);

  const byYear = useMemo(() => {
    const m = new Map<string, Photo[]>();
    photos.forEach((p) => {
      if (!m.has(p.year)) m.set(p.year, []);
      m.get(p.year)!.push(p);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [photos]);

  useEffect(() => {
    if (lightbox == null) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setLightbox(null);
      if (ev.key === "ArrowRight") setLightbox((i) => (i == null ? i : (i + 1) % photos.length));
      if (ev.key === "ArrowLeft")
        setLightbox((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, photos.length]);

  // flat index for lightbox navigation
  const flat = photos;

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2">Photos</h2>
      <p className="text-ink-soft mb-6 text-[15px]">
        Every photo from your events, grouped by year.
      </p>

      {photos.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📷</div>
          <p className="text-ink font-semibold">No photos yet</p>
          <p className="text-sm text-muted mt-1">
            Add some when logging an event!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {byYear.map(([year, items]) => (
            <div key={year}>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-2xl text-terracotta">{year}</h3>
                <span className="chip">{items.length} photos</span>
                <div className="flex-1 h-px bg-line" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {items.map((p) => {
                  const idx = flat.indexOf(p);
                  return (
                    <button
                      key={p.url}
                      onClick={() => setLightbox(idx)}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-paper-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.caption}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                      {p.caption && (
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent text-white text-[11px] px-2 py-1.5 text-left opacity-0 group-hover:opacity-100 transition">
                          {p.caption}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox != null && flat[lightbox] && (
        <div
          className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-5 text-white/80 hover:text-white text-3xl"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ×
          </button>
          <button
            className="absolute left-4 text-white/80 hover:text-white text-4xl px-3"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox((i) => (i == null ? i : (i - 1 + flat.length) % flat.length));
            }}
            aria-label="Previous"
          >
            ‹
          </button>
          <figure className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flat[lightbox].url}
              alt={flat[lightbox].caption}
              className="max-h-[78vh] max-w-full object-contain rounded-xl"
            />
            {flat[lightbox].caption && (
              <figcaption className="text-white/85 text-sm mt-3 text-center">
                {flat[lightbox].caption}
              </figcaption>
            )}
          </figure>
          <button
            className="absolute right-4 text-white/80 hover:text-white text-4xl px-3"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox((i) => (i == null ? i : (i + 1) % flat.length));
            }}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}
