"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import {
  SPORT_ORDER,
  SPORT_PRESETS,
  isSoccerSport,
  slugifySport,
  sportEmoji,
  sportLabel,
  type Sport,
} from "@/lib/types";
import { BrandMark, BrandName } from "./Brand";
import { LogEventTab } from "./tabs/LogEventTab";
import { StadiumsTab } from "./tabs/StadiumsTab";
import { ScorersTab } from "./tabs/ScorersTab";
import { PlayersTab } from "./tabs/PlayersTab";
import { TeamsTab } from "./tabs/TeamsTab";
import { PhotosTab } from "./tabs/PhotosTab";
import { RestaurantsTab } from "./tabs/RestaurantsTab";
import { TripsTab } from "./tabs/TripsTab";
import { ConcertsTab } from "./tabs/ConcertsTab";

const TABS = [
  { id: "sports", label: "Sports" },
  { id: "restaurants", label: "Restaurants" },
  { id: "trips", label: "Trips" },
  { id: "concerts", label: "Concerts" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SPORT_TABS = [
  { id: "log", label: "Log Event" },
  { id: "stadiums", label: "Stadiums" },
  { id: "scorers", label: "Scorers" },
  { id: "players", label: "Players" },
  { id: "teams", label: "Teams" },
  { id: "photos", label: "Photos" },
] as const;

type SportTabId = (typeof SPORT_TABS)[number]["id"];

// Scorers & Players come from soccer lineup data, so they only apply to soccer.
function tabsForSport(sport: Sport) {
  return isSoccerSport(sport)
    ? SPORT_TABS
    : SPORT_TABS.filter((t) => t.id !== "scorers" && t.id !== "players");
}

export function AppShell() {
  const { user, signOutUser, data } = useApp();
  const [tab, setTab] = useState<TabId>("sports");
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [sportTab, setSportTab] = useState<SportTabId>("log");
  const [adding, setAdding] = useState(false);
  const [customSport, setCustomSport] = useState("");

  // Sports the user has actually logged, in display order (custom sports last).
  const loggedSports = useMemo(() => {
    const counts = new Map<Sport, number>();
    for (const e of data.events) counts.set(e.sport, (counts.get(e.sport) ?? 0) + 1);
    const known = SPORT_ORDER.filter((s) => counts.has(s));
    const custom = [...counts.keys()].filter((s) => !SPORT_ORDER.includes(s)).sort();
    return [...known, ...custom].map((s) => ({ sport: s, count: counts.get(s) ?? 0 }));
  }, [data.events]);

  function openSport(sport: Sport) {
    setSelectedSport(sport);
    setSportTab("log");
    setAdding(false);
    setCustomSport("");
  }

  function addCustomSport() {
    const slug = slugifySport(customSport);
    if (slug) openSport(slug);
  }

  // A "#log-event-<id>" hash (e.g. from a birthplace-map popup) jumps to the
  // Log Event tab of that event's sport; LogEventTab then scrolls to the card.
  useEffect(() => {
    const handle = () => {
      const m = window.location.hash.match(/^#log-event-(.+)$/);
      if (!m) return;
      setTab("sports");
      const ev = data.events.find((e) => e.id === m[1]);
      setSelectedSport(ev ? ev.sport : "soccer");
      setSportTab("log");
    };
    handle();
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, [data.events]);

  // Keep the sub-tab valid when the selected sport can't show it (non-soccer).
  const availableSportTabs = selectedSport ? tabsForSport(selectedSport) : SPORT_TABS;
  const activeSportTab = availableSportTabs.some((t) => t.id === sportTab)
    ? sportTab
    : "log";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-gradient-to-b from-[#fdf6ea] to-paper/85 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <BrandName className="text-2xl text-ink" />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted max-w-[180px] truncate">
              {user?.email}
            </span>
            <button onClick={() => signOutUser()} className="btn btn-ghost btn-sm">
              Sign Out
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-5xl px-2 sm:px-4">
          <div className="flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id);
                    // Clicking the top-level Sports tab returns to the sport picker.
                    if (t.id === "sports") setSelectedSport(null);
                  }}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${
                    active
                      ? "bg-terracotta text-white shadow-[0_6px_14px_rgba(60,110,71,0.28)]"
                      : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-7 pb-24">
        {tab === "sports" &&
          (selectedSport === null ? (
            <SportPicker
              sports={loggedSports}
              adding={adding}
              customSport={customSport}
              onToggleAdding={() => setAdding((v) => !v)}
              onCustomChange={setCustomSport}
              onAddCustom={addCustomSport}
              onPick={openSport}
            />
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setSelectedSport(null)}
                  className="btn btn-ghost btn-sm"
                >
                  ← All sports
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none" aria-hidden>
                    {sportEmoji(selectedSport)}
                  </span>
                  <h2 className="text-2xl text-ink">{sportLabel(selectedSport)}</h2>
                </div>
              </div>

              <div className="mb-6 flex justify-center sm:justify-start">
                <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-paper-2">
                  {availableSportTabs.map((t) => {
                    const active = t.id === activeSportTab;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSportTab(t.id)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                          active
                            ? "bg-card text-ink shadow-[var(--shadow-soft)]"
                            : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeSportTab === "log" && <LogEventTab sport={selectedSport} />}
              {activeSportTab === "stadiums" && <StadiumsTab sport={selectedSport} />}
              {activeSportTab === "scorers" && <ScorersTab sport={selectedSport} />}
              {activeSportTab === "players" && <PlayersTab sport={selectedSport} />}
              {activeSportTab === "teams" && <TeamsTab sport={selectedSport} />}
              {activeSportTab === "photos" && <PhotosTab sport={selectedSport} />}
            </>
          ))}
        {tab === "restaurants" && <RestaurantsTab />}
        {tab === "trips" && <TripsTab />}
        {tab === "concerts" && <ConcertsTab />}
      </main>
    </div>
  );
}

function SportPicker({
  sports,
  adding,
  customSport,
  onToggleAdding,
  onCustomChange,
  onAddCustom,
  onPick,
}: {
  sports: { sport: Sport; count: number }[];
  adding: boolean;
  customSport: string;
  onToggleAdding: () => void;
  onCustomChange: (v: string) => void;
  onAddCustom: () => void;
  onPick: (sport: Sport) => void;
}) {
  const logged = new Set(sports.map((s) => s.sport));
  return (
    <section className="lf-rise">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="text-4xl sm:text-5xl text-ink mb-2">Sports</h2>
          <p className="text-ink-soft text-[15px]">
            Pick a sport to log games and browse what you&apos;ve seen.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onToggleAdding}>
          {adding ? "Close" : "+ Add sport"}
        </button>
      </div>

      {adding && (
        <div className="card p-5 mb-6">
          <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-3">
            Standard & college sports
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {SPORT_PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => onPick(s)}
                className="chip hover:border-terracotta hover:text-terracotta transition"
              >
                {sportEmoji(s)} {sportLabel(s)}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">
            Something else
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="field sm:flex-1"
              placeholder="Custom sport (e.g. Cricket, Lacrosse)"
              value={customSport}
              autoFocus
              onChange={(e) => onCustomChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddCustom();
                }
              }}
            />
            <button
              className="btn btn-primary"
              disabled={!customSport.trim()}
              onClick={onAddCustom}
            >
              Add & log
            </button>
          </div>
        </div>
      )}

      {sports.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🏟️</div>
          <p className="text-ink font-semibold">No sports yet</p>
          <p className="text-sm text-muted mt-1">
            Hit <strong>+ Add sport</strong> to pick one and log your first game.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sports.map(({ sport, count }) => (
            <button
              key={sport}
              onClick={() => onPick(sport)}
              className="card p-5 text-left hover:shadow-[var(--shadow-lift)] transition flex items-center gap-4"
            >
              <span className="text-3xl leading-none" aria-hidden>
                {sportEmoji(sport)}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{sportLabel(sport)}</p>
                <p className="text-xs text-muted">
                  {count} game{count === 1 ? "" : "s"} logged
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Preset chips for sports already logged are hidden above; note if adding. */}
      {adding && logged.size > 0 && (
        <p className="text-xs text-muted mt-3">
          Tip: picking a sport you already have just opens it.
        </p>
      )}
    </section>
  );
}
