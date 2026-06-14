"use client";

import { useMemo, useState } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { newId, useApp } from "@/lib/data";
import { geocode } from "@/lib/geo";
import {
  SPORT_LABELS,
  type Scorer,
  type Sport,
  type SportEvent,
} from "@/lib/types";
import { EventCard } from "../EventCard";

const SPORTS = Object.keys(SPORT_LABELS) as Sport[];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function LogEventTab({ sport: filterSport }: { sport?: Sport }) {
  const { user, data, saveEvents } = useApp();

  // ── form state ──
  const [date, setDate] = useState(todayISO());
  const [dateUnknown, setDateUnknown] = useState(false);
  const [sport, setSport] = useState<Sport>(filterSport ?? "soccer");

  // Match the form's sport to the active filter when it changes (adjust
  // state during render — the React-recommended alternative to an effect).
  const [prevFilter, setPrevFilter] = useState(filterSport);
  if (filterSport && filterSport !== prevFilter) {
    setPrevFilter(filterSport);
    setSport(filterSport);
  }
  const [side, setSide] = useState<SportEvent["side"]>("home");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [competition, setCompetition] = useState("");
  const [pensOn, setPensOn] = useState(false);
  const [penHome, setPenHome] = useState("");
  const [penAway, setPenAway] = useState("");
  const [stadium, setStadium] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [scName, setScName] = useState("");
  const [scSide, setScSide] = useState<"home" | "away">("home");
  const [scMin, setScMin] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const isSoccer = sport === "soccer";

  const previews = useMemo(
    () => photos.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [photos]
  );

  function addScorer() {
    if (!scName.trim()) return;
    setScorers((s) => [...s, { name: scName.trim(), team: scSide, minute: scMin.trim() || undefined }]);
    setScName("");
    setScMin("");
  }

  function resetForm() {
    setDate(todayISO());
    setDateUnknown(false);
    setSport("soccer");
    setSide("home");
    setHomeTeam("");
    setAwayTeam("");
    setHomeScore("");
    setAwayScore("");
    setCompetition("");
    setPensOn(false);
    setPenHome("");
    setPenAway("");
    setStadium("");
    setAddress("");
    setNotes("");
    setPhotos([]);
    setScorers([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const id = newId();
    try {
      // Upload photos (best-effort, in parallel)
      let photoUrls: string[] = [];
      if (photos.length && user) {
        setStatus(`Uploading ${photos.length} photo${photos.length > 1 ? "s" : ""}…`);
        photoUrls = await Promise.all(
          photos.map(async (file) => {
            const safe = file.name.replace(/[^a-z0-9.\-_]/gi, "_");
            const path = `photos/${user.uid}/${id}/${Date.now()}_${safe}`;
            const snap = await uploadBytes(storageRef(storage, path), file);
            return getDownloadURL(snap.ref);
          })
        );
      }

      // Best-effort geocode for the maps later
      let lat: number | null = null;
      let lng: number | null = null;
      const locQuery = [stadium, address].filter(Boolean).join(", ");
      if (locQuery) {
        setStatus("Locating venue…");
        const coords = await geocode(locQuery);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }

      const event: SportEvent = {
        id,
        date: dateUnknown ? null : date || null,
        sport,
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeScore: numOrNull(homeScore),
        awayScore: numOrNull(awayScore),
        stadium: stadium.trim(),
        address: address.trim(),
        side,
        scorers,
        competition: competition.trim(),
        penalties:
          pensOn && (penHome !== "" || penAway !== "")
            ? { home: Number(penHome || 0), away: Number(penAway || 0) }
            : null,
        homeLineup: [],
        awayLineup: [],
        notes: notes.trim(),
        photos: photoUrls,
        lat,
        lng,
        createdAt: new Date().toISOString(),
      };

      setStatus("Saving…");
      await saveEvents([event, ...data.events]);
      resetForm();
      setStatus("Saved! 🎉");
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      setStatus((err as Error)?.message ?? "Something went wrong saving the event.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("Remove this event? This can't be undone.")) return;
    await saveEvents(data.events.filter((e) => e.id !== id));
  }

  // ── grouped + sorted list ──
  const grouped = useMemo(() => {
    const base = filterSport
      ? data.events.filter((e) => e.sport === filterSport)
      : data.events;
    const sorted = [...base].sort((a, b) => {
      const ad = a.date ?? "";
      const bd = b.date ?? "";
      if (ad && bd) return bd.localeCompare(ad);
      if (ad) return -1;
      if (bd) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    const byYear = new Map<string, SportEvent[]>();
    for (const e of sorted) {
      const year = e.date ? e.date.slice(0, 4) : "Undated";
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push(e);
    }
    return Array.from(byYear.entries());
  }, [data.events, filterSport]);

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2 tracking-tight">
        Log a sporting event
      </h2>
      <p className="text-ink-soft mb-6 text-[15px]">
        Record a game you were at — the score, the venue, who scored, a few photos.
      </p>

      <form onSubmit={submit} className="card p-5 sm:p-7 flex flex-col gap-5">
        <div className="section-head">
          <span className="overline">Basics</span>
        </div>
        {/* row: date / sport / side */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Date</label>
            <input
              type="date"
              className="field"
              value={date}
              disabled={dateUnknown}
              onChange={(e) => setDate(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-ink-soft mt-1.5 select-none">
              <input
                type="checkbox"
                className="accent-[var(--color-terracotta)]"
                checked={dateUnknown}
                onChange={(e) => setDateUnknown(e.target.checked)}
              />
              Date unknown
            </label>
          </div>
          <div>
            <label className="field-label">Sport</label>
            <select className="field" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {SPORT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Attended as</label>
            <select
              className="field"
              value={side}
              onChange={(e) => setSide(e.target.value as SportEvent["side"])}
            >
              <option value="home">Home fan</option>
              <option value="away">Away fan</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>

        <div className="section-head mt-1">
          <span className="overline">The match</span>
        </div>
        {/* teams + scores */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Home team</label>
            <input
              className="field"
              placeholder="e.g. Manchester United"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Away team</label>
            <input
              className="field"
              placeholder="e.g. Liverpool"
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Home score</label>
            <input
              type="number"
              min={0}
              className="field"
              placeholder="?"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Away score</label>
            <input
              type="number"
              min={0}
              className="field"
              placeholder="?"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
            />
          </div>
        </div>

        {/* venue */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Stadium / venue</label>
            <input
              className="field"
              placeholder="e.g. Old Trafford"
              value={stadium}
              onChange={(e) => setStadium(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Address / city</label>
            <input
              className="field"
              placeholder="e.g. Manchester, UK"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="field-label">Competition</label>
          <input
            className="field"
            placeholder="e.g. Premier League, Champions League"
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
          />
        </div>

        {/* penalties */}
        <div>
          <label className="flex items-center gap-2 text-sm text-ink-soft select-none">
            <input
              type="checkbox"
              className="accent-[var(--color-terracotta)]"
              checked={pensOn}
              onChange={(e) => setPensOn(e.target.checked)}
            />
            Went to penalties
          </label>
          {pensOn && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="field-label">Home penalties</label>
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={penHome}
                  onChange={(e) => setPenHome(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Away penalties</label>
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={penAway}
                  onChange={(e) => setPenAway(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* scorers */}
        {isSoccer && (
          <div>
            <label className="field-label">Goal scorers</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="field sm:flex-1"
                placeholder="Player name"
                value={scName}
                onChange={(e) => setScName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addScorer();
                  }
                }}
              />
              <select
                className="field sm:w-32"
                value={scSide}
                onChange={(e) => setScSide(e.target.value as "home" | "away")}
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
              <input
                className="field sm:w-20"
                placeholder="Min"
                value={scMin}
                onChange={(e) => setScMin(e.target.value)}
              />
              <button type="button" className="btn btn-ghost" onClick={addScorer}>
                + Add
              </button>
            </div>
            {scorers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {scorers.map((s, i) => (
                  <span key={i} className="chip">
                    {s.team === "home" ? "🏠" : "✈️"} {s.name}
                    {s.minute ? ` ${s.minute}'` : ""}
                    <button
                      type="button"
                      className="text-muted hover:text-clay ml-0.5"
                      onClick={() => setScorers((arr) => arr.filter((_, j) => j !== i))}
                      aria-label="Remove scorer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="section-head mt-1">
          <span className="overline">Memories</span>
        </div>
        {/* notes */}
        <div>
          <label className="field-label">Notes</label>
          <textarea
            className="field min-h-24 resize-y"
            placeholder="Anything memorable about the day…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* photos */}
        <div>
          <label className="field-label">Photos</label>
          <div className="flex flex-wrap gap-2 items-center">
            {previews.map((p, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="h-20 w-20 object-cover rounded-xl border border-line"
                />
                <button
                  type="button"
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 bg-card border border-line rounded-full w-6 h-6 text-sm text-clay shadow-[var(--shadow-soft)]"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="h-20 w-20 rounded-xl border-2 border-dashed border-line-strong flex items-center justify-center text-muted cursor-pointer hover:border-terracotta hover:text-terracotta transition text-2xl">
              +
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setPhotos((arr) => [...arr, ...files].slice(0, 10));
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Log Event"}
          </button>
          {status && <span className="text-sm text-ink-soft">{status}</span>}
        </div>
      </form>

      {/* event list */}
      <div className="mt-12">
        <h3 className="text-3xl text-ink mb-5">Everything you&apos;ve logged</h3>
        {data.events.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">🎟️</div>
            <p className="text-ink font-semibold">No events yet</p>
            <p className="text-sm text-muted mt-1">
              Fill in the form above to log your first game.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {grouped.map(([year, events]) => (
              <div key={year}>
                <div className="flex items-center gap-3 mb-4">
                  <h4 className="text-2xl text-terracotta">{year}</h4>
                  <span className="chip">
                    {events.length} event{events.length > 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-line" />
                </div>
                <div className="grid gap-3">
                  {events.map((e) => (
                    <EventCard key={e.id} event={e} onDelete={deleteEvent} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
