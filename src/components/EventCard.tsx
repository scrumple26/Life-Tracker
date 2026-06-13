"use client";

import { SPORT_EMOJI, SPORT_LABELS, type SportEvent } from "@/lib/types";

function formatDate(d: string | null) {
  if (!d) return null;
  const date = new Date(d + "T00:00:00");
  if (isNaN(date.getTime())) return null;
  return {
    day: date.toLocaleDateString(undefined, { day: "numeric" }),
    mon: date.toLocaleDateString(undefined, { month: "short" }),
    year: date.toLocaleDateString(undefined, { year: "numeric" }),
  };
}

function sideLabel(s: SportEvent["side"]) {
  return s === "home" ? "Home" : s === "away" ? "Away" : "Neutral";
}

export function EventCard({
  event,
  onDelete,
}: {
  event: SportEvent;
  onDelete?: (id: string) => void;
}) {
  const e = event;
  const homeWon =
    e.homeScore != null && e.awayScore != null && e.homeScore > e.awayScore;
  const awayWon =
    e.homeScore != null && e.awayScore != null && e.awayScore > e.homeScore;
  const d = formatDate(e.date);

  return (
    <div className="ticket lf-rise group">
      <div className="p-4 sm:p-5">
        {/* header strip */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none" aria-hidden>
              {SPORT_EMOJI[e.sport]}
            </span>
            <div className="flex flex-col">
              <span className="overline">{SPORT_LABELS[e.sport]}</span>
              {e.competition && (
                <span className="text-xs text-ink-soft font-medium">
                  {e.competition}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {d ? (
              <div className="text-right leading-tight">
                <div className="font-[family-name:var(--font-fraunces)] text-lg text-ink">
                  {d.day} {d.mon}
                </div>
                <div className="text-[11px] text-muted -mt-0.5">{d.year}</div>
              </div>
            ) : (
              <span className="chip">Date unknown</span>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(e.id)}
                className="opacity-0 group-hover:opacity-100 transition text-muted hover:text-clay text-xs"
                aria-label="Delete event"
                title="Delete event"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* score row */}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div
            className={`text-right text-base ${
              homeWon ? "text-ink font-semibold" : "text-ink-soft"
            }`}
          >
            {e.homeTeam || "Home"}
          </div>
          <div className="px-3.5 py-1.5 rounded-2xl bg-terracotta-soft border border-[#eccdbf] font-[family-name:var(--font-fraunces)] text-2xl text-terracotta-dark flex items-center gap-2 leading-none">
            <span className="tabular-nums">{e.homeScore ?? "–"}</span>
            <span className="text-terracotta/50 text-base">–</span>
            <span className="tabular-nums">{e.awayScore ?? "–"}</span>
          </div>
          <div
            className={`text-left text-base ${
              awayWon ? "text-ink font-semibold" : "text-ink-soft"
            }`}
          >
            {e.awayTeam || "Away"}
          </div>
        </div>

        {e.penalties && (
          <p className="text-center text-xs text-amber mt-2 font-semibold">
            won on penalties · {e.penalties.home}–{e.penalties.away}
          </p>
        )}

        {e.scorers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            {e.scorers.map((s, i) => (
              <span key={i} className="chip">
                ⚽ {s.name}
                {s.minute ? ` ${s.minute}'` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* perforated stub */}
      <div className="ticket-perf px-4 sm:px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {e.stadium && <span className="text-ink-soft font-medium">{e.stadium}</span>}
          {e.address && (
            <>
              <span>·</span>
              <span>{e.address}</span>
            </>
          )}
          <span className="ml-auto chip">{sideLabel(e.side)} side</span>
        </div>

        {e.photos.length > 0 && (
          <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
            {e.photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                loading="lazy"
                className="photo-frame h-24 w-24 shrink-0"
              />
            ))}
          </div>
        )}

        {e.notes && (
          <p className="mt-3 text-sm text-ink-soft whitespace-pre-wrap italic">
            “{e.notes}”
          </p>
        )}
      </div>
    </div>
  );
}
