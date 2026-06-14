"use client";

import { useState } from "react";
import { useApp } from "@/lib/data";
import { BrandMark, BrandName } from "./Brand";
import { LogEventTab } from "./tabs/LogEventTab";
import { StadiumsTab } from "./tabs/StadiumsTab";
import { ScorersTab } from "./tabs/ScorersTab";
import { TeamsTab } from "./tabs/TeamsTab";
import { PhotosTab } from "./tabs/PhotosTab";
import { ComingSoon } from "./tabs/ComingSoon";

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
  { id: "teams", label: "Teams" },
  { id: "photos", label: "Photos" },
] as const;

type SportTabId = (typeof SPORT_TABS)[number]["id"];

export function AppShell() {
  const { user, signOutUser } = useApp();
  const [tab, setTab] = useState<TabId>("sports");
  const [sportTab, setSportTab] = useState<SportTabId>("log");

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
        {tab === "sports" && (
          <>
            <div className="mb-6 flex justify-center sm:justify-start">
              <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-paper-2">
                {SPORT_TABS.map((t) => {
                  const active = t.id === sportTab;
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

            {sportTab === "log" && <LogEventTab />}
            {sportTab === "stadiums" && <StadiumsTab />}
            {sportTab === "scorers" && <ScorersTab />}
            {sportTab === "teams" && <TeamsTab />}
            {sportTab === "photos" && <PhotosTab />}
          </>
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
