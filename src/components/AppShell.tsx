"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/data";
import { visibleMenu, type MenuItemId, type ScreenId } from "@/lib/menu";
import {
  SPORT_ORDER,
  SPORT_PRESETS,
  isCourseSport,
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
import { MoviesTab } from "./tabs/MoviesTab";
import { OtherEventsTab } from "./tabs/OtherEventsTab";
import { PlacesTab } from "./tabs/PlacesTab";
import { SettingsTab } from "./tabs/SettingsTab";

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
  const [screen, setScreen] = useState<ScreenId>("sports");
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [sportTab, setSportTab] = useState<SportTabId>("log");
  const [adding, setAdding] = useState(false);
  const [customSport, setCustomSport] = useState("");

  const menu = useMemo(() => visibleMenu(data.settings.hiddenMenu), [data.settings.hiddenMenu]);
  // If the open screen gets switched off in Settings, fall back to the first one left.
  const visibleIds = menu.flatMap((g) => g.items.map((i) => i.id as MenuItemId));
  const tab: ScreenId =
    screen === "settings" || visibleIds.includes(screen) ? screen : (visibleIds[0] ?? "settings");

  // Sports the user has actually logged, in display order (custom sports last).
  // Golf & disc golf count courses played rather than games.
  const loggedSports = useMemo(() => {
    const counts = new Map<Sport, number>();
    for (const e of data.events) counts.set(e.sport, (counts.get(e.sport) ?? 0) + 1);
    for (const p of data.places) {
      if (p.tags.includes("course") && isCourseSport(p.courseType))
        counts.set(p.courseType, (counts.get(p.courseType) ?? 0) + 1);
    }
    const known = SPORT_ORDER.filter((s) => counts.has(s));
    const custom = [...counts.keys()].filter((s) => !SPORT_ORDER.includes(s)).sort();
    return [...known, ...custom].map((s) => ({ sport: s, count: counts.get(s) ?? 0 }));
  }, [data.events, data.places]);

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
      setScreen("sports");
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
          <div className="flex items-center gap-1 pb-2">
            {menu.map((group, gi) => (
              <MenuDropdown
                key={group.id}
                alignRight={gi > 0}
                label={group.label}
                items={group.items}
                active={tab}
                onPick={(id) => {
                  setScreen(id);
                  // Picking Sports from the menu returns to the sport picker.
                  if (id === "sports") setSelectedSport(null);
                }}
              />
            ))}
            <button
              onClick={() => setScreen("settings")}
              aria-label="Settings"
              title="Settings"
              className={`ml-auto shrink-0 h-8 w-8 rounded-full text-base transition ${
                tab === "settings"
                  ? "bg-terracotta text-white"
                  : "text-ink-soft hover:bg-paper-2 hover:text-ink"
              }`}
            >
              ⚙
            </button>
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

              {isCourseSport(selectedSport) ? (
                <PlacesTab tag="course" courseType={selectedSport} embedded />
              ) : (
              <>
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
              )}
            </>
          ))}
        {tab === "concerts" && <ConcertsTab />}
        {tab === "movies" && <MoviesTab />}
        {tab === "other-events" && <OtherEventsTab />}
        {tab === "courses" && <PlacesTab key="courses" tag="course" />}
        {tab === "landmarks" && <PlacesTab key="landmarks" tag="landmark" />}
        {tab === "parks" && <PlacesTab key="parks" tag="park" />}
        {tab === "restaurants" && <RestaurantsTab />}
        {tab === "vacation" && <TripsTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

/**
 * A menu group ("Events", "Explore"). Shows the open item's name when one of
 * its items is active, and lists the group's items in a popover.
 */
function MenuDropdown({
  label,
  items,
  active,
  onPick,
  alignRight = false,
}: {
  label: string;
  alignRight?: boolean; // keep the popover on-screen for groups further right on phones
  items: readonly { id: MenuItemId; label: string; emoji: string }[];
  active: ScreenId;
  onPick: (id: MenuItemId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.id === active);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition inline-flex items-center gap-1.5 ${
          current
            ? "bg-terracotta text-white shadow-[0_6px_14px_rgba(60,110,71,0.28)]"
            : "text-ink-soft hover:bg-paper-2 hover:text-ink"
        }`}
      >
        {label}
        {current && (
          <span className="font-normal opacity-90 max-w-[8.5rem] sm:max-w-none truncate">
            · {current.label}
          </span>
        )}
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ▼
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full ${alignRight ? "right-0 sm:right-auto sm:left-0" : "left-0"} mt-1.5 z-40 min-w-52 card p-1.5 shadow-[var(--shadow-lift)]`}
        >
          {items.map((i) => (
            <button
              key={i.id}
              role="menuitem"
              onClick={() => {
                onPick(i.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition ${
                i.id === active
                  ? "bg-terracotta-soft text-terracotta-dark font-semibold"
                  : "text-ink hover:bg-paper-2"
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {i.emoji}
              </span>
              {i.label}
            </button>
          ))}
        </div>
      )}
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
                  {count} {isCourseSport(sport) ? "course" : "game"}
                  {count === 1 ? "" : "s"} logged
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
