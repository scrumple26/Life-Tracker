"use client";

import { useState } from "react";
import { useApp } from "@/lib/data";
import { BrandMark, BrandName } from "./Brand";
import { LogEventTab } from "./tabs/LogEventTab";
import { ComingSoon } from "./tabs/ComingSoon";

const TABS = [
  { id: "log", label: "Log Event" },
  { id: "stadiums", label: "Stadiums" },
  { id: "scorers", label: "Scorers" },
  { id: "teams", label: "Teams" },
  { id: "photos", label: "Photos" },
  { id: "restaurants", label: "Restaurants" },
  { id: "trips", label: "Trips" },
  { id: "concerts", label: "Concerts" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AppShell() {
  const { user, signOutUser } = useApp();
  const [tab, setTab] = useState<TabId>("log");

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
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${
                    active
                      ? "bg-terracotta text-white shadow-[0_6px_14px_rgba(194,96,61,0.25)]"
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
        {tab === "log" && <LogEventTab />}
        {tab === "stadiums" && (
          <ComingSoon title="Stadiums" blurb="Your venues on a warm map, with the games played at each." />
        )}
        {tab === "scorers" && (
          <ComingSoon title="Scorers" blurb="Everyone you've watched score, plus a birthplace map." />
        )}
        {tab === "teams" && (
          <ComingSoon title="Teams" blurb="Every team you've seen play, in a list and on a map." />
        )}
        {tab === "photos" && (
          <ComingSoon title="Photos" blurb="Your match-day photos, grouped by year and venue." />
        )}
        {tab === "restaurants" && (
          <ComingSoon title="Restaurants" blurb="Places by category, with what you ordered and a rating." />
        )}
        {tab === "trips" && (
          <ComingSoon title="Trips" blurb="Build an itinerary and see it as a list or on a map." />
        )}
        {tab === "concerts" && (
          <ComingSoon title="Concerts" blurb="Shows, setlists, and a Spotify export." />
        )}
      </main>
    </div>
  );
}
